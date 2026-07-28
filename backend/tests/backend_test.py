"""Regression tests for the asynchronous PDF upload job API."""

import os
import time
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL is missing")
BASE_URL = base_url.rstrip("/")
PDF_PATH = Path("/app/test_assets/93vg8gfc_1-6.pdf")


@pytest.fixture(scope="module")
def api_client():
    session = requests.Session()
    yield session
    session.close()


def test_upload_status_unknown_job(api_client):
    response = api_client.get(f"{BASE_URL}/api/upload-status/TEST_nonexistent_job", timeout=20)
    assert response.status_code == 404
    assert response.json() == {"detail": "Job not found"}


def test_upload_rejects_non_pdf(api_client, tmp_path):
    invalid = tmp_path / "TEST_not_pdf.txt"
    invalid.write_text("not a PDF", encoding="utf-8")
    with invalid.open("rb") as handle:
        response = api_client.post(
            f"{BASE_URL}/api/upload-pdf",
            files={"file": (invalid.name, handle, "text/plain")},
            timeout=20,
        )
    assert response.status_code == 400
    assert response.json() == {"detail": "Only PDF files are supported"}


def test_real_pdf_async_job_completes_and_persists_entries(api_client):
    assert PDF_PATH.exists() and PDF_PATH.stat().st_size > 100_000

    before_response = api_client.get(f"{BASE_URL}/api/entries", params={"month": "2025-06"}, timeout=30)
    assert before_response.status_code == 200
    before_entries = before_response.json()["entries"]
    before_ids = {entry["id"] for entry in before_entries}

    started = time.monotonic()
    with PDF_PATH.open("rb") as handle:
        upload_response = api_client.post(
            f"{BASE_URL}/api/upload-pdf",
            files={"file": (PDF_PATH.name, handle, "application/pdf")},
            timeout=30,
        )
    upload_latency = time.monotonic() - started

    assert upload_response.status_code == 200
    upload = upload_response.json()
    assert isinstance(upload.get("job_id"), str) and upload["job_id"]
    assert upload["status"] == "queued"
    assert upload_latency < 10, f"Async enqueue took {upload_latency:.1f}s"

    deadline = time.monotonic() + 180
    seen_statuses = []
    status = None
    while time.monotonic() < deadline:
        status_response = api_client.get(
            f"{BASE_URL}/api/upload-status/{upload['job_id']}", timeout=20
        )
        assert status_response.status_code == 200
        status = status_response.json()
        assert status["job_id"] == upload["job_id"]
        assert status["status"] in {"queued", "parsing", "done", "error"}
        seen_statuses.append(status["status"])
        if status["status"] in {"done", "error"}:
            break
        time.sleep(3)

    assert status is not None
    assert status["status"] == "done", f"Job states={seen_statuses}; final={status}"
    assert 400 <= status["inserted"] <= 430
    assert status["days"] == 27
    assert status["months"] == ["2025-06"]

    after_response = api_client.get(f"{BASE_URL}/api/entries", params={"month": "2025-06"}, timeout=30)
    assert after_response.status_code == 200
    after_entries = after_response.json()["entries"]
    new_entries = [entry for entry in after_entries if entry["id"] not in before_ids]
    assert len(new_entries) == status["inserted"]
    assert all(entry["month"] == "2025-06" for entry in new_entries)
    assert len({entry["date"] for entry in new_entries}) == status["days"]

    # Preserve the pre-existing June dataset by deleting only this test upload's rows.
    cleanup_failures = []
    for entry in new_entries:
        cleanup = api_client.delete(f"{BASE_URL}/api/entries/{entry['id']}", timeout=20)
        if cleanup.status_code != 200 or cleanup.json() != {"ok": True}:
            cleanup_failures.append((entry["id"], cleanup.status_code, cleanup.text[:100]))
    assert not cleanup_failures, f"Failed to clean {len(cleanup_failures)} uploaded rows"

    final_response = api_client.get(f"{BASE_URL}/api/entries", params={"month": "2025-06"}, timeout=30)
    assert final_response.status_code == 200
    assert {entry["id"] for entry in final_response.json()["entries"]} == before_ids
