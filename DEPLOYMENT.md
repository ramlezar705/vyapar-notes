# Vyapar.Notes — Self-Hosting Guide

Free deployment on MongoDB Atlas + Railway + Vercel + Google Gemini (all free tiers).

## Prerequisites

1. **Free accounts** (~5 min each to sign up):
   - MongoDB Atlas — https://cloud.mongodb.com/register
   - Railway — https://railway.app (sign in with GitHub)
   - Vercel — https://vercel.com (sign in with GitHub)
   - GitHub — https://github.com (to store the code)
2. **Google Gemini API key** (already have): https://aistudio.google.com/apikey

## Step 1 — MongoDB Atlas (free 512 MB)

1. Sign up → **Build a Database** → **M0 FREE**
2. Provider: AWS · Region: **Mumbai (ap-south-1)** · Cluster name: `vyapar-notes`
3. **Database Access** → **Add New User** → username `vyapar_user`, autogenerate password, **copy it**
4. **Network Access** → **Add IP Address** → **Allow Access from Anywhere** (0.0.0.0/0)
5. **Database** → **Connect** → **Drivers** → copy the connection string. Replace `<password>` with the password you saved.

Example: `mongodb+srv://vyapar_user:YourPass123@cluster0.abc123.mongodb.net/?retryWrites=true&w=majority`

## Step 2 — Push code to GitHub

- Paid Emergent plan: click **Save to GitHub** in the Emergent chat toolbar.
- Free plan: download files from the Emergent VS Code view and push to GitHub yourself.

## Step 3 — Backend on Railway (free)

1. Sign in to Railway with GitHub → **New Project** → **Deploy from GitHub repo** → select your repo
2. Railway auto-detects Python. In the service **Settings** → **Root Directory** set to `backend`.
3. **Variables** tab → add:
   ```
   MONGO_URL   = mongodb+srv://vyapar_user:YourPass123@cluster0.abc123.mongodb.net/?retryWrites=true&w=majority
   DB_NAME     = vyapar_notes
   GEMINI_API_KEY = <your Google AI Studio key>
   CORS_ORIGINS   = *
   ```
   (We'll tighten `CORS_ORIGINS` after frontend is deployed.)
4. **Settings** → **Networking** → **Generate Domain**. Copy the URL (e.g. `https://vyapar-notes-backend.up.railway.app`).
5. In browser open `<that-url>/api/` — you should see `{"message":"Vyapar API running"}`.

## Step 4 — Frontend on Vercel (free)

1. Vercel → **Add New** → **Project** → select the same GitHub repo
2. **Framework Preset**: Create React App · **Root Directory**: `frontend`
3. **Environment Variables** → add:
   ```
   REACT_APP_BACKEND_URL = https://vyapar-notes-backend.up.railway.app   (no trailing slash)
   ```
4. Click **Deploy**. In ~3 min you'll get a URL like `https://vyapar-notes.vercel.app`.

## Step 5 — Tighten CORS

1. In Railway → your backend → **Variables** → edit `CORS_ORIGINS`:
   ```
   CORS_ORIGINS = https://vyapar-notes.vercel.app
   ```
   Railway auto-redeploys in ~30 sec.
2. Open your Vercel URL → upload a PDF. It should work exactly like the Emergent preview did.

## Free-tier limits (plenty for you)

- MongoDB Atlas: 512 MB storage (millions of rows).
- Railway: $5 free credit/month; app may sleep after 30 min idle → 10-20 sec wake-up on first request. Fine for personal use.
- Vercel: unlimited bandwidth for personal projects.
- Google Gemini free tier: ~1,500 requests/day — 1 PDF/month uses ~1 request.

**Total monthly cost: ₹0**

## Data migration

The June PDF entries in Emergent's DB won't move automatically. Options:
- Simplest: re-upload the same PDF on your new deployed app — you'll get the same 417 entries back.
- Alt: use `mongoexport` from Emergent side (advanced) and `mongoimport` into Atlas.
