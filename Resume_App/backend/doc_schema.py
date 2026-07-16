"""
doc_schema.py — Document intermediate format.

Schema
------
Document:
  {
    "meta": {
      "theme":       str,   e.g. "classic"
      "tone":        str,   e.g. "professional"
      "doc_type":    str,   e.g. "resume"
      "photo_width": float  inches
    },
    "blocks": [ Block, ... ]
  }

Block (one per logical line/row):
  {
    "type":  "name" | "contact" | "section" | "jobtitle" | "body" | "bullet" | "spacer",
    "spans": [ Span, ... ]   -- always present, empty list for "spacer"
  }

Span (inline run of text with uniform style):
  {
    "text":   str,
    "bold":   bool,   default false
    "italic": bool    default false
  }

Helper functions
----------------
  text_to_doc(plain_text, meta=None)  -> Document dict
  doc_to_text(doc)                    -> plain text  (round-trip for LLM edits)
  block_text(block)                   -> plain text of one block (no markers)
  spans_from_text(text)               -> [Span] parsing <<BOLD>>…<</BOLD>> and <<ITALIC>>…<</ITALIC>>
  spans_to_rl(spans, base_font, bold_font, italic_font, bolditalic_font) -> ReportLab XML string
"""

from __future__ import annotations
import re
from typing import Any


# ── Section keyword set ───────────────────────────────────────────────────────
SECTION_KEYWORDS = {
    "EXPERIENCE", "WORK EXPERIENCE", "PROFESSIONAL EXPERIENCE", "EMPLOYMENT",
    "EDUCATION", "ACADEMIC BACKGROUND", "SKILLS", "TECHNICAL SKILLS",
    "CORE COMPETENCIES", "KEY SKILLS", "PROJECTS", "KEY PROJECTS", "PROJECT",
    "CERTIFICATIONS", "CERTIFICATES", "LANGUAGES", "AWARDS", "ACHIEVEMENTS",
    "VOLUNTEER", "PUBLICATIONS", "REFERENCES", "SUMMARY", "PROFILE",
    "PROFESSIONAL SUMMARY", "OBJECTIVE", "INTERESTS", "HOBBIES",
}


def _is_section_header(line: str) -> bool:
    s = line.strip()
    if not s:
        return False
    # Strip any leading << markers for detection
    clean = re.sub(r"<</?(?:BOLD|ITALIC)>>", "", s).strip()
    clean = re.sub(r"^#{1,3}\s+", "", clean).strip()
    if clean.isupper() and 3 < len(clean) < 60:
        return True
    if clean.upper() in SECTION_KEYWORDS:
        return True
    return False


def _is_jobtitle(line: str) -> bool:
    """Line contains a year range or pipe+year — typical job title / education row."""
    s = re.sub(r"<</?(?:BOLD|ITALIC)>>", "", line)
    return bool(
        re.search(r"\|\s*\d{4}", s) or
        re.search(r"\d{4}\s*[-–]\s*(\d{4}|present|current)", s, re.I)
    )


# ── Span helpers ──────────────────────────────────────────────────────────────

def spans_from_text(text: str) -> list[dict]:
    """
    Parse inline <<BOLD>>…<</BOLD>> and <<ITALIC>>…<</ITALIC>> markers
    into a list of Span dicts.  Markers may be nested.
    """
    spans: list[dict] = []
    # Tokenise on any marker
    pattern = re.compile(r"(<<BOLD>>|<</BOLD>>|<<ITALIC>>|<</ITALIC>>)")
    bold = False
    italic = False
    buf = ""

    for part in pattern.split(text):
        if part == "<<BOLD>>":
            if buf:
                spans.append({"text": buf, "bold": bold, "italic": italic})
                buf = ""
            bold = True
        elif part == "<</BOLD>>":
            if buf:
                spans.append({"text": buf, "bold": bold, "italic": italic})
                buf = ""
            bold = False
        elif part == "<<ITALIC>>":
            if buf:
                spans.append({"text": buf, "bold": bold, "italic": italic})
                buf = ""
            italic = True
        elif part == "<</ITALIC>>":
            if buf:
                spans.append({"text": buf, "bold": bold, "italic": italic})
                buf = ""
            italic = False
        else:
            buf += part

    if buf:
        spans.append({"text": buf, "bold": bold, "italic": italic})

    # Drop empty spans
    return [s for s in spans if s["text"]]


def block_text(block: dict) -> str:
    """Return the plain text of a block (all spans concatenated, no markers)."""
    if block["type"] == "spacer":
        return ""
    prefix = "- " if block["type"] == "bullet" else ""
    return prefix + "".join(s["text"] for s in block.get("spans", []))


def _spans_to_marker_text(spans: list[dict]) -> str:
    """Re-encode spans back to <<BOLD>>…<</BOLD>> text for round-trip."""
    parts = []
    for span in spans:
        t = span["text"]
        if span.get("italic"):
            t = f"<<ITALIC>>{t}<</ITALIC>>"
        if span.get("bold"):
            t = f"<<BOLD>>{t}<</BOLD>>"
        parts.append(t)
    return "".join(parts)


def _esc_xml(t: str) -> str:
    return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def spans_to_rl(spans: list[dict],
                base_font: str,
                bold_font: str,
                italic_font: str,
                bolditalic_font: str) -> str:
    """
    Convert a list of Span dicts to a ReportLab Paragraph XML string.
    Uses explicit <font> tags so bold works regardless of the base style's fontName.
    """
    parts = []
    for span in spans:
        text = _esc_xml(span["text"])
        b = span.get("bold", False)
        i = span.get("italic", False)
        if b and i:
            font = bolditalic_font
        elif b:
            font = bold_font
        elif i:
            font = italic_font
        else:
            font = base_font
        if font != base_font or b or i:
            parts.append(f'<font name="{font}">{text}</font>')
        else:
            parts.append(text)
    return "".join(parts)


# ── text_to_doc ───────────────────────────────────────────────────────────────

def text_to_doc(plain_text: str, meta: dict | None = None) -> dict:
    """
    Parse LLM plain text output (with optional <<BOLD>>/<<ITALIC>> markers from
    the line editor) into a structured Document dict.

    The first non-header line becomes the "name" block.
    Following non-header, non-blank lines before the first section become "contact".
    """
    meta = meta or {}
    blocks: list[dict] = []
    name_written = False
    in_contact = False

    for raw_line in plain_text.split("\n"):
        s = raw_line.strip()

        # Blank line
        if not s:
            blocks.append({"type": "spacer", "spans": []})
            in_contact = False
            continue

        # Strip leading markdown-heading characters (## EXPERIENCE → EXPERIENCE)
        clean = re.sub(r"^#{1,3}\s+", "", s).strip()
        is_hdr = _is_section_header(clean)

        # Name (first non-header line)
        if not name_written and not is_hdr:
            blocks.append({"type": "name", "spans": spans_from_text(clean)})
            name_written = True
            in_contact = True
            continue

        # Contact lines (before first section header)
        if in_contact and not is_hdr:
            blocks.append({"type": "contact", "spans": spans_from_text(clean)})
            continue

        # Section header
        if is_hdr:
            in_contact = False
            header_text = re.sub(r"<</?(?:BOLD|ITALIC)>>", "", clean).upper()
            blocks.append({"type": "section", "spans": [{"text": header_text, "bold": True, "italic": False}]})
            continue

        # Bullet
        if s.startswith(("- ", "• ", "* ")):
            inner = re.sub(r"^[-•*]\s+", "", clean)
            blocks.append({"type": "bullet", "spans": spans_from_text(inner)})
            continue

        # Job title / education row
        if _is_jobtitle(clean):
            blocks.append({"type": "jobtitle", "spans": spans_from_text(clean)})
            continue

        # Generic body line
        blocks.append({"type": "body", "spans": spans_from_text(clean)})

    return {"meta": meta, "blocks": blocks}


# ── doc_to_text ───────────────────────────────────────────────────────────────

def doc_to_text(doc: dict) -> str:
    """
    Serialise a Document back to plain text with <<BOLD>>/<<ITALIC>> markers.
    Used to store in DB and feed back to the LLM for further edits.
    """
    lines = []
    for block in doc.get("blocks", []):
        btype = block["type"]
        if btype == "spacer":
            lines.append("")
            continue
        marker_text = _spans_to_marker_text(block.get("spans", []))
        if btype == "bullet":
            lines.append("- " + marker_text)
        else:
            lines.append(marker_text)
    return "\n".join(lines)
