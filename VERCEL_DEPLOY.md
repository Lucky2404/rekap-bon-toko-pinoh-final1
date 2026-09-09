# Deploy Backend ke Vercel (Rekap Bon Toko Pinoh)

Backend FastAPI + MongoDB ini sudah disiapkan agar muat di limit ukuran Vercel
(sebelumnya >500MB karena dependency berat yang tidak dipakai: Playwright, pandas,
numpy, library LLM/Google, boto3, dll). Konfigurasi Vercel hanya memasang paket
runtime yang benar-benar dipakai (lihat `requirements.txt` di root).

## File yang dipakai Vercel
- `vercel.json` — route semua request ke fungsi Python `api/index.py`.
- `api/index.py` — entrypoint serverless, meng-export ASGI `app` dari `backend/server.py`.
- `requirements.txt` (root) — daftar dependency RAMPING (bukan `backend/requirements.txt`).
- `.vercelignore` — mengecualikan frontend, node_modules, uploads, data, tests, dsb.

## Environment Variables (set di Vercel → Project → Settings → Environment Variables)
Wajib:
- `MONGO_URL` — connection string MongoDB Atlas, contoh: `mongodb+srv://user:pass@cluster.mongodb.net`
- `DB_NAME` — nama database, contoh: `rekap_bon`
- `EMERGENT_LLM_KEY` — untuk Object Storage (upload/unduh bukti transfer & nota).
Opsional:
- `CORS_ORIGINS` — daftar origin frontend dipisah koma (default `*`).
- `JWT_SECRET` — rahasia token (set nilai acak yang kuat untuk produksi).
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — akun admin bawaan (default `admin` / `admin123`).

## Catatan
- Fitur auto-kirim WhatsApp (Playwright) TIDAK jalan di Vercel serverless (tidak ada
  browser). Endpoint-nya tetap ada dan gagal dengan pesan yang rapi; fitur lain (nota,
  pelunasan, dashboard, export Excel, backup) berjalan normal. Untuk WhatsApp otomatis,
  jalankan backend di server biasa (mis. VPS) atau tetap pakai preview Emergent.
- Frontend (React) deploy sebagai project statis terpisah di Vercel; set
  `REACT_APP_BACKEND_URL` ke URL backend Vercel ini.
