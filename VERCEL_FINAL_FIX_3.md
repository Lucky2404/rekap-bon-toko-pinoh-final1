# FINAL-FIX-3 — Vercel routing fix

## Important
This version removes the manual `/api/* -> /api/index.py` rewrite. Vercel now natively detects `api/index.py` as the FastAPI function and routes `/api/*` to it. The manual rewrite could cause FastAPI to receive `/api/index.py` instead of the original API path and return `{"detail":"Not Found"}`.

## Vercel
- Root Directory: `.`
- Framework Preset: Other
- Build Command: `npm --prefix frontend install --legacy-peer-deps --no-audit --no-fund && npm --prefix frontend run build`
- Output Directory: `frontend/build`

## Environment variables
Backend:
- MONGO_URL
- MONGO_DB_NAME
- JWT_SECRET
- ADMIN_USERNAME
- ADMIN_PASSWORD
- CORS_ORIGINS

Frontend:
- `CI=false`
- Leave `REACT_APP_BACKEND_URL` empty for same-domain deployment.

## Test
After deployment open:
`https://YOUR-DOMAIN.vercel.app/api/health`

Expected:
`{"ok":true,"service":"rekap-bon-toko-pinoh"}`

Then login:
`admin / admin123`

If `/api/health` still returns 404, check the Vercel Functions list/build log. There must be a Python function generated from `api/index.py`.
