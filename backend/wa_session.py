"""Persistent WhatsApp Web session via Playwright for true auto-send of files."""
import asyncio
import base64
import os
from pathlib import Path

os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/root/.cache/ms-playwright")

SESSION_DIR = Path(os.environ.get("WA_SESSION_DIR", str(Path(__file__).parent / "data" / "wa_session")))
try:
    SESSION_DIR.mkdir(parents=True, exist_ok=True)
except OSError:
    # read-only filesystem (e.g. Vercel serverless) -> fall back to /tmp
    SESSION_DIR = Path("/tmp/wa_session")
    SESSION_DIR.mkdir(parents=True, exist_ok=True)

WA_URL = "https://web.whatsapp.com"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")


class WhatsAppSession:
    def __init__(self):
        self._pw = None
        self._ctx = None
        self._page = None
        self.lock = asyncio.Lock()

    async def _page_ready(self):
        if self._page and not self._page.is_closed():
            return self._page
        from playwright.async_api import async_playwright
        self._pw = await async_playwright().start()
        self._ctx = await self._pw.chromium.launch_persistent_context(
            str(SESSION_DIR),
            headless=True,
            channel="chromium",
            user_agent=UA,
            viewport={"width": 1280, "height": 900},
            args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled",
                  "--disable-gpu", "--no-first-run", "--disable-extensions",
                  "--disable-background-timer-throttling", "--disable-renderer-backgrounding"],
        )
        self._page = self._ctx.pages[0] if self._ctx.pages else await self._ctx.new_page()
        await self._page.goto(WA_URL, wait_until="domcontentloaded", timeout=60000)
        return self._page

    async def close(self):
        try:
            if self._ctx:
                await self._ctx.close()
            if self._pw:
                await self._pw.stop()
        finally:
            self._pw = self._ctx = self._page = None

    async def _is_logged_in(self, page) -> bool:
        if await page.locator('canvas[aria-label="Scan me!"], div[data-ref] canvas').count() > 0:
            return False
        for sel in ['#pane-side', '#side', 'div[aria-label="Chat list"]',
                    '[data-testid="chat-list"]', 'header [aria-label="Menu"]']:
            if await page.locator(sel).count() > 0:
                return True
        return False

    async def status(self) -> dict:
        async with self.lock:
            try:
                page = await self._page_ready()
            except Exception as e:
                return {"state": "error", "error": str(e)}
            try:
                try:
                    await page.wait_for_selector(
                        'canvas[aria-label="Scan me!"], div[data-ref] canvas, #pane-side, #side',
                        timeout=25000)
                except Exception:
                    pass
                if await self._is_logged_in(page):
                    return {"state": "connected"}
                qr = page.locator('canvas[aria-label="Scan me!"], div[data-ref] canvas, canvas').first
                if await qr.count() > 0:
                    shot = await qr.screenshot()
                    return {"state": "need_qr",
                            "qr": "data:image/png;base64," + base64.b64encode(shot).decode()}
                return {"state": "loading", "url": page.url, "title": await page.title()}
            except Exception as e:
                return {"state": "error", "error": str(e)}

    async def warmup(self):
        try:
            async with self.lock:
                await self._page_ready()
        except Exception:
            pass

    async def logout(self):
        """Keluar dari WhatsApp Web: tutup browser dan hapus data sesi."""
        import shutil
        await self.close()
        shutil.rmtree(SESSION_DIR, ignore_errors=True)
        SESSION_DIR.mkdir(parents=True, exist_ok=True)
        return {"ok": True}

    async def send_files(self, phone: str, files: list, message: str = "") -> dict:
        """files: list of (absolute_path, mime_type). Files are sent as-is (no conversion)."""
        async with self.lock:
            page = await self._page_ready()
            if not await self._is_logged_in(page):
                await page.goto(WA_URL, wait_until="domcontentloaded", timeout=60000)
                await page.wait_for_timeout(3000)
                if not await self._is_logged_in(page):
                    raise RuntimeError("Sesi WhatsApp belum login. Scan QR terlebih dahulu.")
            await page.goto(f"{WA_URL}/send?phone={phone}&text=", wait_until="domcontentloaded", timeout=60000)
            try:
                await page.wait_for_selector('footer div[contenteditable="true"]', timeout=60000)
            except Exception:
                body = (await page.inner_text("body"))[:200]
                raise RuntimeError(f"Chat {phone} tidak bisa dibuka. WA berkata: {body}")
            await page.wait_for_timeout(1500)

            images = [p for p, m in files if (m or "").startswith("image/")]
            docs = [p for p, m in files if not (m or "").startswith("image/")]

            for group, kind in ((images, "media"), (docs, "document")):
                if not group:
                    continue
                await self._attach(page, group, kind, message if kind == "media" else "")
            if not images and message:
                await self._send_text(page, message)
            return {"ok": True, "sent": len(files)}

    async def _attach(self, page, paths, kind, caption=""):
        want_image = kind == "media"
        inp = None
        # 1) coba pakai hidden file input yang sudah ada
        for sel in ('input[type="file"][accept*="image"]' if want_image
                    else 'input[type="file"][accept="*"], input[type="file"]:not([accept*="image"])',):
            loc = page.locator(sel).first
            if await loc.count() > 0:
                inp = loc
        # 2) kalau belum ada, buka menu lampiran dulu
        if inp is None:
            for sel in ['[data-testid="conversation-clip"]', 'span[data-icon="plus-rounded"]',
                        'span[data-icon="attach-menu-plus"]', 'span[data-icon="clip"]',
                        'span[data-icon="plus"]', 'button[title="Attach"]',
                        'button[aria-label="Attach"]', 'div[title="Attach"]']:
                loc = page.locator(sel).first
                if await loc.count() > 0:
                    await loc.click()
                    break
            await page.wait_for_timeout(1200)
            sel = ('input[type="file"][accept*="image"]' if want_image
                   else 'input[type="file"]:not([accept*="image"])')
            inp = page.locator(sel).first
            if await inp.count() == 0:
                inp = page.locator('input[type="file"]').last
        if await inp.count() == 0:
            raise RuntimeError("Input lampiran WhatsApp tidak ditemukan (UI WA berubah).")
        await inp.set_input_files(paths)
        await page.wait_for_timeout(4000)
        if caption:
            box = page.locator('div[contenteditable="true"][data-tab="10"], '
                               'div[contenteditable="true"][aria-label*="aption"], '
                               'div[contenteditable="true"][aria-label*="eterangan"]').first
            if await box.count() > 0:
                await box.click()
                await box.type(caption, delay=10)
                await page.wait_for_timeout(500)
        sent = await self._click_send(page)
        if not sent:
            await page.screenshot(path=str(SESSION_DIR.parent / "wa_debug.png"))
            raise RuntimeError("Tombol kirim lampiran tidak ditemukan (lihat data/wa_debug.png).")
        await page.wait_for_timeout(5000)

    SEND_SELECTORS = (
        'span[data-icon="send"]', 'span[data-icon="wds-ic-send-filled"]',
        '[data-icon*="send"]', '[data-testid="send"]',
        'div[aria-label="Send"]', 'button[aria-label="Send"]',
        'div[aria-label="Kirim"]', 'button[aria-label="Kirim"]',
        'div[role="button"][aria-label*="irim"]', 'div[role="button"][aria-label*="end"]',
    )

    async def _click_send(self, page) -> bool:
        for _ in range(3):
            for sel in self.SEND_SELECTORS:
                loc = page.locator(sel).last
                try:
                    if await loc.count() > 0 and await loc.is_visible():
                        await loc.click()
                        return True
                except Exception:
                    continue
            await page.wait_for_timeout(2000)
        # fallback: tekan Enter pada kotak caption
        try:
            await page.keyboard.press("Enter")
            await page.wait_for_timeout(2000)
            return True
        except Exception:
            return False

    async def _send_text(self, page, message):
        box = page.locator('div[contenteditable="true"][data-tab="10"], footer div[contenteditable="true"]').first
        await box.wait_for(timeout=30000)
        await box.click()
        await box.type(message, delay=10)
        await page.keyboard.press("Enter")
        await page.wait_for_timeout(1500)

wa_session = WhatsAppSession()
