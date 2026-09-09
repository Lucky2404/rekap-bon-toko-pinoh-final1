VERCEL FIX ZIP - API + FRONTEND ROUTING

What was fixed:
1. Added api/[...path].py as a catch-all FastAPI Vercel entrypoint.
2. Updated vercel.json so every /api/* request goes to the catch-all Python function.
3. Kept the React SPA fallback for all non-API routes.
4. MongoDB environment variable names remain compatible with your backend:
   - MONGO_URL
   - MONGO_DB_NAME (or DB_NAME fallback)

After uploading/pushing this ZIP to GitHub:
1. Commit and Push in GitHub Desktop.
2. Open Vercel -> Deployments.
3. Wait for the NEW deployment from the latest commit.
4. Do NOT change Environment Variables again if they are already present.
5. Test:
   https://YOUR-DOMAIN.vercel.app/api/health

Expected:
{"ok":true,"service":"rekap-bon-toko-pinoh"}

Then open:
https://YOUR-DOMAIN.vercel.app/
