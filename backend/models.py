from sqlalchemy import (
    Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text, UniqueConstraint
)
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from database import Base


def now_utc():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(128), nullable=False, default="")
    role = Column(String(16), nullable=False, default="user")  # admin, operator, user
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=now_utc)


class PT(Base):
    __tablename__ = "pt"
    id = Column(Integer, primary_key=True, index=True)
    nama = Column(String(64), unique=True, nullable=False)
    created_at = Column(DateTime, default=now_utc)


class Periode(Base):
    __tablename__ = "periode"
    id = Column(Integer, primary_key=True, index=True)
    nama = Column(String(64), unique=True, nullable=False)
    tanggal_mulai = Column(String(32), nullable=False)  # ISO date string
    tanggal_selesai = Column(String(32), nullable=False)
    is_active = Column(Boolean, default=False)
    is_archived = Column(Boolean, default=False)
    created_at = Column(DateTime, default=now_utc)


class Toko(Base):
    __tablename__ = "toko"
    id = Column(Integer, primary_key=True, index=True)
    nama = Column(String(128), unique=True, nullable=False, index=True)
    rekening = Column(String(64), default="")
    bank = Column(String(64), default="")
    atas_nama = Column(String(128), default="")
    whatsapp = Column(String(32), default="")
    sapaan = Column(String(16), default="Bapak")  # Bapak / Ibu
    alamat = Column(Text, default="")
    created_at = Column(DateTime, default=now_utc)


class Nota(Base):
    __tablename__ = "nota"
    id = Column(Integer, primary_key=True, index=True)
    nomor_urut = Column(Integer, nullable=False, default=0)
    toko_id = Column(Integer, ForeignKey("toko.id"), nullable=False)
    periode_id = Column(Integer, ForeignKey("periode.id"), nullable=False)
    no_nota = Column(String(64), nullable=False)
    tanggal = Column(String(32), nullable=False)  # ISO date string
    status = Column(String(16), default="belum_lunas")  # belum_lunas, lunas, batal
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=now_utc)

    toko = relationship("Toko")
    periode = relationship("Periode")
    items = relationship("NotaItem", cascade="all, delete-orphan", back_populates="nota")


class NotaItem(Base):
    __tablename__ = "nota_items"
    id = Column(Integer, primary_key=True, index=True)
    nota_id = Column(Integer, ForeignKey("nota.id"), nullable=False)
    barang = Column(String(255), default="")
    keterangan = Column(Text, nullable=False)
    no_pp = Column(String(64), default="")
    pt_id = Column(Integer, ForeignKey("pt.id"), nullable=False)
    total = Column(Float, default=0.0)

    nota = relationship("Nota", back_populates="items")
    pt = relationship("PT")

    __table_args__ = (
        UniqueConstraint("nota_id", "keterangan", "no_pp", name="uq_nota_item_ket_pp"),
    )


class Pelunasan(Base):
    __tablename__ = "pelunasan"
    id = Column(Integer, primary_key=True, index=True)
    nota_id = Column(Integer, ForeignKey("nota.id"), nullable=False)
    pt_id = Column(Integer, ForeignKey("pt.id"), nullable=False)
    bulan = Column(String(16), nullable=False)  # e.g. "Juli 2026"
    nominal = Column(Float, default=0.0)
    tanggal_pelunasan = Column(String(32), default="")
    catatan = Column(Text, default="")
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=now_utc)

    nota = relationship("Nota")
    pt = relationship("PT")
    files = relationship("PelunasanFile", cascade="all, delete-orphan", back_populates="pelunasan")


class PelunasanFile(Base):
    __tablename__ = "pelunasan_files"
    id = Column(Integer, primary_key=True, index=True)
    pelunasan_id = Column(Integer, ForeignKey("pelunasan.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    original_name = Column(String(255), nullable=False)
    mime_type = Column(String(64), default="")
    kategori = Column(String(32), default="nota_pink")  # bukti_transfer, nota_pink
    size = Column(Integer, default=0)
    created_at = Column(DateTime, default=now_utc)

    pelunasan = relationship("Pelunasan", back_populates="files")


class WhatsAppLog(Base):
    __tablename__ = "wa_log"
    id = Column(Integer, primary_key=True, index=True)
    pelunasan_id = Column(Integer, ForeignKey("pelunasan.id"), nullable=True)
    nomor = Column(String(32), default="")
    pesan = Column(Text, default="")
    file_ids = Column(Text, default="")  # comma-separated file ids
    status = Column(String(16), default="pending")  # pending, success, failed
    error = Column(Text, default="")
    created_at = Column(DateTime, default=now_utc)


class Setting(Base):
    __tablename__ = "settings"
    key = Column(String(64), primary_key=True)
    value = Column(Text, default="")
    updated_at = Column(DateTime, default=now_utc, onupdate=now_utc)


class AuditLog(Base):
    __tablename__ = "audit_log"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    username = Column(String(64), default="")
    aksi = Column(String(64), nullable=False)
    detail = Column(Text, default="")
    entity = Column(String(64), default="")
    entity_id = Column(String(64), default="")
    created_at = Column(DateTime, default=now_utc)
