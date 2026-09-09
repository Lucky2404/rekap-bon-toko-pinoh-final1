LOGIN FIX VERCEL

Masalah: rewrite SPA sebelumnya menangkap semua URL termasuk /api/auth/login,
sehingga request login tidak sampai ke FastAPI.

Perbaikan: route /api/* sekarang diteruskan ke api/index.py sebelum fallback React.

Default akun jika environment variables belum diatur:
username: admin
password: admin123

Setelah upload ke GitHub, lakukan Redeploy without cache.
