"""Vercel entrypoint for the Rekap Bon Toko Pinoh FastAPI application."""
import os
import sys

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from server import app  # noqa: E402,F401
