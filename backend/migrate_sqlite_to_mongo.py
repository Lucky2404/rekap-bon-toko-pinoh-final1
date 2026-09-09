"""One-time migration: SQLite (rekap_bon.db) -> MongoDB. Also uploads existing
local upload files to Emergent object storage."""
import sqlite3
import os
from pathlib import Path
from datetime import datetime, timezone
from database import get_db
from storage import put_object, APP_NAME

ROOT = Path(__file__).parent
SQLITE = ROOT / "data" / "rekap_bon.db"
UPLOAD_DIR = ROOT / "uploads"

TABLES = ["users", "pt", "periode", "toko", "nota", "nota_items",
          "pelunasan", "pelunasan_files", "wa_log", "settings", "audit_log"]
BOOL_FIELDS = {"is_active", "is_archived"}


def parse_dt(v):
    if not v:
        return None
    try:
        return datetime.fromisoformat(str(v).replace("Z", "+00:00"))
    except Exception:
        return v


def main():
    db = get_db()
    conn = sqlite3.connect(str(SQLITE))
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    for t in TABLES:
        db[t].delete_many({})
        rows = cur.execute(f"SELECT * FROM {t}").fetchall()
        docs = []
        maxid = 0
        for r in rows:
            d = dict(r)
            for k in list(d.keys()):
                if k in BOOL_FIELDS:
                    d[k] = bool(d[k])
                if k in ("created_at", "updated_at"):
                    d[k] = parse_dt(d[k])
            if "id" in d and isinstance(d["id"], int):
                maxid = max(maxid, d["id"])
            docs.append(d)
        # upload local files to object storage for pelunasan_files
        if t == "pelunasan_files":
            for d in docs:
                local = UPLOAD_DIR / d["filename"]
                if local.exists() and not str(d["filename"]).startswith(APP_NAME):
                    storage_path = f"{APP_NAME}/uploads/{d.get('pelunasan_id', 0)}/{d['filename']}"
                    try:
                        put_object(storage_path, local.read_bytes(),
                                   d.get("mime_type") or "application/octet-stream")
                        d["filename"] = storage_path
                        print(f"  uploaded {local.name} -> {storage_path}")
                    except Exception as e:
                        print(f"  upload FAILED {local.name}: {e}")
        if docs:
            db[t].insert_one and db[t].insert_many(docs)
        # set counter
        if t != "settings":
            db.counters.update_one({"_id": t}, {"$set": {"seq": maxid}}, upsert=True)
        print(f"{t}: migrated {len(docs)} rows (max id={maxid})")

    conn.close()
    print("DONE")


if __name__ == "__main__":
    main()
