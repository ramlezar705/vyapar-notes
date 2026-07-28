# Vyapar.Notes - Business Analytics from Apple Notes PDFs

## Problem Statement
User (Gujarati speaker, small-business owner) keeps business records in Apple Notes: each entry has a date header like `1-6` followed by a two-column table (`pcs`, `item name`). They wanted a system to (1) upload the PDF export, (2) manually enter rate per row, (3) auto-calculate daily total, monthly total, per-item pcs and revenue, and (4) view everything as graphs.

## User Choice
- Rate management: **per-entry rate** (each row editable) + **bulk rate apply per item** helper
- Authentication: **None** (direct app)
- Charts: Daily line, Top items bar (by pcs + by revenue) + KPI cards
- Item names: kept as-is
- Multi-month: month selector in header

## Architecture
- Backend: FastAPI + MongoDB (motor). Endpoints: `/api/upload-pdf`, `/api/entries` (GET/POST/PATCH/DELETE), `/api/summary`, `/api/months`, `/api/entries/bulk-rate`, `/api/month/{m}`
- LLM: Gemini 2.5 Flash via emergentintegrations + EMERGENT_LLM_KEY for parsing PDF
- Frontend: React + shadcn/ui + recharts + phosphor icons

## Implemented (Feb 2026)
- PDF upload with AI parsing (dates + pcs + item name)
- Editable rate per row, bulk apply rate per item/month
- KPI cards: monthly revenue, total pcs, active days, top item
- Charts: daily sales trend (line), top 10 items (bar, by pcs / by revenue)
- Item-wise monthly summary table with revenue share
- Multi-month selector, manual add / delete entry, clear whole month
- Sonner toasts, phosphor icons, Work Sans + IBM Plex Sans typography

## Backlog / P1
- Compare-2-months view
- Export to CSV/Excel
- Item rate memory (auto-apply last used rate to same item)

## Next Actions
- End-to-end testing
- Deploy
