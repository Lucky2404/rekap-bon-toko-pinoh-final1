"""MongoDB connection helpers for local development and Vercel serverless."""
import os
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient, ReturnDocument

# Local .env is optional. On Vercel, Environment Variables are used instead.
load_dotenv(Path(__file__).parent / ".env")

MONGO_URL = (os.environ.get("MONGO_URL") or "").strip()
# Support both names so old Vercel settings continue to work.
DB_NAME = (
    os.environ.get("MONGO_DB_NAME")
    or os.environ.get("DB_NAME")
    or "rekapbon"
).strip()

_client = None
_db = None


def get_db():
    """Return the MongoDB database, creating the client lazily.

    Lazy initialization prevents the Vercel function from crashing during
    module import when an environment variable or DNS configuration is wrong.
    """
    global _client, _db

    if _db is not None:
        return _db

    if not MONGO_URL:
        raise RuntimeError(
            "MONGO_URL belum diatur. Tambahkan Environment Variable MONGO_URL di Vercel."
        )

    _client = MongoClient(
        MONGO_URL,
        serverSelectionTimeoutMS=10000,
        connectTimeoutMS=10000,
        socketTimeoutMS=20000,
        retryWrites=True,
    )
    _db = _client[DB_NAME]
    return _db


def next_id(name: str) -> int:
    db = get_db()
    doc = db.counters.find_one_and_update(
        {"_id": name},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return int(doc["seq"])
