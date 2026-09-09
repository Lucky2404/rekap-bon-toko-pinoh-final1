# Rekap Bon Toko Pinoh — Vercel FINAL-FIX-2

This repository is configured as a single Vercel project. The React frontend builds from `frontend/`, FastAPI is exposed through `api/index.py`, `/api/*` is rewritten to FastAPI, and all other routes are rewritten to the React SPA.

## Vercel Environment Variables
Set these in Project Settings → Environment Variables:
- `MONGO_URL` = your MongoDB Atlas connection string
- `MONGO_DB_NAME` = `rekapbon` (or your database name)
- `JWT_SECRET` = a long random secret
- `ADMIN_USERNAME` = `admin`
- `ADMIN_PASSWORD` = `admin123` (change after confirming deployment)
- `CORS_ORIGINS` = your Vercel URL, or `*` for initial testing

Do not set `REACT_APP_BACKEND_URL` for this single-project deployment. The frontend automatically uses the current Vercel origin and calls `/api`.

## Vercel Project settings
- Root Directory: repository root (`.`), not `frontend`
- Framework Preset: Other (or auto-detected)
- Build Command: from `vercel.json`
- Output Directory: `frontend/build`

## Verify after deployment
- `/api/health` should return `{"ok":true,"service":"rekap-bon-toko-pinoh"}`
- `/login` should show the login page
- Demo admin: `admin` / `admin123`
