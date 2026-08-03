from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import json
import logging
import tempfile
import re
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone

from google import genai as google_genai
from google.genai import types as google_genai_types


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection. For Atlas (mongodb+srv://) attach certifi CA bundle to avoid
# TLS handshake issues on some hosts. For plain local mongodb:// leave defaults.
import certifi
mongo_url = os.environ['MONGO_URL']
_mongo_kwargs = {}
if mongo_url.startswith("mongodb+srv://") or "tls=true" in mongo_url.lower():
    _mongo_kwargs["tlsCAFile"] = certifi.where()
client = AsyncIOMotorClient(mongo_url, **_mongo_kwargs)
db = client[os.environ['DB_NAME']]

GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '').strip()

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ---------- Models ----------
class Entry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str  # YYYY-MM-DD
    month: str  # YYYY-MM
    item: str
    pcs: float
    rate: float = 0.0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class EntryCreate(BaseModel):
    date: str
    item: str
    pcs: float
    rate: float = 0.0


class EntryUpdate(BaseModel):
    rate: Optional[float] = None
    pcs: Optional[float] = None
    item: Optional[str] = None
    date: Optional[str] = None


class BulkRateUpdate(BaseModel):
    item: str
    rate: float
    month: str


class BulkRatesMap(BaseModel):
    month: Optional[str] = None
    scope: Optional[str] = "forward"  # 'forward' (this month + all future), 'month' (this month only), 'all' (all months)
    rates: dict  # {item_name: rate}


# ---------- Helpers ----------
def month_of(date_str: str) -> str:
    return date_str[:7]


PARSE_PROMPT = """You are parsing an Apple Notes PDF export containing business inventory/sales data written in a repeating pattern:
- A date header in the format "D-M" (day-month, e.g. "1-6" = June 1, "12-6" = June 12). Sometimes there may be a year like "1-6-2025" or just "1-6".
- Followed by rows of a two-column table: first column is a number (pcs / quantity), second column is an item name (English text). The item name may contain spaces.
- Then the next date, then next table, and so on.

Extract EVERY row and return STRICTLY a JSON object with this schema (no markdown, no prose, no code fences):
{
  "default_year": 2025,
  "days": [
    {"day": 1, "month": 6, "year": 2025, "entries": [{"pcs": 2000, "item": "Tomi aj"}, ...]},
    ...
  ]
}

Rules:
- If year is not present in the PDF, use 2025 as default_year.
- pcs must be a number (strip commas). item must be the full item name as written.
- Do NOT skip any row. Preserve original spelling and case of item names.
- If the same date appears multiple times (continued on another page), merge their entries into a single day object.
- Output ONLY the JSON object. Nothing else.
"""


async def parse_pdf_with_gemini(pdf_path: str) -> dict:
    """Parse PDF using Google Gemini (free tier, user-provided GEMINI_API_KEY)."""
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not set. Get a free key from https://aistudio.google.com/apikey")

    import asyncio
    def _run_sync() -> str:
    gclient = google_genai.Client(api_key=GEMINI_API_KEY)

    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()

    resp = gclient.models.generate_content(
       model="gemini-2.5-flash"
        contents=[
            google_genai_types.Part.from_bytes(
                data=pdf_bytes,
                mime_type="application/pdf"
            ),
            PARSE_PROMPT,
        ],
    )
    return resp.text or ""
    response_text = await asyncio.to_thread(_run_sync)

    # Strip potential code fences
    cleaned = response_text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    m = re.search(r"\{[\s\S]*\}", cleaned)
    if m:
        cleaned = m.group(0)
    data = json.loads(cleaned)
    return data


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "Vyapar API running"}


async def _process_pdf_job(job_id: str, tmp_path: str):
    """Background: parse PDF via Gemini and insert entries. Updates job doc."""
    try:
        try:
            await db.upload_jobs.update_one({"job_id": job_id}, {"$set": {"status": "parsing"}})
            parsed = await parse_pdf_with_gemini(tmp_path)
        except Exception as e:
            logger.exception("PDF parsing failed")
            await db.upload_jobs.update_one(
                {"job_id": job_id},
                {"$set": {"status": "error", "error": str(e), "finished_at": datetime.now(timezone.utc).isoformat()}},
            )
            return

        default_year = int(parsed.get("default_year") or 2025)
        days = parsed.get("days", [])
        inserted = 0
        months_touched = set()

        for day in days:
            try:
                year = int(day.get("year") or default_year)
                month = int(day.get("month"))
                d = int(day.get("day"))
            except Exception:
                continue
            date_str = f"{year:04d}-{month:02d}-{d:02d}"
            month_str = f"{year:04d}-{month:02d}"
            months_touched.add(month_str)
            for row in day.get("entries", []):
                try:
                    pcs = float(str(row.get("pcs")).replace(",", ""))
                except Exception:
                    continue
                item = str(row.get("item", "")).strip()
                if not item:
                    continue
                entry = Entry(date=date_str, month=month_str, item=item, pcs=pcs, rate=await _known_rate(item))
                await db.entries.insert_one(entry.model_dump())
                inserted += 1

        await db.upload_jobs.update_one(
            {"job_id": job_id},
            {"$set": {
                "status": "done",
                "inserted": inserted,
                "days": len(days),
                "months": sorted(months_touched),
                "finished_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
    except Exception as e:
        logger.exception("Unexpected error in PDF job")
        await db.upload_jobs.update_one(
            {"job_id": job_id},
            {"$set": {"status": "error", "error": str(e), "finished_at": datetime.now(timezone.utc).isoformat()}},
        )
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


@api_router.post("/upload-pdf")
async def upload_pdf(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    job_id = str(uuid.uuid4())
    await db.upload_jobs.insert_one({
        "job_id": job_id,
        "status": "queued",
        "filename": file.filename,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    background_tasks.add_task(_process_pdf_job, job_id, tmp_path)
    return {"job_id": job_id, "status": "queued"}


@api_router.get("/upload-status/{job_id}")
async def upload_status(job_id: str):
    job = await db.upload_jobs.find_one({"job_id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@api_router.get("/months")
async def get_months():
    months = await db.entries.distinct("month")
    months = sorted([m for m in months if m], reverse=True)
    return {"months": months}


@api_router.get("/entries")
async def get_entries(month: Optional[str] = None):
    query = {}
    if month:
        query["month"] = month
    entries = await db.entries.find(query, {"_id": 0}).sort([("date", 1), ("created_at", 1)]).to_list(10000)
    return {"entries": entries}


async def _remember_rate(item: str, rate: float):
    """Save latest rate for an item to memory (item_rates collection)."""
    if rate is None or rate <= 0:
        return
    await db.item_rates.update_one(
        {"item": item},
        {"$set": {"item": item, "rate": float(rate), "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )


async def _known_rate(item: str) -> float:
    doc = await db.item_rates.find_one({"item": item}, {"_id": 0, "rate": 1})
    return float(doc["rate"]) if doc and doc.get("rate") else 0.0


@api_router.get("/item-rates")
async def get_item_rates():
    docs = await db.item_rates.find({}, {"_id": 0}).to_list(5000)
    return {"rates": {d["item"]: d["rate"] for d in docs}}


@api_router.post("/entries", response_model=Entry)
async def create_entry(payload: EntryCreate):
    item = payload.item.strip()
    rate = payload.rate
    if rate == 0:
        rate = await _known_rate(item)
    entry = Entry(date=payload.date, month=month_of(payload.date), item=item, pcs=payload.pcs, rate=rate)
    await db.entries.insert_one(entry.model_dump())
    await _remember_rate(item, rate)
    return entry


@api_router.patch("/entries/{entry_id}")
async def update_entry(entry_id: str, payload: EntryUpdate):
    update = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if "date" in update:
        update["month"] = month_of(update["date"])
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.entries.update_one({"id": entry_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    entry = await db.entries.find_one({"id": entry_id}, {"_id": 0})

    auto_applied = 0
    if "rate" in update and update["rate"] is not None and float(update["rate"]) > 0 and entry:
        rate = float(update["rate"])
        item = entry["item"]
        entry_month = entry["month"]
        await _remember_rate(item, rate)
        # Auto-apply to same item in THIS month and all FUTURE months.
        # Past (settled) months are left untouched.
        r = await db.entries.update_many(
            {"item": item, "month": {"$gte": entry_month}, "id": {"$ne": entry_id}},
            {"$set": {"rate": rate}},
        )
        auto_applied = r.modified_count

    return {"entry": entry, "auto_applied": auto_applied}


@api_router.delete("/entries/{entry_id}")
async def delete_entry(entry_id: str):
    result = await db.entries.delete_one({"id": entry_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"ok": True}


@api_router.post("/entries/bulk-rate")
async def bulk_rate(payload: BulkRateUpdate):
    """Apply a rate to all entries of a given item in a given month."""
    result = await db.entries.update_many(
        {"item": payload.item, "month": payload.month},
        {"$set": {"rate": payload.rate}},
    )
    await _remember_rate(payload.item, payload.rate)
    return {"updated": result.modified_count}


@api_router.post("/entries/rates/bulk-apply")
async def bulk_rates_apply(payload: BulkRatesMap):
    """Apply many item->rate mappings at once.
    scope='forward' (default): this month + all future months.
    scope='month': only this month.
    scope='all': all months (including past).
    """
    total_updated = 0
    items_touched = 0
    scope = (payload.scope or "forward").lower()
    for item, rate in (payload.rates or {}).items():
        try:
            r = float(rate)
        except Exception:
            continue
        q = {"item": item}
        if payload.month and scope == "month":
            q["month"] = payload.month
        elif payload.month and scope == "forward":
            q["month"] = {"$gte": payload.month}
        # scope == "all": no month filter
        result = await db.entries.update_many(q, {"$set": {"rate": r}})
        total_updated += result.modified_count
        items_touched += 1
        await _remember_rate(item, r)
    return {"updated": total_updated, "items": items_touched}


@api_router.get("/summary")
async def summary(month: str):
    entries = await db.entries.find({"month": month}, {"_id": 0}).to_list(20000)

    total_revenue = 0.0
    total_pcs = 0.0
    active_days = set()
    daily = {}   # date -> {pcs, revenue}
    items = {}   # item -> {pcs, revenue}

    for e in entries:
        pcs = float(e.get("pcs", 0) or 0)
        rate = float(e.get("rate", 0) or 0)
        rev = pcs * rate
        total_pcs += pcs
        total_revenue += rev
        active_days.add(e["date"])
        d = daily.setdefault(e["date"], {"date": e["date"], "pcs": 0.0, "revenue": 0.0, "entries": 0})
        d["pcs"] += pcs
        d["revenue"] += rev
        d["entries"] += 1
        it = items.setdefault(e["item"], {"item": e["item"], "pcs": 0.0, "revenue": 0.0, "entries": 0})
        it["pcs"] += pcs
        it["revenue"] += rev
        it["entries"] += 1

    daily_list = sorted(daily.values(), key=lambda x: x["date"])
    items_list = sorted(items.values(), key=lambda x: x["pcs"], reverse=True)

    top_item_by_pcs = items_list[0]["item"] if items_list else None
    top_item_by_revenue = None
    if items_list:
        top_item_by_revenue = max(items_list, key=lambda x: x["revenue"])["item"]

    return {
        "month": month,
        "total_revenue": round(total_revenue, 2),
        "total_pcs": total_pcs,
        "active_days": len(active_days),
        "top_item_by_pcs": top_item_by_pcs,
        "top_item_by_revenue": top_item_by_revenue,
        "total_entries": len(entries),
        "daily": daily_list,
        "items": items_list,
    }


@api_router.delete("/month/{month}")
async def delete_month(month: str):
    result = await db.entries.delete_many({"month": month})
    return {"deleted": result.deleted_count}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------ Serve React frontend as static files (single-service deployment) ------
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

STATIC_DIR = ROOT_DIR / "static"


class SPAStaticFiles(StaticFiles):
    """Serve React build; on any 404 for a route path (no dot), fall back to index.html for SPA routing."""
    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        if response.status_code == 404 and "." not in path.split("/")[-1]:
            return FileResponse(STATIC_DIR / "index.html")
        return response


if STATIC_DIR.exists() and (STATIC_DIR / "index.html").exists():
    app.mount("/", SPAStaticFiles(directory=str(STATIC_DIR), html=True), name="spa")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
