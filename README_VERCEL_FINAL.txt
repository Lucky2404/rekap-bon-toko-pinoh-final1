FINAL VERCEL DEPLOY
1. Extract ZIP and upload ALL contents into the ROOT of GitHub repository.
2. Do NOT upload the ZIP itself and do NOT place project inside another folder.
3. Verify GitHub root contains: api/, backend/, frontend/, requirements.txt, vercel.json.
4. In Vercel, Environment Variables:
MONGO_URL
MONGO_DB_NAME=rekapbon
JWT_SECRET
ADMIN_USERNAME=lucky
ADMIN_PASSWORD=lucky123
CORS_ORIGINS=https://rekap-bon-toko-pinoh.vercel.app
REACT_APP_BACKEND_URL=
CI=false
5. Redeploy after variables are saved.
6. Test /api/health then login with ADMIN_USERNAME / ADMIN_PASSWORD.
