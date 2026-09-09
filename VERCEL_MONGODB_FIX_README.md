# Rekap Bon Toko Pinoh — Vercel + MongoDB FIX

Versi ini memperbaiki penyebab utama `FUNCTION_INVOCATION_FAILED` saat deploy di Vercel:

1. `MONGO_URL` tidak ada tidak lagi membuat modul langsung crash saat import.
2. `DB_NAME` sekarang opsional dan kompatibel dengan `MONGO_DB_NAME`; default database adalah `rekapbon`.
3. Koneksi MongoDB dibuat secara lazy, sehingga import `api/index.py` tidak langsung melakukan koneksi DNS MongoDB.
4. `seed_defaults()` tidak lagi dijalankan saat import modul. Sekarang dijalankan pada startup dengan error handling.
5. `next_id()` menggunakan `ReturnDocument.AFTER` dan database aktif dari `get_db()`.

## Environment Variables di Vercel

Tambahkan di Project Settings → Environment Variables:

- `MONGO_URL`
- `MONGO_DB_NAME` = `rekapbon` (opsional, tetapi disarankan)
- `JWT_SECRET`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `CORS_ORIGINS`

Contoh format MongoDB Atlas:

`mongodb+srv://USERNAME:PASSWORD@cluster-host.mongodb.net/rekapbon?retryWrites=true&w=majority`

Jangan memakai hostname cluster lama/typo. Ambil connection string langsung dari MongoDB Atlas → Connect → Drivers.

## Setelah mengubah Environment Variables

1. Save semua variables.
2. Redeploy project di Vercel.
3. Buka `/api/health` untuk tes.
4. Jika masih error, buka Runtime Logs dan cari error terbaru.

## Catatan keamanan

Jangan commit file `.env` dan jangan membagikan password MongoDB. Jika password lama sudah pernah tersebar, ganti password Database User di MongoDB Atlas.
