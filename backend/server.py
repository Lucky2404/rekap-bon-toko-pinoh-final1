from fastapi import FastAPI, APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, status
from fastapi.responses import StreamingResponse, Response
from fastapi.security import OAuth2PasswordBearer
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from pathlib import Path
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from dotenv import load_dotenv
import jwt as pyjwt
import os
import logging
import uuid
import zipfile
import io
import json
import re
import asyncio

from database import get_db, next_id
from excel_export import build_excel
from whatsapp_service import (build_message, build_wa_link, normalize_phone,
                             DEFAULT_TEMPLATE, PLACEHOLDERS)
from storage import put_object, get_object, init_storage, APP_NAME

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

JWT_SECRET = os.environ.get("JWT_SECRET", "rekap-bon-toko-pinoh-super-secret")
JWT_ALG = "HS256"
JWT_EXPIRE_HOURS = 12

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

app = FastAPI(title="Rekap Bon Toko Pinoh")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("rekap")


# ---------- helpers ----------
def hash_pw(pw: str) -> str:
    return pwd_context.hash(pw)


def verify_pw(pw: str, h: str) -> bool:
    try:
        return pwd_context.verify(pw, h)
    except Exception:
        return False


def now_utc():
    return datetime.now(timezone.utc)


def create_token(user_id: int, username: str, role: str) -> str:
    payload = {
        "sub": str(user_id),
        "username": username,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def get_current_user(token: str = Depends(oauth2_scheme),
                     token_q: Optional[str] = Query(None, alias="token"),
                     db=Depends(get_db)):
    token = token or token_q
    if not token:
        raise HTTPException(status_code=401, detail="Belum login")
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        uid = int(payload["sub"])
    except Exception:
        raise HTTPException(status_code=401, detail="Token tidak valid")
    user = db.users.find_one({"id": uid, "is_active": True})
    if not user:
        # fallback for ENV-based admin (id=1) when no matching db user
        if uid == 1 and payload.get("role") == "admin":
            return {"id": 1, "username": payload.get("username", "admin"),
                    "full_name": "Administrator", "role": "admin", "is_active": True}
        raise HTTPException(status_code=401, detail="User tidak aktif")
    return user


def require_role(*roles):
    def _dep(user=Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Akses ditolak")
        return user
    return _dep


def log_action(db, user, aksi: str, entity: str = "", entity_id="", detail=""):
    db.audit_log.insert_one({
        "id": next_id("audit_log"),
        "user_id": user.get("id"), "username": user.get("username", ""),
        "aksi": aksi, "entity": entity, "entity_id": str(entity_id),
        "detail": detail, "created_at": now_utc(),
    })


def detect_bank(rekening: str) -> str:
    if not rekening:
        return ""
    r = re.sub(r"\D", "", rekening)
    if not r:
        return ""
    L = len(r)
    PREFIX = [
        ("3901", "BRI"), ("0021", "BRI"), ("0026", "BRI"), ("0206", "BRI"),
        ("1300", "Mandiri"), ("1310", "Mandiri"), ("1400", "Mandiri"),
        ("1440", "Mandiri"), ("1560", "Mandiri"), ("1570", "Mandiri"),
        ("7000", "BNI"), ("8000", "BNI"), ("0303", "BNI"),
        ("7600", "BSI"), ("7100", "BSI"),
        ("5050", "Permata"), ("7010", "CIMB Niaga"), ("8005", "CIMB Niaga"),
        ("003", "Danamon"), ("006", "BCA"), ("007", "BCA"),
        ("021", "BCA"), ("022", "BCA"), ("035", "BCA"),
        ("100", "BTN"), ("101", "BTN"),
        ("206", "BRI"), ("128", "Mandiri"), ("900", "BNI"),
    ]
    for pre, bank in PREFIX:
        if r.startswith(pre):
            return bank
    if L == 10:
        return "BCA"
    if L == 13:
        return "Mandiri"
    if L == 15:
        return "BRI"
    if L == 12:
        return "CIMB Niaga"
    if L == 14:
        return "Danamon"
    return ""


# ---------- schemas ----------
class LoginIn(BaseModel):
    username: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserIn(BaseModel):
    username: str
    password: Optional[str] = None
    full_name: str = ""
    role: str = "user"
    is_active: bool = True


class PTIn(BaseModel):
    nama: str


class PeriodeIn(BaseModel):
    nama: str
    tanggal_mulai: str
    tanggal_selesai: str
    is_active: bool = False


class TokoIn(BaseModel):
    nama: str
    rekening: str = ""
    bank: str = ""
    atas_nama: str = ""
    whatsapp: str = ""
    sapaan: str = "Bapak"
    alamat: str = ""


class SapaanIn(BaseModel):
    nama: str


class NotaItemIn(BaseModel):
    barang: str = ""
    keterangan: str
    no_pp: str = ""
    pt_id: int
    total: float = 0


class NotaIn(BaseModel):
    toko_id: int
    no_nota: str
    tanggal: str
    periode_id: Optional[int] = None
    items: List[NotaItemIn] = []


# ---------- auth ----------
@api.post("/auth/login", response_model=TokenOut)
def login(inp: LoginIn, db=Depends(get_db)):
    env_username = os.environ.get("ADMIN_USERNAME", "admin")
    env_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    if inp.username == env_username and inp.password == env_password:
        u = db.users.find_one({"username": env_username})
        uid = u["id"] if u else 1
        return TokenOut(
            access_token=create_token(uid, env_username, "admin"),
            user={"id": uid, "username": env_username,
                  "full_name": "Administrator", "role": "admin"},
        )
    u = db.users.find_one({"username": inp.username, "is_active": True})
    if not u or not verify_pw(inp.password, u["password_hash"]):
        raise HTTPException(status_code=401, detail="Username atau password salah")
    log_action(db, u, "login")
    return TokenOut(
        access_token=create_token(u["id"], u["username"], u["role"]),
        user={"id": u["id"], "username": u["username"],
              "full_name": u.get("full_name", ""), "role": u["role"]},
    )


@api.get("/auth/me")
def me(user=Depends(get_current_user)):
    return {"id": user["id"], "username": user["username"],
            "full_name": user.get("full_name", ""), "role": user["role"]}


# ---------- users (admin) ----------
@api.get("/users")
def list_users(user=Depends(require_role("admin")), db=Depends(get_db)):
    return [
        {"id": u["id"], "username": u["username"], "full_name": u.get("full_name", ""),
         "role": u["role"], "is_active": u.get("is_active", True)}
        for u in db.users.find().sort("id", 1)
    ]


@api.post("/users")
def create_user(inp: UserIn, user=Depends(require_role("admin")), db=Depends(get_db)):
    if not inp.password:
        raise HTTPException(400, "Password wajib")
    if db.users.find_one({"username": inp.username}):
        raise HTTPException(400, "Username sudah ada")
    uid = next_id("users")
    db.users.insert_one({
        "id": uid, "username": inp.username, "password_hash": hash_pw(inp.password),
        "full_name": inp.full_name, "role": inp.role, "is_active": inp.is_active,
        "created_at": now_utc(),
    })
    log_action(db, user, "create_user", "user", inp.username)
    return {"id": uid}


@api.put("/users/{uid}")
def update_user(uid: int, inp: UserIn, user=Depends(require_role("admin")), db=Depends(get_db)):
    u = db.users.find_one({"id": uid})
    if not u:
        raise HTTPException(404)
    upd = {"full_name": inp.full_name, "role": inp.role, "is_active": inp.is_active}
    if inp.password:
        upd["password_hash"] = hash_pw(inp.password)
    db.users.update_one({"id": uid}, {"$set": upd})
    log_action(db, user, "update_user", "user", uid)
    return {"ok": True}


@api.delete("/users/{uid}")
def delete_user(uid: int, user=Depends(require_role("admin")), db=Depends(get_db)):
    if uid == user["id"]:
        raise HTTPException(400, "Tidak bisa hapus diri sendiri")
    if not db.users.find_one({"id": uid}):
        raise HTTPException(404)
    db.users.delete_one({"id": uid})
    log_action(db, user, "delete_user", "user", uid)
    return {"ok": True}


# ---------- PT ----------
@api.get("/pt")
def list_pt(user=Depends(get_current_user), db=Depends(get_db)):
    return [{"id": p["id"], "nama": p["nama"]} for p in db.pt.find().sort("nama", 1)]


@api.post("/pt")
def create_pt(inp: PTIn, user=Depends(require_role("admin", "operator")), db=Depends(get_db)):
    if db.pt.find_one({"nama": inp.nama}):
        raise HTTPException(400, "PT sudah ada")
    pid = next_id("pt")
    db.pt.insert_one({"id": pid, "nama": inp.nama, "created_at": now_utc()})
    log_action(db, user, "create_pt", "pt", inp.nama)
    return {"id": pid, "nama": inp.nama}


@api.put("/pt/{pid}")
def update_pt(pid: int, inp: PTIn, user=Depends(require_role("admin", "operator")), db=Depends(get_db)):
    if not db.pt.find_one({"id": pid}):
        raise HTTPException(404)
    db.pt.update_one({"id": pid}, {"$set": {"nama": inp.nama}})
    log_action(db, user, "update_pt", "pt", pid)
    return {"ok": True}


@api.delete("/pt/{pid}")
def delete_pt(pid: int, user=Depends(require_role("admin")), db=Depends(get_db)):
    if not db.pt.find_one({"id": pid}):
        raise HTTPException(404)
    if db.nota_items.find_one({"pt_id": pid}):
        raise HTTPException(400, "PT masih dipakai di nota")
    db.pt.delete_one({"id": pid})
    log_action(db, user, "delete_pt", "pt", pid)
    return {"ok": True}


# ---------- Periode ----------
@api.get("/periode")
def list_periode(user=Depends(get_current_user), db=Depends(get_db)):
    return [
        {"id": p["id"], "nama": p["nama"], "tanggal_mulai": p.get("tanggal_mulai", ""),
         "tanggal_selesai": p.get("tanggal_selesai", ""), "is_active": p.get("is_active", False),
         "is_archived": p.get("is_archived", False)}
        for p in db.periode.find().sort("id", -1)
    ]


@api.post("/periode")
def create_periode(inp: PeriodeIn, user=Depends(require_role("admin", "operator")), db=Depends(get_db)):
    if db.periode.find_one({"nama": inp.nama}):
        raise HTTPException(400, "Periode sudah ada")
    if inp.is_active:
        db.periode.update_many({"is_active": True},
                               {"$set": {"is_active": False, "is_archived": True}})
    pid = next_id("periode")
    db.periode.insert_one({
        "id": pid, "nama": inp.nama, "tanggal_mulai": inp.tanggal_mulai,
        "tanggal_selesai": inp.tanggal_selesai, "is_active": inp.is_active,
        "is_archived": False, "created_at": now_utc(),
    })
    log_action(db, user, "create_periode", "periode", inp.nama)
    return {"id": pid}


@api.post("/periode/{pid}/activate")
def activate_periode(pid: int, user=Depends(require_role("admin", "operator")), db=Depends(get_db)):
    if not db.periode.find_one({"id": pid}):
        raise HTTPException(404)
    db.periode.update_many({"is_active": True},
                           {"$set": {"is_active": False, "is_archived": True}})
    db.periode.update_one({"id": pid}, {"$set": {"is_active": True, "is_archived": False}})
    log_action(db, user, "activate_periode", "periode", pid)
    return {"ok": True}


@api.delete("/periode/{pid}")
def delete_periode(pid: int, user=Depends(require_role("admin")), db=Depends(get_db)):
    p = db.periode.find_one({"id": pid})
    if not p:
        raise HTTPException(404)
    if db.nota.find_one({"periode_id": pid}):
        raise HTTPException(400, "Periode masih punya nota. Pindahkan/hapus nota lebih dulu.")
    if p.get("is_active"):
        raise HTTPException(400, "Periode aktif tidak bisa dihapus. Aktifkan periode lain dulu.")
    db.periode.delete_one({"id": pid})
    log_action(db, user, "delete_periode", "periode", pid)
    return {"ok": True}


@api.post("/periode/{pid}/archive")
def archive_periode(pid: int, user=Depends(require_role("admin", "operator")), db=Depends(get_db)):
    p = db.periode.find_one({"id": pid})
    if not p:
        raise HTTPException(404)
    if p.get("is_active"):
        raise HTTPException(400, "Periode aktif tidak bisa diarsipkan. Aktifkan periode lain dulu.")
    new_val = not p.get("is_archived", False)
    db.periode.update_one({"id": pid}, {"$set": {"is_archived": new_val}})
    log_action(db, user, "archive_periode", "periode", pid, detail=f"is_archived={new_val}")
    return {"ok": True, "is_archived": new_val}


@api.put("/periode/{pid}")
def update_periode(pid: int, inp: PeriodeIn, user=Depends(require_role("admin", "operator")), db=Depends(get_db)):
    if not db.periode.find_one({"id": pid}):
        raise HTTPException(404)
    db.periode.update_one({"id": pid}, {"$set": {
        "nama": inp.nama, "tanggal_mulai": inp.tanggal_mulai,
        "tanggal_selesai": inp.tanggal_selesai,
    }})
    log_action(db, user, "update_periode", "periode", pid)
    return {"ok": True}


# ---------- Bank detect ----------
@api.get("/bank/detect")
def bank_detect(rekening: str, user=Depends(get_current_user)):
    return {"bank": detect_bank(rekening), "confident": False,
            "hint": "Deteksi bank berdasarkan prefix & pola nomor rekening. Silakan konfirmasi manual."}


# ---------- Toko ----------
@api.get("/toko")
def list_toko(user=Depends(get_current_user), db=Depends(get_db)):
    return [
        {"id": t["id"], "nama": t["nama"], "rekening": t.get("rekening", ""), "bank": t.get("bank", ""),
         "atas_nama": t.get("atas_nama", ""), "whatsapp": t.get("whatsapp", ""),
         "sapaan": t.get("sapaan", "Bapak"), "alamat": t.get("alamat", "")}
        for t in db.toko.find().sort("nama", 1)
    ]


@api.post("/toko")
def create_toko(inp: TokoIn, user=Depends(require_role("admin", "operator")), db=Depends(get_db)):
    if db.toko.find_one({"nama": inp.nama}):
        raise HTTPException(400, "Toko sudah ada")
    tid = next_id("toko")
    doc = inp.dict()
    doc.update({"id": tid, "created_at": now_utc()})
    db.toko.insert_one(doc)
    log_action(db, user, "create_toko", "toko", inp.nama)
    return {"id": tid}


@api.put("/toko/{tid}")
def update_toko(tid: int, inp: TokoIn, user=Depends(require_role("admin", "operator")), db=Depends(get_db)):
    if not db.toko.find_one({"id": tid}):
        raise HTTPException(404)
    db.toko.update_one({"id": tid}, {"$set": inp.dict()})
    log_action(db, user, "update_toko", "toko", tid)
    return {"ok": True}


@api.delete("/toko/{tid}")
def delete_toko(tid: int, user=Depends(require_role("admin")), db=Depends(get_db)):
    if not db.toko.find_one({"id": tid}):
        raise HTTPException(404)
    if db.nota.find_one({"toko_id": tid}):
        raise HTTPException(400, "Toko masih punya nota")
    db.toko.delete_one({"id": tid})
    log_action(db, user, "delete_toko", "toko", tid)
    return {"ok": True}


# ---------- Sapaan (managed list) ----------
@api.get("/sapaan")
def list_sapaan(user=Depends(get_current_user), db=Depends(get_db)):
    return [{"id": s["id"], "nama": s["nama"]} for s in db.sapaan.find().sort("id", 1)]


@api.post("/sapaan")
def create_sapaan(inp: SapaanIn, user=Depends(require_role("admin", "operator")), db=Depends(get_db)):
    nama = inp.nama.strip()
    if not nama:
        raise HTTPException(400, "Sapaan tidak boleh kosong")
    if db.sapaan.find_one({"nama": nama}):
        raise HTTPException(400, "Sapaan sudah ada")
    sid = next_id("sapaan")
    db.sapaan.insert_one({"id": sid, "nama": nama, "created_at": now_utc()})
    log_action(db, user, "create_sapaan", "sapaan", nama)
    return {"id": sid, "nama": nama}


@api.put("/sapaan/{sid}")
def update_sapaan(sid: int, inp: SapaanIn, user=Depends(require_role("admin", "operator")), db=Depends(get_db)):
    s = db.sapaan.find_one({"id": sid})
    if not s:
        raise HTTPException(404)
    nama = inp.nama.strip()
    if not nama:
        raise HTTPException(400, "Sapaan tidak boleh kosong")
    other = db.sapaan.find_one({"nama": nama})
    if other and other["id"] != sid:
        raise HTTPException(400, "Sapaan sudah ada")
    db.sapaan.update_one({"id": sid}, {"$set": {"nama": nama}})
    # keep toko records in sync with the renamed sapaan
    db.toko.update_many({"sapaan": s["nama"]}, {"$set": {"sapaan": nama}})
    log_action(db, user, "update_sapaan", "sapaan", sid)
    return {"ok": True, "nama": nama}


@api.delete("/sapaan/{sid}")
def delete_sapaan(sid: int, user=Depends(require_role("admin")), db=Depends(get_db)):
    s = db.sapaan.find_one({"id": sid})
    if not s:
        raise HTTPException(404)
    if db.sapaan.count_documents({}) <= 1:
        raise HTTPException(400, "Minimal harus ada 1 sapaan")
    db.sapaan.delete_one({"id": sid})
    log_action(db, user, "delete_sapaan", "sapaan", sid)
    return {"ok": True}


# ---------- Nota (Rekap Bon) ----------
def _serialize_nota(db, n):
    items = list(db.nota_items.find({"nota_id": n["id"]}).sort("id", 1))
    toko = db.toko.find_one({"id": n["toko_id"]}) or {}
    periode = db.periode.find_one({"id": n.get("periode_id")}) if n.get("periode_id") else None
    total = sum(float(i.get("total") or 0) for i in items)
    pt_cache = {}

    def pt_nama(pid):
        if pid not in pt_cache:
            d = db.pt.find_one({"id": pid})
            pt_cache[pid] = d["nama"] if d else ""
        return pt_cache[pid]

    return {
        "id": n["id"], "nomor_urut": n.get("nomor_urut", 0), "no_nota": n["no_nota"],
        "tanggal": n["tanggal"], "status": n.get("status", "belum_lunas"),
        "toko": {"id": toko.get("id"), "nama": toko.get("nama", ""), "bank": toko.get("bank", ""),
                 "rekening": toko.get("rekening", ""), "atas_nama": toko.get("atas_nama", ""),
                 "whatsapp": toko.get("whatsapp", ""), "sapaan": toko.get("sapaan", "Bapak")},
        "periode": ({"id": periode["id"], "nama": periode["nama"], "is_active": periode.get("is_active", False)}
                    if periode else None),
        "items": [
            {"id": it["id"], "barang": it.get("barang", "") or "", "keterangan": it["keterangan"],
             "no_pp": it.get("no_pp", ""), "pt_id": it["pt_id"], "pt_nama": pt_nama(it["pt_id"]),
             "total": it.get("total", 0)}
            for it in items
        ],
        "total": total,
    }


@api.get("/nota")
def list_nota(
    periode_id: Optional[int] = None,
    pt_id: Optional[int] = None,
    toko_id: Optional[int] = None,
    bulan: Optional[str] = None,
    status_: Optional[str] = Query(None, alias="status"),
    user=Depends(get_current_user), db=Depends(get_db),
):
    flt = {}
    if periode_id:
        flt["periode_id"] = periode_id
    if toko_id:
        flt["toko_id"] = toko_id
    if status_:
        flt["status"] = status_
    if bulan:
        flt["tanggal"] = {"$regex": f"^{re.escape(bulan)}"}
    notas = list(db.nota.find(flt).sort([("tanggal", -1), ("id", -1)]))
    if pt_id:
        allowed = {i["nota_id"] for i in db.nota_items.find({"pt_id": pt_id})}
        notas = [n for n in notas if n["id"] in allowed]
    return [_serialize_nota(db, n) for n in notas]


@api.get("/nota/{nid}")
def get_nota(nid: int, user=Depends(get_current_user), db=Depends(get_db)):
    n = db.nota.find_one({"id": nid})
    if not n:
        raise HTTPException(404)
    return _serialize_nota(db, n)


def _validate_items(items):
    seen = set()
    for it in items:
        key = (it.keterangan.strip().lower(), it.no_pp.strip().lower())
        if key in seen:
            raise HTTPException(400, f"Duplikasi keterangan + No.PP: {it.keterangan} / {it.no_pp}")
        seen.add(key)


def _insert_items(db, nota_id, items):
    for it in items:
        db.nota_items.insert_one({
            "id": next_id("nota_items"), "nota_id": nota_id, "barang": it.barang,
            "keterangan": it.keterangan, "no_pp": it.no_pp, "pt_id": it.pt_id, "total": it.total,
        })


@api.post("/nota")
def create_nota(inp: NotaIn, user=Depends(require_role("admin", "operator")), db=Depends(get_db)):
    _validate_items(inp.items)
    periode_id = inp.periode_id
    if not periode_id:
        active = db.periode.find_one({"is_active": True})
        if not active:
            raise HTTPException(400, "Belum ada periode aktif")
        periode_id = active["id"]
    last_doc = db.nota.find({"periode_id": periode_id}).sort("nomor_urut", -1).limit(1)
    last = next(iter(last_doc), {}).get("nomor_urut", 0) or 0
    nid = next_id("nota")
    db.nota.insert_one({
        "id": nid, "toko_id": inp.toko_id, "no_nota": inp.no_nota, "tanggal": inp.tanggal,
        "periode_id": periode_id, "nomor_urut": last + 1, "status": "belum_lunas",
        "created_by": user["id"], "created_at": now_utc(),
    })
    _insert_items(db, nid, inp.items)
    log_action(db, user, "create_nota", "nota", nid, detail=inp.no_nota)
    return _serialize_nota(db, db.nota.find_one({"id": nid}))


@api.put("/nota/{nid}")
def update_nota(nid: int, inp: NotaIn, user=Depends(require_role("admin", "operator")), db=Depends(get_db)):
    n = db.nota.find_one({"id": nid})
    if not n:
        raise HTTPException(404)
    _validate_items(inp.items)
    db.nota.update_one({"id": nid}, {"$set": {
        "toko_id": inp.toko_id, "no_nota": inp.no_nota, "tanggal": inp.tanggal,
    }})
    db.nota_items.delete_many({"nota_id": nid})
    _insert_items(db, nid, inp.items)
    log_action(db, user, "update_nota", "nota", nid)
    return _serialize_nota(db, db.nota.find_one({"id": nid}))


@api.delete("/nota/{nid}")
def delete_nota(nid: int, force: bool = False, user=Depends(get_current_user), db=Depends(get_db)):
    n = db.nota.find_one({"id": nid})
    if not n:
        raise HTTPException(404)
    if n.get("status") == "lunas" and user["role"] != "admin":
        raise HTTPException(403, "Nota lunas hanya bisa dihapus oleh Admin")
    if n.get("status") == "lunas" and not force:
        raise HTTPException(400, "Nota sudah lunas. Konfirmasi dengan force=true.")
    if user["role"] not in ("admin", "operator"):
        raise HTTPException(403)
    pel_list = list(db.pelunasan.find({"nota_id": nid}))
    if pel_list and not force:
        raise HTTPException(400, "Nota memiliki data pelunasan. Konfirmasi dengan force=true untuk hapus keduanya.")
    for p in pel_list:
        db.wa_log.update_many({"pelunasan_id": p["id"]}, {"$set": {"pelunasan_id": None}})
        db.pelunasan_files.delete_many({"pelunasan_id": p["id"]})
        db.pelunasan.delete_one({"id": p["id"]})
    db.nota_items.delete_many({"nota_id": nid})
    db.nota.delete_one({"id": nid})
    log_action(db, user, "delete_nota", "nota", nid, detail=f"status={n.get('status')}")
    return {"ok": True}


# ---------- Pelunasan ----------
def _serialize_pelunasan(db, p):
    n = db.nota.find_one({"id": p["nota_id"]})
    nota_data = None
    if n is not None:
        t = db.toko.find_one({"id": n["toko_id"]}) or {}
        nota_data = {"id": n["id"], "no_nota": n["no_nota"], "tanggal": n["tanggal"],
                     "toko": t.get("nama", ""), "whatsapp": t.get("whatsapp", ""),
                     "sapaan": t.get("sapaan", ""), "bank": t.get("bank", ""),
                     "rekening": t.get("rekening", ""), "atas_nama": t.get("atas_nama", "")}
    pt = db.pt.find_one({"id": p["pt_id"]})
    files = list(db.pelunasan_files.find({"pelunasan_id": p["id"]}).sort("id", 1))
    return {
        "id": p["id"], "bulan": p.get("bulan", ""), "nominal": p.get("nominal", 0),
        "tanggal_pelunasan": p.get("tanggal_pelunasan", ""), "catatan": p.get("catatan", ""),
        "nota": nota_data,
        "pt": {"id": pt["id"], "nama": pt["nama"]} if pt else None,
        "files": [
            {"id": f["id"], "filename": f["filename"], "original_name": f["original_name"],
             "mime_type": f.get("mime_type", ""), "kategori": f.get("kategori", ""), "size": f.get("size", 0)}
            for f in files
        ],
    }


@api.get("/pelunasan")
def list_pelunasan(user=Depends(get_current_user), db=Depends(get_db)):
    return [_serialize_pelunasan(db, p) for p in db.pelunasan.find().sort("id", -1)]


BULAN_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
            "Juli", "Agustus", "September", "Oktober", "November", "Desember"]


@api.post("/pelunasan")
async def create_pelunasan(
    nota_id: int = Form(...), pt_id: int = Form(...), nominal: float = Form(...),
    catatan: str = Form(""),
    bukti_transfer: List[UploadFile] = File(default=[]),
    nota_pink: List[UploadFile] = File(default=[]),
    user=Depends(require_role("admin", "operator")), db=Depends(get_db),
):
    nota = db.nota.find_one({"id": nota_id})
    if not nota:
        raise HTTPException(404, "Nota tidak ditemukan")
    try:
        y, m, _ = nota["tanggal"].split("-")
        bulan_str = f"{BULAN_ID[int(m) - 1]} {y}"
    except Exception:
        bulan_str = ""
    today = datetime.now(timezone.utc).date().isoformat()
    pid = next_id("pelunasan")
    pdoc = {"id": pid, "nota_id": nota_id, "pt_id": pt_id, "bulan": bulan_str,
            "nominal": nominal, "tanggal_pelunasan": today, "catatan": catatan,
            "created_by": user["id"], "created_at": now_utc()}
    db.pelunasan.insert_one(pdoc)

    def _save(files: List[UploadFile], kategori: str):
        for f in files or []:
            if not f.filename:
                continue
            ext = Path(f.filename).suffix
            new_name = f"{pid}_{kategori}_{uuid.uuid4().hex}{ext}"
            storage_path = f"{APP_NAME}/uploads/{pid}/{new_name}"
            content = f.file.read()
            put_object(storage_path, content, f.content_type or "application/octet-stream")
            db.pelunasan_files.insert_one({
                "id": next_id("pelunasan_files"), "pelunasan_id": pid, "filename": storage_path,
                "original_name": f.filename, "mime_type": f.content_type or "",
                "kategori": kategori, "size": len(content), "created_at": now_utc(),
            })

    _save(bukti_transfer, "bukti_transfer")
    _save(nota_pink, "nota_pink")

    db.nota.update_one({"id": nota_id}, {"$set": {"status": "lunas"}})
    log_action(db, user, "create_pelunasan", "pelunasan", pid, detail=f"nota={nota['no_nota']}")
    return _serialize_pelunasan(db, db.pelunasan.find_one({"id": pid}))


@api.get("/pelunasan/{pid}")
def get_pelunasan(pid: int, user=Depends(get_current_user), db=Depends(get_db)):
    p = db.pelunasan.find_one({"id": pid})
    if not p:
        raise HTTPException(404)
    return _serialize_pelunasan(db, p)


@api.delete("/pelunasan/{pid}")
def delete_pelunasan(pid: int, user=Depends(require_role("admin")), db=Depends(get_db)):
    p = db.pelunasan.find_one({"id": pid})
    if not p:
        raise HTTPException(404)
    db.pelunasan_files.delete_many({"pelunasan_id": pid})
    db.pelunasan.delete_one({"id": pid})
    if p.get("nota_id"):
        db.nota.update_one({"id": p["nota_id"]}, {"$set": {"status": "belum_lunas"}})
    log_action(db, user, "delete_pelunasan", "pelunasan", pid)
    return {"ok": True}


@api.get("/pelunasan/file/{fid}")
def get_file(fid: int, user=Depends(get_current_user), db=Depends(get_db)):
    f = db.pelunasan_files.find_one({"id": fid})
    if not f:
        raise HTTPException(404)
    data, ctype = get_object(f["filename"])
    return Response(content=data, media_type=f.get("mime_type") or ctype,
                    headers={"Content-Disposition": f'inline; filename="{f["original_name"]}"'})


@api.post("/pelunasan/{pid}/whatsapp")
def prepare_whatsapp(pid: int, file_ids: str = Form(""),
                     user=Depends(require_role("admin", "operator")),
                     db=Depends(get_db)):
    p = db.pelunasan.find_one({"id": pid})
    if not p:
        raise HTTPException(404)
    nota = db.nota.find_one({"id": p["nota_id"]}) or {}
    toko = db.toko.find_one({"id": nota.get("toko_id")}) or {}
    pt = db.pt.find_one({"id": p["pt_id"]}) or {}
    phone = normalize_phone(toko.get("whatsapp", ""))
    if not phone:
        raise HTTPException(400, "Toko belum punya nomor WhatsApp")
    pesan = build_message(toko.get("sapaan", ""), pt.get("nama", ""), p.get("bulan", ""),
                          template=get_wa_template(db), toko=toko.get("nama", ""),
                          no_nota=nota.get("no_nota", ""),
                          nominal=f"Rp {int(p.get('nominal') or 0):,}".replace(",", "."))
    link = build_wa_link(toko.get("whatsapp", ""), pesan)
    log_id = next_id("wa_log")
    db.wa_log.insert_one({
        "id": log_id, "pelunasan_id": pid, "nomor": phone, "pesan": pesan,
        "file_ids": "", "status": "pending", "error": "", "created_at": now_utc(),
    })
    log_action(db, user, "prepare_whatsapp", "pelunasan", pid)
    return {
        "log_id": log_id, "phone": phone, "pesan": pesan, "wa_link": link,
        "note": "Klik 'Buka WhatsApp' — pesan teks sudah otomatis terisi, tinggal tekan Kirim di WhatsApp.",
    }


@api.post("/whatsapp/log/{log_id}/status")
def update_wa_status(log_id: int, status_: str = Form(..., alias="status"), error: str = Form(""),
                     user=Depends(require_role("admin", "operator")),
                     db=Depends(get_db)):
    if not db.wa_log.find_one({"id": log_id}):
        raise HTTPException(404)
    db.wa_log.update_one({"id": log_id}, {"$set": {"status": status_, "error": error}})
    log_action(db, user, "wa_status", "wa_log", log_id, detail=status_)
    return {"ok": True}


WA_TEMPLATE_KEY = "wa_template"


def get_wa_template(db) -> str:
    s = db.settings.find_one({"key": WA_TEMPLATE_KEY})
    return (s["value"] if s and s.get("value") else DEFAULT_TEMPLATE)


@api.get("/settings/wa-template")
def read_wa_template(user=Depends(get_current_user), db=Depends(get_db)):
    return {"template": get_wa_template(db), "default": DEFAULT_TEMPLATE,
            "placeholders": PLACEHOLDERS}


@api.put("/settings/wa-template")
def update_wa_template(template: str = Form(...),
                       user=Depends(require_role("admin", "operator")),
                       db=Depends(get_db)):
    if not template.strip():
        raise HTTPException(400, "Template tidak boleh kosong")
    db.settings.update_one({"key": WA_TEMPLATE_KEY},
                           {"$set": {"value": template, "updated_at": now_utc()}},
                           upsert=True)
    log_action(db, user, "update_wa_template", "settings", WA_TEMPLATE_KEY)
    return {"template": template}


@api.get("/whatsapp/logs/{log_id}")
def get_wa_log(log_id: int, user=Depends(get_current_user), db=Depends(get_db)):
    lg = db.wa_log.find_one({"id": log_id})
    if not lg:
        raise HTTPException(404)
    return {"id": lg["id"], "status": lg.get("status", ""), "error": lg.get("error", ""),
            "nomor": lg.get("nomor", ""), "pesan": lg.get("pesan", "")}


@api.get("/whatsapp/logs")
def list_wa_logs(user=Depends(get_current_user), db=Depends(get_db)):
    return [
        {"id": l["id"], "pelunasan_id": l.get("pelunasan_id"), "nomor": l.get("nomor", ""),
         "pesan": l.get("pesan", ""), "status": l.get("status", ""), "error": l.get("error", ""),
         "created_at": l["created_at"].isoformat() if l.get("created_at") else ""}
        for l in db.wa_log.find().sort("id", -1).limit(200)
    ]


@api.get("/pelunasan/{pid}/zip")
def download_zip(pid: int, file_ids: str = "", user=Depends(get_current_user), db=Depends(get_db)):
    p = db.pelunasan.find_one({"id": pid})
    if not p:
        raise HTTPException(404)
    all_files = list(db.pelunasan_files.find({"pelunasan_id": pid}).sort("id", 1))
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in all_files:
            try:
                data, _ = get_object(f["filename"])
                zf.writestr(f["original_name"], data)
            except Exception:
                pass
    buf.seek(0)
    return StreamingResponse(
        buf, media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="pelunasan_{pid}.zip"'},
    )


# ---------- Audit ----------
@api.get("/audit")
def list_audit(user=Depends(require_role("admin")), db=Depends(get_db)):
    return [
        {"id": a["id"], "username": a.get("username", ""), "aksi": a.get("aksi", ""),
         "entity": a.get("entity", ""), "entity_id": a.get("entity_id", ""), "detail": a.get("detail", ""),
         "created_at": a["created_at"].isoformat() if a.get("created_at") else ""}
        for a in db.audit_log.find().sort("id", -1).limit(500)
    ]


# ---------- Dashboard ----------
@api.get("/dashboard/stats")
def dashboard_stats(periode_id: Optional[int] = None,
                    user=Depends(get_current_user), db=Depends(get_db)):
    active = db.periode.find_one({"is_active": True})
    pid = periode_id or (active["id"] if active else None)
    if not pid:
        return {"total_nota": 0, "total_nominal": 0, "lunas": 0, "belum_lunas": 0,
                "per_pt": [], "periode": None}
    notas = list(db.nota.find({"periode_id": pid}))
    lunas = sum(1 for n in notas if n.get("status") == "lunas")
    belum = sum(1 for n in notas if n.get("status") == "belum_lunas")
    pt_names = {p["id"]: p["nama"] for p in db.pt.find()}
    toko_names = {t["id"]: t["nama"] for t in db.toko.find()}
    per_pt = {}
    for n in notas:
        for it in db.nota_items.find({"nota_id": n["id"]}):
            nama = pt_names.get(it["pt_id"], "")
            d = per_pt.setdefault(nama, {
                "pt": nama, "pt_id": it["pt_id"], "total": 0.0,
                "total_lunas": 0.0, "total_belum": 0.0,
                "count_lunas": 0, "count_belum": 0, "notas": [],
            })
            val = float(it.get("total") or 0)
            d["total"] += val
            if n.get("status") == "lunas":
                d["total_lunas"] += val
            else:
                d["total_belum"] += val
            row = next((r for r in d["notas"] if r["nota_id"] == n["id"]), None)
            if row is None:
                row = {"nota_id": n["id"], "no_nota": n["no_nota"], "tanggal": n["tanggal"],
                       "toko": toko_names.get(n["toko_id"], ""), "status": n.get("status"), "total": 0.0}
                d["notas"].append(row)
                if n.get("status") == "lunas":
                    d["count_lunas"] += 1
                else:
                    d["count_belum"] += 1
            row["total"] += val
    for d in per_pt.values():
        d["notas"].sort(key=lambda r: (r["tanggal"] or "", r["no_nota"] or ""))
    total_nominal = sum(d["total"] for d in per_pt.values())
    periode = db.periode.find_one({"id": pid})
    return {
        "total_nota": len(notas),
        "total_nominal": total_nominal,
        "lunas": lunas,
        "belum_lunas": belum,
        "per_pt": sorted(per_pt.values(), key=lambda d: -d["total"]),
        "periode": {"id": periode["id"], "nama": periode["nama"]} if periode else None,
    }


# ---------- Export Excel ----------
@api.get("/export/excel")
def export_excel(periode_id: Optional[int] = None,
                 user=Depends(get_current_user), db=Depends(get_db)):
    active = db.periode.find_one({"is_active": True})
    pid = periode_id or (active["id"] if active else None)
    if not pid:
        raise HTTPException(400, "Belum ada periode")
    periode = db.periode.find_one({"id": pid})
    notas = list(db.nota.find({"periode_id": pid}).sort("tanggal", 1))
    pt_names = {p["id"]: p["nama"] for p in db.pt.find()}
    toko_map = {t["id"]: t for t in db.toko.find()}
    items_by_pt = {}
    for n in notas:
        t = toko_map.get(n["toko_id"], {})
        for it in db.nota_items.find({"nota_id": n["id"]}):
            row = {
                "toko": t.get("nama", ""), "no_nota": n["no_nota"], "tanggal": n["tanggal"],
                "barang": it.get("barang", "") or "", "keterangan": it["keterangan"], "no_pp": it.get("no_pp", ""),
                "bank": t.get("bank", ""), "atas_nama": t.get("atas_nama", ""),
                "rekening": t.get("rekening", ""), "total": float(it.get("total") or 0),
                "status": n.get("status"),
            }
            items_by_pt.setdefault(pt_names.get(it["pt_id"], ""), []).append(row)
    buf = build_excel(periode["nama"], items_by_pt)
    log_action(db, user, "export_excel", "periode", pid)
    fname = f"Rekap_Bon_{periode['nama'].replace(' ', '_')}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


# ---------- Backup (MongoDB snapshot stored in DB) ----------
BACKUP_COLLECTIONS = ["users", "pt", "periode", "toko", "nota", "nota_items",
                      "pelunasan", "pelunasan_files", "wa_log", "settings",
                      "sapaan", "audit_log", "counters"]


def _clean(doc):
    doc = dict(doc)
    doc.pop("_id", None)
    for k, v in list(doc.items()):
        if isinstance(v, datetime):
            doc[k] = v.isoformat()
    return doc


@api.post("/backup")
def backup(user=Depends(require_role("admin")), db=Depends(get_db)):
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    name = f"rekap_bon_{ts}.json"
    data = {c: [_clean(d) for d in db[c].find()] for c in BACKUP_COLLECTIONS}
    payload = json.dumps(data, ensure_ascii=False)
    db.backups.insert_one({
        "name": name, "created": now_utc(), "size": len(payload.encode("utf-8")),
        "data": data,
    })
    return {"file": name, "size": len(payload.encode("utf-8"))}


@api.get("/backup")
def list_backup(user=Depends(require_role("admin")), db=Depends(get_db)):
    return [
        {"name": b["name"], "size": b.get("size", 0),
         "created": b["created"].isoformat() if b.get("created") else ""}
        for b in db.backups.find().sort("created", -1)
    ]


@api.delete("/backup/{name}")
def delete_backup(name: str, user=Depends(require_role("admin")), db=Depends(get_db)):
    if ".." in name or "/" in name:
        raise HTTPException(400, "Nama file tidak valid")
    res = db.backups.delete_one({"name": name})
    if res.deleted_count == 0:
        raise HTTPException(404, "Backup tidak ditemukan")
    log_action(db, user, "delete_backup", "backup", name)
    return {"ok": True}


@api.get("/backup/download/{name}")
def download_backup(name: str, token: Optional[str] = Query(None),
                    user=Depends(require_role("admin")), db=Depends(get_db)):
    if ".." in name or "/" in name:
        raise HTTPException(404)
    b = db.backups.find_one({"name": name})
    if not b:
        raise HTTPException(404)
    payload = json.dumps(b.get("data", {}), ensure_ascii=False, indent=2)
    return Response(content=payload, media_type="application/json",
                    headers={"Content-Disposition": f'attachment; filename="{name}"'})


# ---------- init defaults ----------
def seed_defaults():
    db = get_db()
    if not db.users.find_one():
        for uname, pw, fname, role in [
            ("admin", "admin123", "Administrator", "admin"),
            ("operator", "operator123", "Operator Toko", "operator"),
            ("viewer", "viewer123", "Viewer", "user"),
        ]:
            db.users.insert_one({
                "id": next_id("users"), "username": uname, "password_hash": hash_pw(pw),
                "full_name": fname, "role": role, "is_active": True, "created_at": now_utc(),
            })
    for name in ["MAL", "SJM", "LOGPOND", "TAYAN 01", "TAYAN 04", "MSB"]:
        if not db.pt.find_one({"nama": name}):
            db.pt.insert_one({"id": next_id("pt"), "nama": name, "created_at": now_utc()})
    for name in ["Bapak", "Ibu", "Bapak/Ibu"]:
        if not db.sapaan.find_one({"nama": name}):
            db.sapaan.insert_one({"id": next_id("sapaan"), "nama": name, "created_at": now_utc()})
    if not db.periode.find_one():
        today = datetime.now(timezone.utc).date()
        db.periode.insert_one({
            "id": next_id("periode"), "nama": f"Periode {today.strftime('%B %Y')}",
            "tanggal_mulai": today.replace(day=1).isoformat(),
            "tanggal_selesai": today.isoformat(), "is_active": True,
            "is_archived": False, "created_at": now_utc(),
        })


app.include_router(api)


@app.on_event("startup")
async def _startup():
    # IMPORTANT: do not initialize MongoDB while importing this module.
    # Vercel imports api/index.py first; DB failures during import make the
    # whole Serverless Function crash with FUNCTION_INVOCATION_FAILED.
    try:
        seed_defaults()
        logger.info("Database defaults initialized")
    except Exception as e:
        logger.exception("Database initialization failed: %s", e)

    # Object storage is optional at startup. Upload/download endpoints will
    # initialize it again when needed.
    try:
        init_storage()
        logger.info("Object storage initialized")
    except Exception as e:
        logger.warning("Storage init failed: %s", e)


app.add_middleware(
    CORSMiddleware, allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"], allow_headers=["*"],
)


@app.get("/api/health")
def api_health():
    return {"ok": True, "service": "rekap-bon-toko-pinoh"}
