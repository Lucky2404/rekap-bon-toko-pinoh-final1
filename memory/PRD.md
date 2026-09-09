# PRD — Rekap Bon Toko Pinoh

## Problem statement (original)
Connect to user's GitHub repo (Lucky2404/LuckyAplikasiBerjalan), review recent commits,
install dependencies, and run the app in the Emergent live preview. User also mentioned
wanting MongoDB + Vercel compatibility, but requested minimal changes ("tanpa mengubah isinya").

## Architecture
- Backend: FastAPI + **MongoDB (pymongo)**, JWT auth (PyJWT + passlib/bcrypt). Integer IDs via a `counters` collection (next_id).
- Frontend: React (CRACO), react-router, axios, shadcn/ui, tailwind (UNCHANGED during migration)
- File uploads: Emergent Object Storage (backend/storage.py)
- Modules: Users, PT, Periode, Toko, Nota/RekapBon, Pelunasan (+ file uploads), WhatsApp service, Audit log, Backup (MongoDB JSON snapshot), Excel export

## Users / roles
- admin (full), operator (rekap & pelunasan), viewer (read only)
- Seeded accounts: admin/admin123, operator/operator123, viewer/viewer123

## Done (2026-06)
- Cloned repo from GitHub, reviewed commits, copied into /app (preserving .env)
- Installed backend (sqlalchemy, openpyxl, aiofiles, etc.) and frontend (yarn) deps
- Backend running on :8001 via supervisor; login API verified (returns JWT)
- Frontend running; login page renders correctly in live preview

## Backlog
- P2: (done) Vercel deployment setup

## Done (Vercel readiness)
- Fixed Vercel >500MB error: added slim root `requirements.txt` (only runtime deps: fastapi, pymongo[srv], openpyxl, passlib, bcrypt, PyJWT, python-multipart, requests, python-dotenv). Verified clean-venv boot = 62MB, all 53 routes register.
- Added `vercel.json` + `api/index.py` (ASGI `app` entry) + `.vercelignore` + `VERCEL_DEPLOY.md` (env var instructions).
- Fixed read-only-FS crash: `wa_session.py` SESSION_DIR falls back to `/tmp` on OSError (Vercel serverless). WhatsApp/Playwright degrades gracefully on Vercel; all other endpoints work.
- Emergent env untouched (backend/requirements.txt unchanged). Regression: 44/44 backend tests pass.

## Done (later)
- Migrated backend data layer from SQLite/SQLAlchemy to MongoDB (pymongo). New database.py (MongoClient + next_id counters), server.py fully rewritten using Mongo collections. models.py no longer used.
- Migrated all existing SQLite data into MongoDB (3 users, 6 PT, 1 periode, 2 toko, 1 nota, 1 pelunasan) and uploaded the 2 existing receipt images into Emergent Object Storage (migrate_sqlite_to_mongo.py).
- Backup feature reworked to store JSON snapshots in a MongoDB `backups` collection.
- Fixed a Mongo-specific bug: duplicate-item validation now runs before nota insert (no orphan records; previously no transaction rollback).
- Testing agent: 100% pass (backend 44/44 pytest, frontend login + all 8 tabs render).
