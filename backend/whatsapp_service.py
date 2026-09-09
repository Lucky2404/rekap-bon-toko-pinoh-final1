"""
WhatsApp dispatch service.

In this cloud/preview environment, we cannot spawn a persistent browser
session with the end-user's WhatsApp Web login. Therefore we provide:

1. A prepared payload (wa.me deep-link + message) so the user's browser
   opens WhatsApp Web already in the correct chat with pre-filled text.
2. A downloadable bundle of the selected files (kept in their original
   type: JPG/PNG/PDF) that the user drops into the WhatsApp attach panel.

This is documented as the "fallback" in the spec and is the safest,
most reliable path. All operations are still logged, retryable, and
avoid mutating file types (no WebP conversion, no sticker path).
"""
from urllib.parse import quote
import re


def normalize_phone(raw: str) -> str:
    """Convert Indonesian phone numbers to E.164 without leading '+'."""
    if not raw:
        return ""
    digits = re.sub(r"\D", "", raw)
    if digits.startswith("0"):
        digits = "62" + digits[1:]
    elif digits.startswith("620"):
        digits = "62" + digits[3:]
    elif not digits.startswith("62"):
        if len(digits) >= 9 and not digits.startswith("62"):
            digits = "62" + digits
    return digits


DEFAULT_TEMPLATE = (
    "Halo {sapaan}, Ingin mengonfirmasikan bahwa kami telah melunasi nota, "
    "{pt}, dan {bulan}, dan berikut rincian nota pinknya, "
    "nota lunasnya mohon dititipkan ke bang dio ya terima kasih."
)

PLACEHOLDERS = ["{sapaan}", "{pt}", "{bulan}", "{toko}", "{no_nota}", "{nominal}"]


def render_message(template: str, ctx: dict) -> str:
    tpl = template or DEFAULT_TEMPLATE
    out = tpl
    for k, v in ctx.items():
        out = out.replace("{" + k + "}", str(v or ""))
    return out


def build_message(sapaan: str, pt_nama: str, bulan: str, template: str = "",
                  toko: str = "", no_nota: str = "", nominal="") -> str:
    return render_message(template, {
        "sapaan": sapaan or "Bapak/Ibu", "pt": pt_nama, "bulan": bulan,
        "toko": toko, "no_nota": no_nota, "nominal": nominal,
    })


def build_wa_link(phone_raw: str, message: str) -> str:
    phone = normalize_phone(phone_raw)
    return f"https://wa.me/{phone}?text={quote(message)}"
