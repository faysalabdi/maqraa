#!/usr/bin/env python3
"""
PDF → text/images extractor for the Arabic book importer (stage 1 of
scripts/import-pdf.ts).

Usage:
    python3 extract.py book.pdf [--force-ocr] [--vision] [--dpi 150]

Behaviour — a cheapest-first fallback ladder that keeps Claude's job minimal:
  1. Text layer (free). PyMuPDF; if the text carries a meaningful amount of
     Arabic (>= ~30 chars/page avg), emit mode "text". Claude only cleans it.
  2. Mistral OCR (~$1/1000 pages) when MISTRAL_API_KEY is set and the text
     layer is thin. OCR reads the pixels; the whole PDF goes up in one call and
     comes back as per-page text → emit mode "text". Claude still only cleans.
  3. Claude vision (last resort). No OCR key ⇒ render each page to a PNG and let
     Claude's vision OCR + clean from images (mode "vision"). Slow and costly.

  --force-ocr skips step 1 (jump straight to OCR/vision). --vision forces step 3
  (skip Mistral even if a key is set).

  The text paths NFKC-normalize (collapse Arabic presentation forms U+FE70-FEFF
  back to base letters) and strip tatweel. Logical-order Unicode only — never
  reshaped, never bidi-mangled.

Output (stdout), one of:
  {"mode": "text",   "pages": [{"page": 1, "text": "..."}, ...]}
  {"mode": "vision", "pages": [{"page": 1, "image_b64": "..."}, ...]}
Progress and errors go to stderr so stdout stays machine-readable.
"""

import argparse
import base64
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.request

MIN_ARABIC_CHARS_PER_PAGE = 30
TATWEEL = "ـ"  # kashida elongation noise
MISTRAL_OCR_URL = "https://api.mistral.ai/v1/ocr"
MD_IMAGE_RE = re.compile(r"!\[[^\]]*\]\([^)]*\)")  # ![img-0.jpeg](img-0.jpeg) OCR image refs


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def normalize(text: str) -> str:
    """NFKC + strip tatweel. Paragraph/whitespace cleanup happens TS-side."""
    text = unicodedata.normalize("NFKC", text)
    return text.replace(TATWEEL, "")


def count_arabic(text: str) -> int:
    return sum(1 for c in text if "؀" <= c <= "ۿ")


def extract_text_layer(path: str) -> tuple[list[dict], int]:
    import fitz  # PyMuPDF

    pages: list[dict] = []
    arabic_chars = 0
    with fitz.open(path) as doc:
        for i, page in enumerate(doc):
            text = normalize(page.get_text("text", sort=True))
            pages.append({"page": i + 1, "text": text})
            arabic_chars += count_arabic(text)
    return pages, arabic_chars


def mistral_ocr(path: str, api_key: str) -> list[dict]:
    """OCR the whole PDF in one Mistral call → per-page text dicts (mode "text").

    Sends the PDF as a base64 data URI; Mistral returns pages[].markdown. We drop
    markdown image refs, then NFKC/tatweel-normalize so the downstream Claude
    text-clean sees the same shape it gets from the PyMuPDF text path.
    """
    # A stray newline pasted into the CI secret makes an invalid HTTP header value.
    api_key = (api_key or "").strip()
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")
    body = json.dumps(
        {
            "model": "mistral-ocr-latest",
            "document": {"type": "document_url", "document_url": f"data:application/pdf;base64,{b64}"},
            "include_image_base64": False,
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        MISTRAL_OCR_URL,
        data=body,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
    )
    log("Mistral OCR: uploading PDF (one call for all pages)…")
    with urllib.request.urlopen(req, timeout=600) as resp:
        data = json.load(resp)

    raw = data.get("pages")
    if not isinstance(raw, list) or not raw:
        raise RuntimeError("Mistral OCR returned no pages")
    pages: list[dict] = []
    for p in raw:
        text = normalize(MD_IMAGE_RE.sub("", p.get("markdown", "")))
        pages.append({"page": int(p.get("index", len(pages))) + 1, "text": text})
    pages.sort(key=lambda p: p["page"])
    log(f"Mistral OCR: {len(pages)} pages")
    return pages


def render_page_images(path: str, dpi: int) -> list[dict]:
    """Render every page to a base64 PNG for the vision model."""
    import fitz

    pages: list[dict] = []
    with fitz.open(path) as doc:
        total = doc.page_count
        for i, page in enumerate(doc):
            pix = page.get_pixmap(dpi=dpi)
            b64 = base64.b64encode(pix.tobytes("png")).decode("ascii")
            pages.append({"page": i + 1, "image_b64": b64})
            if (i + 1) % 10 == 0 or i + 1 == total:
                log(f"Rendered {i + 1}/{total} pages")
    return pages


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--force-ocr", action="store_true", help="Skip the text layer; go straight to OCR/vision")
    ap.add_argument("--vision", action="store_true", help="Force Claude vision; skip Mistral OCR even if a key is set")
    ap.add_argument("--dpi", type=int, default=150, help="render resolution for scanned pages (default 150)")
    args = ap.parse_args()

    # Step 1 — free text layer.
    if not args.force_ocr:
        pages, arabic_chars = extract_text_layer(args.pdf)
        avg = arabic_chars / max(len(pages), 1)
        log(f"Text layer: {len(pages)} pages, {arabic_chars} Arabic chars ({avg:.0f}/page)")
        if avg >= MIN_ARABIC_CHARS_PER_PAGE:
            json.dump({"mode": "text", "pages": pages}, sys.stdout, ensure_ascii=False)
            return
        log("Text layer too thin — trying OCR")

    # Step 2 — cheap OCR: Mistral reads the pixels, Claude only cleans the text.
    api_key = os.environ.get("MISTRAL_API_KEY")
    if api_key and not args.vision:
        try:
            pages = mistral_ocr(args.pdf, api_key)
            json.dump({"mode": "text", "pages": pages}, sys.stdout, ensure_ascii=False)
            return
        except (urllib.error.URLError, RuntimeError, ValueError) as e:
            log(f"Mistral OCR failed ({e}) — falling back to Claude vision")
    elif not args.vision:
        log("No MISTRAL_API_KEY — falling back to Claude vision (set one for ~10x cheaper OCR)")

    # Step 3 — last resort: Claude vision OCRs + cleans from page images.
    pages = render_page_images(args.pdf, args.dpi)
    json.dump({"mode": "vision", "pages": pages}, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
