# Vercel Deployment - Final

This project is configured as a single Vercel deployment:

- React frontend: `frontend/build`
- FastAPI backend: `api/index.py`
- Python dependencies: root `requirements.txt`
- Python version: 3.12
- Frontend API: same-origin `/api`
- SPA routes are rewritten to `index.html`

## Important

Do NOT use the old `builds` configuration in `vercel.json`.
Do NOT restore the old `backend/requirements.txt` containing `emergentintegrations`.

After pushing this project to GitHub, deploy the new commit in Vercel.

## Required Vercel Environment Variables

Set the same environment variables your application already uses, especially:

- `MONGO_URL`
- `DB_NAME`

If object storage is used:

- `EMERGENT_LLM_KEY`
- `INTEGRATION_PROXY_URL` (only if you use a custom integration proxy)

Do not put secret values into source files.
