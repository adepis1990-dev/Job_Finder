"""
line_editor.py — Structural editor that operates on Document dicts (JSON format).

All operations take a Document dict (as produced by doc_schema.text_to_doc) and
an instruction string, then return a modified copy or raise ValueError.

Supported instructions (case-insensitive):
  make "X" bold
  make "X" and "Y" bold
  remove bold from "X"
  make "X" italic
  remove italic from "X"
  remove bullet from "X"
  add bullet to "X"
  delete "X"  /  remove line "X"
  replace "old" with "new"
  indent "X"
  remove indent from "X"

Returns (modified_doc, message) on success.
Returns (None, reason) if no pattern matched or target not found.
"""

from __future__ import annotations
import copy
import re
from difflib import SequenceMatcher
from typing import Any

from doc_schema import block_text, spans_from_text


# ── Fuzzy matching ────────────────────────────────────────────────────────────

def _sim(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower().strip(), b.lower().strip()).ratio()


def _find_block(blocks: list[dict], query: str) -> tuple[int, float]:
    """
    Return (index, score) of the best matching non-spacer block.
    Prefers exact substring match (score=1.0) over fuzzy.
    """
    q = query.lower().strip()
    best_i, best_s = -1, 0.0
    for i, block in enumerate(blocks):
        if block["type"] == "spacer":
            continue
        plain = block_text(block).lower()
        if q and q in plain:
            return i, 1.0
        s = _sim(plain, query)
        if s > best_s:
            best_s, best_i = s, i
    return best_i, best_s


# ── Quoted-string extraction ──────────────────────────────────────────────────

def _extract_quoted(text: str) -> list[str]:
    """Return all quoted strings (straight or curly quotes, min 2 chars)."""
    return re.findall(
        r'["\u201c\u201d\u2018\u2019\u0022\u0027]'
        r'([^"\'\\u201c\u201d\u2018\u2019]{2,})'
        r'["\u201c\u201d\u2018\u2019\u0022\u0027]',
        text,
    )


def _strip_comparison(inst: str) -> str:
    """Remove 'same font/size/weight as "…"' clauses to avoid false targets."""
    inst = re.sub(
        r'\s*[,;]?\s*same\s+(font|size|weight|style|as|format)[^\'""\u201c\u201d]*'
        r'["\'\u201c\u201d][^"\'"\u201c\u201d]+["\'\u201c\u201d]',
        "", inst, flags=re.I,
    )
    inst = re.sub(
        r'\s*[,;]?\s*same\s+(font|size|weight|style|format)\s+as\s+\S[^,;]*',
        "", inst, flags=re.I,
    )
    return inst.strip()


# ── Span-level helpers ────────────────────────────────────────────────────────

def _set_span_attr(block: dict, attr: str, value: bool) -> dict:
    """Return a new block with `attr` set to `value` on every span."""
    new_block = copy.deepcopy(block)
    for span in new_block["spans"]:
        span[attr] = value
    return new_block


def _toggle_all_bold(block: dict, on: bool) -> dict:
    return _set_span_attr(block, "bold", on)


def _toggle_all_italic(block: dict, on: bool) -> dict:
    return _set_span_attr(block, "italic", on)


# ── Main entry point ──────────────────────────────────────────────────────────

def apply_direct_edit(doc: dict, instruction: str) -> tuple[dict, str] | tuple[None, str]:
    """
    Apply a structural edit to a Document dict.

    Returns (modified_doc, message) on success.
    Returns (None, reason) if the edit could not be applied.
    """
    doc = copy.deepcopy(doc)
    blocks = doc["blocks"]
    inst = instruction.strip()
    any_applied = False
    messages: list[str] = []

    # ── REPLACE "old" with "new" ──────────────────────────────────────────────
    m = re.search(
        r'replace\s+["\u201c\u201d\u0022](.+?)["\u201c\u201d\u0022]\s+with\s+'
        r'["\u201c\u201d\u0022](.+?)["\u201c\u201d\u0022]',
        inst, re.I,
    )
    if m:
        old_text, new_text = m.group(1), m.group(2)
        idx, score = _find_block(blocks, old_text)
        if score >= 0.4:
            # Replace entire block content, preserving block type
            blocks[idx]["spans"] = spans_from_text(new_text)
            any_applied = True
            messages.append(f"Replaced '{old_text[:40]}' with '{new_text[:40]}'")
        else:
            # Try inline substring replace within spans
            replaced = False
            for block in blocks:
                for span in block.get("spans", []):
                    if old_text in span["text"]:
                        span["text"] = span["text"].replace(old_text, new_text, 1)
                        replaced = True
                        break
                if replaced:
                    break
            if replaced:
                any_applied = True
                messages.append(f"Replaced '{old_text[:40]}' with '{new_text[:40]}'")
            else:
                return None, f"Could not find '{old_text}' in the document."

    # ── BOLD ──────────────────────────────────────────────────────────────────
    is_bold_op  = bool(re.search(r'\bbold\b', inst, re.I))
    is_remove   = bool(re.search(r'\b(remove|unbold|un-bold)\b', inst, re.I))
    is_make_bold = is_bold_op and not is_remove

    if is_make_bold:
        clean_inst = _strip_comparison(inst)
        targets = _extract_quoted(clean_inst)
        if not targets:
            m2 = re.search(r'make\s+(.+?)\s+bold', clean_inst, re.I)
            if m2:
                targets = [t.strip() for t in re.split(r'\s+and\s+', m2.group(1))]

        if targets:
            changed, not_found = [], []
            for target in targets:
                target = target.strip()
                if not target:
                    continue
                idx, score = _find_block(blocks, target)
                if score >= 0.3:
                    blocks[idx] = _toggle_all_bold(blocks[idx], True)
                    changed.append(target[:40])
                else:
                    not_found.append(target[:40])
            if changed:
                any_applied = True
                msg = f"Made bold: {', '.join(changed)}"
                if not_found:
                    msg += f". Could not find: {', '.join(not_found)}"
                messages.append(msg)
            elif not_found and not any_applied:
                return None, f"Could not find lines matching: {', '.join(not_found)}"
        else:
            return None, "No target lines found in instruction."

    elif is_bold_op and is_remove:
        clean_inst = _strip_comparison(inst)
        targets = _extract_quoted(clean_inst)
        if targets:
            changed = False
            for target in targets:
                idx, score = _find_block(blocks, target)
                if score >= 0.3:
                    blocks[idx] = _toggle_all_bold(blocks[idx], False)
                    changed = True
            if changed:
                any_applied = True
                messages.append("Removed bold")
            elif not any_applied:
                return None, "Lines not found for bold removal."

    # ── ITALIC ────────────────────────────────────────────────────────────────
    is_italic_op     = bool(re.search(r'\bitalic\b', inst, re.I))
    is_remove_italic = is_italic_op and bool(re.search(r'\b(remove|unitalic)\b', inst, re.I))
    is_make_italic   = is_italic_op and not is_remove_italic

    if is_make_italic:
        clean_inst = _strip_comparison(inst)
        targets = _extract_quoted(clean_inst)
        if not targets:
            m3 = re.search(r'make\s+(.+?)\s+italic', clean_inst, re.I)
            if m3:
                targets = [t.strip() for t in re.split(r'\s+and\s+', m3.group(1))]
        if targets:
            changed, not_found = [], []
            for target in targets:
                idx, score = _find_block(blocks, target)
                if score >= 0.3:
                    blocks[idx] = _toggle_all_italic(blocks[idx], True)
                    changed.append(target[:40])
                else:
                    not_found.append(target[:40])
            if changed:
                any_applied = True
                messages.append(f"Made italic: {', '.join(changed)}")
            elif not_found and not any_applied:
                return None, f"Could not find lines matching: {', '.join(not_found)}"

    elif is_italic_op and is_remove_italic:
        targets = _extract_quoted(_strip_comparison(inst))
        if targets:
            changed = False
            for target in targets:
                idx, score = _find_block(blocks, target)
                if score >= 0.3:
                    blocks[idx] = _toggle_all_italic(blocks[idx], False)
                    changed = True
            if changed:
                any_applied = True
                messages.append("Removed italic")

    # ── REMOVE BULLET ─────────────────────────────────────────────────────────
    if re.search(r'remove\s+bullet|no\s+bullet', inst, re.I):
        targets = _extract_quoted(inst)
        if not targets:
            m4 = re.search(r'remove\s+bullet\s+(?:from\s+)?(.+)', inst, re.I)
            if m4:
                targets = [m4.group(1).strip()]
        if targets:
            changed = False
            for target in targets:
                idx, score = _find_block(blocks, target)
                if score >= 0.3 and blocks[idx]["type"] == "bullet":
                    blocks[idx]["type"] = "body"
                    changed = True
            if changed:
                any_applied = True
                messages.append("Removed bullet(s)")
            elif not any_applied:
                return None, "Lines not found for bullet removal."
        elif not any_applied:
            return None, "No target specified for bullet removal."

    # ── ADD BULLET ────────────────────────────────────────────────────────────
    if re.search(r'add\s+bullet', inst, re.I):
        targets = _extract_quoted(inst)
        if not targets:
            m5 = re.search(r'add\s+bullet\s+(?:to\s+)?(.+)', inst, re.I)
            if m5:
                targets = [m5.group(1).strip()]
        if targets:
            changed = False
            for target in targets:
                idx, score = _find_block(blocks, target)
                if score >= 0.3 and blocks[idx]["type"] != "bullet":
                    blocks[idx]["type"] = "bullet"
                    changed = True
            if changed:
                any_applied = True
                messages.append("Added bullet(s)")

    # ── DELETE LINE ───────────────────────────────────────────────────────────
    if re.search(r'\b(delete|remove)\s+(line|the\s+line|this\s+line)\b', inst, re.I):
        targets = _extract_quoted(inst)
        if targets:
            indices = []
            removed = []
            for target in targets:
                idx, score = _find_block(blocks, target)
                if score >= 0.4:
                    indices.append(idx)
                    removed.append(target[:40])
            for idx in sorted(set(indices), reverse=True):
                blocks.pop(idx)
            if removed:
                any_applied = True
                messages.append(f"Deleted: {', '.join(removed)}")

    # ── INDENT / REMOVE INDENT ────────────────────────────────────────────────
    if re.search(r'\bindent\b', inst, re.I):
        remove_indent = bool(re.search(r'remove\s+indent', inst, re.I))
        targets = _extract_quoted(inst)
        if targets:
            for target in targets:
                idx, score = _find_block(blocks, target)
                if score >= 0.3:
                    # Indent: prefix first span text with spaces
                    spans = blocks[idx].get("spans", [])
                    if spans:
                        if remove_indent:
                            spans[0]["text"] = spans[0]["text"].lstrip()
                        else:
                            spans[0]["text"] = "  " + spans[0]["text"]
            any_applied = True
            messages.append("Adjusted indent")

    if any_applied:
        doc["blocks"] = blocks
        return doc, "; ".join(messages) or "ok"

    return None, "No structural edit pattern matched."
