from __future__ import annotations
import json, os, re, io, tempfile, shutil, smtplib
from typing import Optional
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
import pdfplumber, fitz
from PIL import Image as PILImage

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, HRFlowable,
    Image as RLImage, Table, TableStyle,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_LEFT, TA_CENTER

import db
import line_editor
from doc_schema import text_to_doc, doc_to_text, spans_to_rl, block_text

# ── Fonts ─────────────────────────────────────────────────────────────────────
FONT_DIR = os.path.join(os.path.dirname(__file__), "fonts")
pdfmetrics.registerFont(TTFont("Arial",            os.path.join(FONT_DIR, "Arial.ttf")))
pdfmetrics.registerFont(TTFont("Arial-Bold",       os.path.join(FONT_DIR, "Arial-Bold.ttf")))
pdfmetrics.registerFont(TTFont("Arial-Italic",     os.path.join(FONT_DIR, "Arial-Italic.ttf")))
pdfmetrics.registerFont(TTFont("Arial-BoldItalic", os.path.join(FONT_DIR, "Arial-BoldItalic.ttf")))
pdfmetrics.registerFont(TTFont("Calibri",          os.path.join(FONT_DIR, "Calibri.ttf")))
pdfmetrics.registerFont(TTFont("Calibri-Bold",     os.path.join(FONT_DIR, "Calibri-Bold.ttf")))
pdfmetrics.registerFont(TTFont("Calibri-Italic",   os.path.join(FONT_DIR, "Calibri-Italic.ttf")))

from reportlab.pdfbase.pdfmetrics import registerFontFamily
registerFontFamily("Arial",   normal="Arial",   bold="Arial-Bold",
                   italic="Arial-Italic",   boldItalic="Arial-BoldItalic")
registerFontFamily("Calibri", normal="Calibri", bold="Calibri-Bold",
                   italic="Calibri-Italic", boldItalic="Calibri-Bold")

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI()
app.add_middleware(CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "https://buyatree.org", "https://www.buyatree.org"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# ── Auth Middleware ───────────────────────────────────────────────────────────
import jwt
import hashlib
import secrets
from fastapi import Request, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")
LOCAL_JWT_SECRET = os.getenv("LOCAL_JWT_SECRET", "resume-app-local-secret-change-me")
security = HTTPBearer(auto_error=False)

# ── Local Users with Role Levels ──────────────────────────────────────────────
# Level 1: Resume App only
# Level 2: Resume App + Email/Mailer
# Level 3: All (Resume + Email + Scraper)
LOCAL_USERS = {
    "user": {"password": "password", "level": 1, "name": "Default User"},
    "admin": {"password": os.getenv("ADMIN_PASSWORD", "admin12345qwert"), "level": 3, "name": "Admin"},
}

# Add custom users from env: USER_<name>=<password>:<level>
for key, val in os.environ.items():
    if key.startswith("USER_") and ":" in val:
        uname = key[5:].lower()
        parts = val.split(":")
        LOCAL_USERS[uname] = {"password": parts[0], "level": int(parts[1]) if len(parts) > 1 else 1, "name": uname.title()}


@app.post("/auth/login")
def local_login(username: str = Form(...), password: str = Form(...)):
    """Login with local username/password. Returns JWT with user level and unique session ID."""
    user = LOCAL_USERS.get(username.lower())
    if not user or user["password"] != password:
        raise HTTPException(401, "Invalid username or password")

    # Generate a unique session ID for this login
    import time
    import uuid
    session_id = str(uuid.uuid4())[:8]  # Short unique ID per session

    payload = {
        "sub": username.lower(),
        "name": user["name"],
        "level": user["level"],
        "session_id": session_id,
        "type": "local",
        "iat": int(time.time()),
        "exp": int(time.time()) + 86400 * 7,  # 7 days
    }
    token = jwt.encode(payload, LOCAL_JWT_SECRET, algorithm="HS256")
    return {
        "access_token": token,
        "user": {"username": username.lower(), "name": user["name"], "level": user["level"], "session_id": session_id},
    }


@app.get("/auth/me")
def get_current_user(request: Request):
    """Get current user info from token."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return {"user": None, "level": 0}
    token = auth_header.replace("Bearer ", "")
    # Try local JWT first
    try:
        payload = jwt.decode(token, LOCAL_JWT_SECRET, algorithms=["HS256"])
        return {"user": {"username": payload["sub"], "name": payload.get("name", ""), "level": payload.get("level", 1)}}
    except Exception:
        pass
    # Try Supabase JWT
    if SUPABASE_JWT_SECRET:
        try:
            payload = jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"], audience="authenticated")
            return {"user": {"username": payload.get("email", ""), "name": payload.get("email", ""), "level": 3}}
        except Exception:
            pass
    return {"user": None, "level": 0}


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify Supabase JWT token. Returns user payload or raises 401."""
    if not credentials:
        raise HTTPException(401, "Not authenticated")
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"], audience="authenticated")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(401, f"Invalid token: {e}")

# Public routes that don't need auth
PUBLIC_PATHS = {"/health", "/docs", "/openapi.json", "/redoc", "/auth/login", "/auth/me"}

@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    """Protect all routes except health and docs.
    If SUPABASE_JWT_SECRET is set and a token is provided, verify it.
    If no token is provided, still allow (frontend handles auth gate).
    Set STRICT_AUTH=true in .env to reject requests without token.
    """
    from fastapi.responses import JSONResponse
    path = request.url.path
    # Skip auth for public paths and OPTIONS (CORS preflight)
    if path in PUBLIC_PATHS or request.method == "OPTIONS":
        return await call_next(request)
    # If no JWT secret configured, skip auth entirely (dev mode)
    if not SUPABASE_JWT_SECRET:
        return await call_next(request)
    # Check Authorization header
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        # Allow unauthenticated requests unless strict mode is on
        strict = os.getenv("STRICT_AUTH", "").lower() == "true"
        if strict:
            return JSONResponse(status_code=401, content={"detail": "Not authenticated"})
        return await call_next(request)
    # Verify token if provided
    token = auth_header.replace("Bearer ", "")
    # Try local JWT first, then Supabase JWT
    valid = False
    try:
        jwt.decode(token, LOCAL_JWT_SECRET, algorithms=["HS256"])
        valid = True
    except Exception:
        pass
    if not valid and SUPABASE_JWT_SECRET:
        try:
            jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"], audience="authenticated")
            valid = True
        except Exception:
            pass
    if not valid:
        # Allow anyway if not strict mode
        strict = os.getenv("STRICT_AUTH", "").lower() == "true"
        if strict:
            return JSONResponse(status_code=401, content={"detail": "Invalid or expired token"})
    return await call_next(request)


groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

UC_PATH = os.path.join(os.path.dirname(__file__), "use_cases.json")

def load_use_cases() -> dict:
    with open(UC_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

# ── Themes ────────────────────────────────────────────────────────────────────
THEMES = {
    "original": {"layout": "classic",  "accent": "#1a1a2e", "text": "#222", "muted": "#666",
                 "fn": "Arial", "fn_bold": "Arial-Bold", "fn_italic": "Arial-Italic",
                 "fn_bi": "Arial-BoldItalic", "name_size": 18, "body_size": 10},
    "classic":  {"layout": "classic",  "accent": "#1a1a2e", "text": "#222", "muted": "#666",
                 "fn": "Arial", "fn_bold": "Arial-Bold", "fn_italic": "Arial-Italic",
                 "fn_bi": "Arial-BoldItalic", "name_size": 18, "body_size": 10},
    "modern":   {"layout": "banner",   "accent": "#2563eb", "text": "#1e293b", "muted": "#64748b",
                 "fn": "Calibri", "fn_bold": "Calibri-Bold", "fn_italic": "Calibri-Italic",
                 "fn_bi": "Calibri-Bold", "name_size": 22, "body_size": 10},
    "sidebar":  {"layout": "sidebar",  "accent": "#0f4c81", "text": "#1a1a1a", "muted": "#e0e8f0",
                 "fn": "Calibri", "fn_bold": "Calibri-Bold", "fn_italic": "Calibri-Italic",
                 "fn_bi": "Calibri-Bold", "name_size": 20, "body_size": 10},
    "minimal":  {"layout": "centered", "accent": "#111",    "text": "#333",   "muted": "#888",
                 "fn": "Arial", "fn_bold": "Arial-Bold", "fn_italic": "Arial-Italic",
                 "fn_bi": "Arial-BoldItalic", "name_size": 20, "body_size": 10},
    "elegant":  {"layout": "banner",   "accent": "#7c3aed", "text": "#1f1f1f", "muted": "#6b7280",
                 "fn": "Calibri", "fn_bold": "Calibri-Bold", "fn_italic": "Calibri-Italic",
                 "fn_bi": "Calibri-Bold", "name_size": 22, "body_size": 10},
    "blue":     {"layout": "blue",     "accent": "#2b3a55", "text": "#1a1a2e", "muted": "#6b7a8d",
                 "fn": "Calibri", "fn_bold": "Calibri-Bold", "fn_italic": "Calibri-Italic",
                 "fn_bi": "Calibri-Bold", "name_size": 24, "body_size": 10},
}

# ── Style factory ─────────────────────────────────────────────────────────────
def make_styles(t: dict, name_align=TA_LEFT) -> dict:
    acc = colors.HexColor(t["accent"])
    txt = colors.HexColor(t["text"])
    mut = colors.HexColor(t["muted"])
    fn, fnb, fni = t["fn"], t["fn_bold"], t["fn_italic"]
    ns, bs = t["name_size"], t["body_size"]
    return {
        "name":      ParagraphStyle("Name",    fontName=fnb, fontSize=ns,   leading=ns+4, textColor=acc, alignment=name_align, spaceAfter=2),
        "contact":   ParagraphStyle("Contact", fontName=fn,  fontSize=bs-1, leading=13,   textColor=mut, alignment=name_align, spaceAfter=1),
        "section":   ParagraphStyle("Section", fontName=fnb, fontSize=bs,   leading=13,   textColor=acc, spaceBefore=10, spaceAfter=2),
        "jobtitle":  ParagraphStyle("Job",     fontName=fn,  fontSize=bs,   leading=14,   textColor=txt, spaceAfter=1),
        "body":      ParagraphStyle("Body",    fontName=fn,  fontSize=bs,   leading=14,   textColor=txt, spaceAfter=2),
        "bullet":    ParagraphStyle("Bullet",  fontName=fn,  fontSize=bs,   leading=14,   textColor=txt, spaceAfter=2, leftIndent=14, firstLineIndent=-10),
        # White variants for sidebar/banner
        "name_w":    ParagraphStyle("NameW",   fontName=fnb, fontSize=ns-2, leading=ns+2, textColor=colors.white, spaceAfter=2),
        "contact_w": ParagraphStyle("ContW",   fontName=fn,  fontSize=bs-1, leading=13,   textColor=colors.HexColor("#cce0ff"), spaceAfter=1),
        "body_w":    ParagraphStyle("BodyW",   fontName=fn,  fontSize=bs-1, leading=13,   textColor=colors.HexColor("#ddeeff"), spaceAfter=2),
        "bullet_w":  ParagraphStyle("BulW",    fontName=fn,  fontSize=bs-1, leading=13,   textColor=colors.HexColor("#ddeeff"), spaceAfter=2, leftIndent=10, firstLineIndent=-8),
        "section_w": ParagraphStyle("SecW",    fontName=fnb, fontSize=bs,   leading=13,   textColor=colors.white, spaceBefore=12, spaceAfter=2),
        "jobtitle_w":ParagraphStyle("JobW",    fontName=fn,  fontSize=bs,   leading=14,   textColor=colors.HexColor("#ddeeff"), spaceAfter=1),
    }

# ── Block → ReportLab paragraph ───────────────────────────────────────────────
def _block_to_para(block: dict, style: ParagraphStyle, t: dict) -> Paragraph:
    """Render a block's spans into a ReportLab Paragraph with correct bold/italic."""
    xml = spans_to_rl(block.get("spans", []),
                      base_font=t["fn"], bold_font=t["fn_bold"],
                      italic_font=t["fn_italic"], bolditalic_font=t["fn_bi"])
    return Paragraph(xml, style)

# ── Token renderer ────────────────────────────────────────────────────────────
def render_blocks(blocks: list[dict], st: dict, t: dict,
                  skip: set | None = None, white: bool = False) -> list:
    skip = skip or set()
    story = []
    sn  = "section_w"  if white else "section"
    bn  = "body_w"     if white else "body"
    bln = "bullet_w"   if white else "bullet"
    jn  = "jobtitle_w" if white else "jobtitle"

    for block in blocks:
        btype = block["type"]
        if btype in skip:
            continue
        if btype == "spacer":
            story.append(Spacer(1, 3))
        elif btype == "name":
            story.append(_block_to_para(block, st["name_w" if white else "name"], t))
        elif btype == "contact":
            story.append(_block_to_para(block, st["contact_w" if white else "contact"], t))
        elif btype == "section":
            story.append(Spacer(1, 4))
            story.append(_block_to_para(block, st[sn], t))
            story.append(HRFlowable(width="100%", thickness=0.5,
                color=colors.HexColor("#aaccee") if white else st["section"].textColor,
                spaceAfter=3))
        elif btype == "jobtitle":
            story.append(_block_to_para(block, st[jn], t))
        elif btype == "bullet":
            # Prepend bullet character via XML so spans still render correctly
            spans_xml = spans_to_rl(block.get("spans", []),
                                    base_font=t["fn"], bold_font=t["fn_bold"],
                                    italic_font=t["fn_italic"], bolditalic_font=t["fn_bi"])
            story.append(Paragraph(f"• {spans_xml}", st[bln]))
        elif btype == "body":
            story.append(_block_to_para(block, st[bn], t))
    return story

# ── Photo helpers ─────────────────────────────────────────────────────────────
def photo_dims(path: str, target_h: float, max_w: float):
    try:
        with PILImage.open(path) as img:
            pw, ph = img.size
        ratio = pw / ph
        w = min(target_h * ratio, max_w)
        return w, w / ratio
    except Exception:
        return target_h, target_h

# ── Layout builders ───────────────────────────────────────────────────────────
def build_classic(doc, blocks, st, t, photo_path, photo_w):
    MARGIN = 0.65 * inch
    CW = letter[0] - 2 * MARGIN
    story = []
    if photo_path:
        pw, ph = photo_dims(photo_path, photo_w * inch, photo_w * inch * 1.6)
        img = RLImage(photo_path, width=pw, height=ph)
        name_contact = [_block_to_para(b, st["name" if b["type"]=="name" else "contact"], t)
                        for b in blocks if b["type"] in ("name", "contact")]
        gap = 0.12 * inch
        hdr = Table([[name_contact, img]], colWidths=[CW - pw - gap, pw + gap])
        hdr.setStyle(TableStyle([
            ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
            ("LEFTPADDING",(0,0),(-1,-1),0), ("RIGHTPADDING",(0,0),(-1,-1),0),
            ("TOPPADDING",(0,0),(-1,-1),0),  ("BOTTOMPADDING",(0,0),(-1,-1),6),
            ("ALIGN",(1,0),(1,0),"RIGHT"),
        ]))
        story.append(hdr)
        story.append(HRFlowable(width="100%", thickness=0.5,
            color=colors.HexColor(t["accent"]), spaceAfter=6))
        skip = {"name", "contact"}
    else:
        skip = set()
    story += render_blocks(blocks, st, t, skip=skip)
    doc.build(story)

def build_banner(doc, blocks, st, t, photo_path, photo_w):
    MARGIN = 0.65 * inch
    CW = letter[0] - 2 * MARGIN
    acc = colors.HexColor(t["accent"])
    bname = ParagraphStyle("BN", fontName=t["fn_bold"], fontSize=t["name_size"],
        leading=t["name_size"]+4, textColor=colors.white, spaceAfter=2)
    bcont = ParagraphStyle("BC", fontName=t["fn"], fontSize=t["body_size"]-1,
        leading=13, textColor=colors.HexColor("#ddeeff"), spaceAfter=1)
    header_paras = []
    for b in blocks:
        if b["type"] == "name":
            header_paras.append(_block_to_para(b, bname, t))
        elif b["type"] == "contact":
            header_paras.append(_block_to_para(b, bcont, t))
    story = []
    if photo_path:
        pw, ph = photo_dims(photo_path, photo_w * inch, photo_w * inch * 1.6)
        img = RLImage(photo_path, width=pw, height=ph)
        gap = 0.15 * inch
        tbl = Table([[header_paras, img]], colWidths=[CW - pw - gap, pw + gap])
        tbl.setStyle(TableStyle([
            ("BACKGROUND",(0,0),(-1,-1),acc),
            ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
            ("LEFTPADDING",(0,0),(0,0),14), ("RIGHTPADDING",(0,0),(-1,-1),8),
            ("TOPPADDING",(0,0),(-1,-1),14),("BOTTOMPADDING",(0,0),(-1,-1),14),
        ]))
    else:
        tbl = Table([[header_paras]], colWidths=[CW])
        tbl.setStyle(TableStyle([
            ("BACKGROUND",(0,0),(-1,-1),acc),
            ("LEFTPADDING",(0,0),(-1,-1),14),
            ("TOPPADDING",(0,0),(-1,-1),14), ("BOTTOMPADDING",(0,0),(-1,-1),14),
        ]))
    story.append(tbl)
    story.append(Spacer(1, 10))
    story += render_blocks(blocks, st, t, skip={"name", "contact", "spacer"})
    doc.build(story)

def build_sidebar(output_path, blocks, st, t, photo_path, photo_w):
    SW = 2.1 * inch
    CW = letter[0] - SW
    PAD = 0.18 * inch
    acc = colors.HexColor(t["accent"])
    sb = []
    if photo_path:
        avail = SW - 2 * PAD
        pw, ph = photo_dims(photo_path, photo_w * inch, avail)
        img = RLImage(photo_path, width=pw, height=ph)
        ct = Table([[img]], colWidths=[avail])
        ct.setStyle(TableStyle([("ALIGN",(0,0),(-1,-1),"CENTER"),
            ("LEFTPADDING",(0,0),(-1,-1),0), ("RIGHTPADDING",(0,0),(-1,-1),0),
            ("TOPPADDING",(0,0),(-1,-1),16),  ("BOTTOMPADDING",(0,0),(-1,-1),10)]))
        sb.append(ct)
    sidebar_blocks = [b for b in blocks if b["type"] in ("name", "contact")]
    sb += render_blocks(sidebar_blocks, st, t, white=True)
    sb.append(Spacer(1, 8))
    sb.append(HRFlowable(width="100%", thickness=0.5,
        color=colors.HexColor("#aaccee"), spaceAfter=6))
    sb_tbl = Table([[sb]], colWidths=[SW - 2*PAD])
    sb_tbl.setStyle(TableStyle([
        ("LEFTPADDING",(0,0),(-1,-1),int(PAD)), ("RIGHTPADDING",(0,0),(-1,-1),int(PAD)),
        ("TOPPADDING",(0,0),(-1,-1),0),          ("BOTTOMPADDING",(0,0),(-1,-1),0)]))
    main_blocks = [b for b in blocks if b["type"] not in ("name", "contact")]
    mn = render_blocks(main_blocks, st, t)
    mn_tbl = Table([[mn]], colWidths=[CW - 2*PAD])
    mn_tbl.setStyle(TableStyle([
        ("LEFTPADDING",(0,0),(-1,-1),int(PAD)), ("RIGHTPADDING",(0,0),(-1,-1),int(PAD)),
        ("TOPPADDING",(0,0),(-1,-1),14),         ("BOTTOMPADDING",(0,0),(-1,-1),0),
        ("VALIGN",(0,0),(-1,-1),"TOP")]))
    layout = Table([[sb_tbl, mn_tbl]], colWidths=[SW, CW])
    layout.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(0,-1),acc),
        ("VALIGN",(0,0),(-1,-1),"TOP"),
        ("LEFTPADDING",(0,0),(-1,-1),0), ("RIGHTPADDING",(0,0),(-1,-1),0),
        ("TOPPADDING",(0,0),(-1,-1),0),  ("BOTTOMPADDING",(0,0),(-1,-1),0)]))
    rl_doc = SimpleDocTemplate(output_path, pagesize=letter,
        rightMargin=0, leftMargin=0, topMargin=0, bottomMargin=0.5*inch)
    rl_doc.build([layout])

def build_centered(doc, blocks, st, t, photo_path, photo_w):
    MARGIN = 0.75 * inch
    CW = letter[0] - 2 * MARGIN
    acc = colors.HexColor(t["accent"])
    cn = ParagraphStyle("CN", fontName=t["fn_bold"], fontSize=t["name_size"],
        leading=t["name_size"]+4, textColor=acc, alignment=TA_CENTER, spaceAfter=2)
    cc = ParagraphStyle("CC", fontName=t["fn"], fontSize=t["body_size"]-1,
        leading=13, textColor=colors.HexColor(t["muted"]), alignment=TA_CENTER, spaceAfter=1)
    story = []
    if photo_path:
        pw, ph = photo_dims(photo_path, photo_w * inch, photo_w * inch * 1.6)
        img = RLImage(photo_path, width=pw, height=ph)
        ct = Table([[img]], colWidths=[CW])
        ct.setStyle(TableStyle([("ALIGN",(0,0),(-1,-1),"CENTER"),
            ("TOPPADDING",(0,0),(-1,-1),4), ("BOTTOMPADDING",(0,0),(-1,-1),8),
            ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0)]))
        story.append(ct)
    for b in blocks:
        if b["type"] == "name":
            story.append(_block_to_para(b, cn, t))
        elif b["type"] == "contact":
            story.append(_block_to_para(b, cc, t))
        else:
            break
    story.append(HRFlowable(width="40%", thickness=1.5, color=acc, spaceAfter=8, hAlign="CENTER"))
    story += render_blocks(blocks, st, t, skip={"name", "contact", "spacer"})
    doc.build(story)

# ── Blue layout (two-column executive style with rounded photo) ───────────────
def build_blue(output_path, blocks, st, t, photo_path, photo_w):
    """
    Executive two-column layout inspired by the 'blue' theme:
    - Left column: Photo (circular mask), contact info, languages, expertise
    - Right column: Name header, experience, education, skills
    - Dark navy accent color for section headers
    """
    from reportlab.lib.utils import ImageReader

    PW, PH = letter
    LEFT_W = 2.4 * inch
    RIGHT_W = PW - LEFT_W
    PAD = 0.2 * inch
    acc = colors.HexColor(t["accent"])
    txt = colors.HexColor(t["text"])
    mut = colors.HexColor(t["muted"])
    fn, fnb, fni = t["fn"], t["fn_bold"], t["fn_italic"]

    # Separate blocks into left (contact, about) and right (sections, experience)
    left_blocks = []
    right_blocks = []
    header_blocks = []  # name + contact (first ones)

    in_header = True
    left_sections = {"LANGUAGE", "LANGUAGES", "EXPERTISE", "SKILLS", "TECHNICAL SKILLS",
                     "CORE COMPETENCIES", "KEY SKILLS", "INTERESTS", "HOBBIES",
                     "CERTIFICATIONS", "CERTIFICATES", "ABOUT ME", "PROFILE", "SUMMARY"}

    current_section_name = ""
    for block in blocks:
        if block["type"] == "name" and in_header:
            header_blocks.append(block)
            continue
        if block["type"] == "contact" and in_header:
            left_blocks.append(block)
            continue
        if block["type"] == "section":
            in_header = False
            section_text = "".join(s.get("text", "") for s in block.get("spans", [])).upper().strip()
            current_section_name = section_text
            if section_text in left_sections:
                left_blocks.append(block)
            else:
                right_blocks.append(block)
            continue
        in_header = False
        if current_section_name in left_sections:
            left_blocks.append(block)
        else:
            right_blocks.append(block)

    # Build left column content
    left_story = []

    # Photo (circular crop effect using clipping)
    if photo_path:
        avail = LEFT_W - 2 * PAD
        pw, ph = photo_dims(photo_path, photo_w * inch, avail)
        # Make it square for circular appearance
        size = min(pw, ph, avail * 0.8)
        img = RLImage(photo_path, width=size, height=size)
        # Wrap in a table for centering
        ct = Table([[img]], colWidths=[avail])
        ct.setStyle(TableStyle([
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 18),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ]))
        left_story.append(ct)

    # Left column blocks (contact, skills, languages)
    left_story += render_blocks(left_blocks, st, t, white=True)

    # Build right column content
    right_story = []

    # Name (large, dark navy)
    name_style = ParagraphStyle("BlueName", fontName=fnb, fontSize=t["name_size"],
        leading=t["name_size"] + 6, textColor=acc, spaceAfter=4)
    for b in header_blocks:
        right_story.append(_block_to_para(b, name_style, t))

    right_story.append(Spacer(1, 6))

    # Right column sections (experience, education)
    for block in right_blocks:
        btype = block["type"]
        if btype == "section":
            right_story.append(Spacer(1, 8))
            # Section header with colored background pill
            sec_style = ParagraphStyle("BlueSec", fontName=fnb, fontSize=10,
                leading=14, textColor=colors.white, alignment=TA_CENTER)
            sec_para = _block_to_para(block, sec_style, t)
            sec_tbl = Table([[sec_para]], colWidths=[RIGHT_W - 2 * PAD - 0.3 * inch])
            sec_tbl.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), acc),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("ROUNDEDCORNERS", [4, 4, 4, 4]),
            ]))
            right_story.append(sec_tbl)
            right_story.append(Spacer(1, 6))
        elif btype == "jobtitle":
            jt_style = ParagraphStyle("BlueJob", fontName=fnb, fontSize=10,
                leading=13, textColor=txt, spaceAfter=1)
            right_story.append(_block_to_para(block, jt_style, t))
        elif btype == "bullet":
            bul_style = ParagraphStyle("BlueBul", fontName=fn, fontSize=9,
                leading=12, textColor=txt, leftIndent=12, firstLineIndent=-8, spaceAfter=2)
            spans_xml = spans_to_rl(block.get("spans", []),
                base_font=fn, bold_font=fnb, italic_font=fni, bolditalic_font=t["fn_bi"])
            right_story.append(Paragraph(f"• {spans_xml}", bul_style))
        elif btype == "body":
            body_style = ParagraphStyle("BlueBody", fontName=fn, fontSize=9,
                leading=12, textColor=txt, spaceAfter=2)
            right_story.append(_block_to_para(block, body_style, t))
        elif btype == "spacer":
            right_story.append(Spacer(1, 4))

    # Assemble two-column layout
    left_tbl = Table([[left_story]], colWidths=[LEFT_W - 2 * PAD])
    left_tbl.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), int(PAD)),
        ("RIGHTPADDING", (0, 0), (-1, -1), int(PAD)),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))

    right_tbl = Table([[right_story]], colWidths=[RIGHT_W - 2 * PAD])
    right_tbl.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), int(PAD)),
        ("RIGHTPADDING", (0, 0), (-1, -1), int(PAD)),
        ("TOPPADDING", (0, 0), (-1, -1), 18),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))

    layout = Table([[left_tbl, right_tbl]], colWidths=[LEFT_W, RIGHT_W])
    layout.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f0f4f8")),  # light grey-blue left bg
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    rl_doc = SimpleDocTemplate(output_path, pagesize=letter,
        rightMargin=0, leftMargin=0, topMargin=0, bottomMargin=0.5 * inch)
    rl_doc.build([layout])


# ── Main PDF builder ──────────────────────────────────────────────────────────
def build_pdf(doc_obj: dict, output_path: str, photo_path: str | None = None,
              original_style: dict | None = None):
    """
    Build a PDF from a Document dict.
    Theme and photo_width are taken from doc_obj["meta"].
    """
    meta = doc_obj.get("meta", {})
    theme_name = meta.get("theme", "classic")
    photo_width_in = meta.get("photo_width", 1.0)

    t = dict(THEMES.get(theme_name, THEMES["classic"]))
    if theme_name == "original" and original_style:
        t["accent"]    = original_style.get("accent",    t["accent"])
        t["name_size"] = original_style.get("name_size", t["name_size"])
        t["body_size"] = original_style.get("body_size", t["body_size"])

    layout = t.get("layout", "classic")
    MARGIN = 0.65 * inch
    blocks = doc_obj.get("blocks", [])
    name_align = TA_CENTER if layout == "centered" else TA_LEFT
    st = make_styles(t, name_align=name_align)

    if layout == "sidebar":
        build_sidebar(output_path, blocks, st, t, photo_path, photo_width_in)
        return

    if layout == "blue":
        build_blue(output_path, blocks, st, t, photo_path, photo_width_in)
        return

    rl_doc = SimpleDocTemplate(output_path, pagesize=letter,
        rightMargin=MARGIN, leftMargin=MARGIN, topMargin=MARGIN, bottomMargin=MARGIN)

    if layout == "banner":
        build_banner(rl_doc, blocks, st, t, photo_path, photo_width_in)
    elif layout == "centered":
        build_centered(rl_doc, blocks, st, t, photo_path, photo_width_in)
    else:
        build_classic(rl_doc, blocks, st, t, photo_path, photo_width_in)

# ── PDF / style extraction ────────────────────────────────────────────────────
def extract_photo(pdf_bytes: bytes, tmp_dir: str) -> str | None:
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        best = None
        for page in doc:
            for img in page.get_images(full=True):
                bi = doc.extract_image(img[0])
                w, h = bi.get("width", 0), bi.get("height", 0)
                if w < 40 or h < 40:
                    continue
                area = w * h
                if best is None or area > best[0]:
                    best = (area, bi["image"], bi["ext"])
        if best:
            path = os.path.join(tmp_dir, f"photo.{best[2]}")
            with open(path, "wb") as f:
                f.write(best[1])
            return path
    except Exception:
        pass
    return None

def extract_original_style(pdf_bytes: bytes) -> dict | None:
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        fsizes, ccounts = {}, {}
        for page in doc:
            for block in page.get_text("dict")["blocks"]:
                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        sz  = round(span.get("size", 10))
                        col = span.get("color", 0)
                        fsizes[sz] = fsizes.get(sz, 0) + len(span.get("text", ""))
                        if col != 0:
                            ccounts[col] = ccounts.get(col, 0) + 1
        if not fsizes:
            return None
        body_size = max(fsizes, key=lambda k: fsizes[k])
        head_size = max(fsizes.keys())
        accent = "#1a1a2e"
        if ccounts:
            dom = max(ccounts, key=lambda k: ccounts[k])
            accent = f"#{(dom>>16)&0xFF:02x}{(dom>>8)&0xFF:02x}{dom&0xFF:02x}"
        return {"body_size": max(8, min(body_size, 11)),
                "name_size": max(14, min(head_size, 22)),
                "accent": accent}
    except Exception:
        return None

# ── LLM output sanitiser ──────────────────────────────────────────────────────
def sanitize_output(text: str) -> str:
    """Strip markdown artifacts and LLM commentary lines."""
    COMMENTARY = [
        re.compile(r"is not allowed to be (made\s+)?(bold|italic|underline)", re.I),
        re.compile(r"\b(bold|italic|markdown|asterisk|formatting) is not allowed", re.I),
        re.compile(r"(cannot|can't|won't|will not|do not|don't)\s+(use|apply|add)\s+(bold|italic|markdown|asterisk)", re.I),
        re.compile(r"note\s*:\s*(bold|italic|using|I (cannot|can't|will))", re.I),
        re.compile(r"^(I (cannot|can't|will not|won't)|sorry,?\s*(I|but))\b", re.I),
        re.compile(r"using (bold|italic|markdown) is not allowed", re.I),
        re.compile(r"as per (the\s+)?instruction", re.I),
    ]
    lines = []
    for line in text.split("\n"):
        if any(p.search(line) for p in COMMENTARY):
            continue
        line = re.sub(r"^#{1,6}\s*", "", line)
        line = re.sub(r"\*\*(.+?)\*\*", r"\1", line)
        line = re.sub(r"__(.+?)__",     r"\1", line)
        line = re.sub(r"(?<!\-)\*(.+?)\*", r"\1", line)
        line = re.sub(r"(?<![_])_(.+?)_(?![_])", r"\1", line)
        line = re.sub(r"^\*\s+", "- ", line)
        line = re.sub(r"^\*+\s*", "", line)
        line = re.sub(r"\s*\*+$", "", line)
        lines.append(line)
    return "\n".join(lines)

# ── AI call ───────────────────────────────────────────────────────────────────
def ai_generate(system_prompt: str, user_content: str) -> str:
    resp = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_content},
        ],
    )
    return sanitize_output(resp.choices[0].message.content)

# ── Routes: use cases config ──────────────────────────────────────────────────
@app.get("/use-cases")
def get_use_cases():
    return load_use_cases()

# ── Routes: documents CRUD ────────────────────────────────────────────────────
@app.get("/documents")
def list_docs(type: str = None):
    return db.list_documents(type)

@app.get("/documents/{doc_id}")
def get_doc(doc_id: str):
    doc = db.get_document(doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    return doc

@app.get("/documents/{doc_id}/json")
def get_doc_json(doc_id: str):
    """Return the stored Document dict (intermediate JSON format)."""
    doc = db.get_document(doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    raw = doc.get("content_json")
    if not raw:
        raise HTTPException(404, "No JSON content stored for this document")
    return json.loads(raw) if isinstance(raw, str) else raw

@app.delete("/documents/{doc_id}")
def delete_doc(doc_id: str):
    db.delete_document(doc_id)
    return {"ok": True}

@app.patch("/documents/{doc_id}/title")
def rename_doc(doc_id: str, title: str = Form(...)):
    return db.update_document(doc_id, {"title": title})

# ── Route: generate ───────────────────────────────────────────────────────────
@app.post("/generate")
async def generate(
    request: Request,
    doc_type:    str   = Form(...),
    tone:        str   = Form("professional"),
    theme:       str   = Form("classic"),
    photo_width: float = Form(1.0),
    prompt:      str   = Form(...),
    title:       str   = Form("Untitled"),
    doc_id:      str   = Form(None),
    edit_mode:   str   = Form("false"),
    extra_fields: str  = Form("{}"),
    file:  Optional[UploadFile] = File(None),
    photo: Optional[UploadFile] = File(None),
):
    uc = load_use_cases()
    if doc_type not in uc:
        raise HTTPException(400, f"Unknown doc_type '{doc_type}'")

    tone_cfg = uc[doc_type]["tones"].get(tone)
    if not tone_cfg:
        raise HTTPException(400, f"Unknown tone '{tone}' for type '{doc_type}'")

    is_edit = edit_mode.lower() == "true"
    extra   = json.loads(extra_fields) if extra_fields else {}
    meta    = {"theme": theme, "tone": tone, "doc_type": doc_type, "photo_width": photo_width}

    system_prompt = (uc[doc_type].get("edit_system_prompt", tone_cfg["system_prompt"])
                     if is_edit else tone_cfg["system_prompt"])

    user_parts: list[str] = []
    if extra:
        for k, v in extra.items():
            if v:
                user_parts.append(f"{k.replace('_',' ').title()}: {v}")

    pdf_bytes = None
    tmp_dir   = tempfile.mkdtemp()

    try:
        # ── Determine base document object ────────────────────────────────────
        base_doc: dict | None = None

        if is_edit and doc_id:
            existing = db.get_document(doc_id)
            if existing:
                # Prefer stored JSON; fall back to re-parsing stored plain text
                raw_json = existing.get("content_json")
                if raw_json:
                    base_doc = json.loads(raw_json) if isinstance(raw_json, str) else raw_json
                    base_doc["meta"] = meta   # apply current theme/tone
                elif existing.get("content"):
                    base_doc = text_to_doc(existing["content"], meta)

        elif file and file.filename:
            pdf_bytes = await file.read()
            extracted = ""
            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                for page in pdf.pages:
                    pt = page.extract_text()
                    if pt:
                        extracted += pt + "\n"
            if extracted.strip():
                user_parts.append(f"Source document:\n{extracted}")

        user_parts.append(f"Edit instruction: {prompt}" if is_edit else f"Instructions: {prompt}")
        user_content = "\n\n".join(user_parts)

        # ── Apply edit or generate fresh ──────────────────────────────────────
        doc_obj: dict | None = None

        if is_edit and base_doc:
            result, msg = line_editor.apply_direct_edit(base_doc, prompt)
            if result is not None:
                doc_obj = result
            else:
                raise HTTPException(
                    400,
                    f"Could not apply edit: {msg}\n\n"
                    f"Try quoting the exact text, e.g.:\n"
                    f'  make "Technical Analyst / Full Stack Developer" bold'
                )

        if doc_obj is None:
            # Full rewrite via LLM
            try:
                plain_text = ai_generate(system_prompt, user_content)
            except Exception as e:
                raise HTTPException(502, f"Groq error: {e}")
            doc_obj = text_to_doc(plain_text, meta)

        # ── Photo ─────────────────────────────────────────────────────────────
        photo_path = None
        if photo and photo.filename:
            pb  = await photo.read()
            ext = os.path.splitext(photo.filename)[-1] or ".jpg"
            photo_path = os.path.join(tmp_dir, f"photo{ext}")
            with open(photo_path, "wb") as f_:
                f_.write(pb)
        elif pdf_bytes:
            photo_path = extract_photo(pdf_bytes, tmp_dir)

        original_style = None
        if theme == "original" and pdf_bytes:
            original_style = extract_original_style(pdf_bytes)

        # ── Build PDF ─────────────────────────────────────────────────────────
        out_path = os.path.join(tmp_dir, "output.pdf")
        build_pdf(doc_obj, out_path, photo_path=photo_path, original_style=original_style)

        # ── Persist to DB ─────────────────────────────────────────────────────
        plain_for_db = doc_to_text(doc_obj)
        record = {
            "type": doc_type, "title": title, "content": plain_for_db,
            "content_json": json.dumps(doc_obj),
            "tone": tone, "theme": theme, "photo_width": photo_width,
            "extra_fields": extra,
        }
        saved = db.update_document(doc_id, record) if doc_id else db.create_document(record)

        # ── Upload PDF to Supabase Storage ────────────────────────────────────
        fname = {"resume": "Resume", "portfolio": "Portfolio",
                 "letter": "Cover_Letter"}.get(doc_type, "Document") + ".pdf"

        file_type_map = {"resume": "cv", "portfolio": "extras", "letter": "cover_letter"}
        attachment_type = file_type_map.get(doc_type, "extras")

        try:
            with open(out_path, "rb") as pdf_file:
                pdf_bytes_out = pdf_file.read()
            # Use title for a more descriptive filename
            safe_title = re.sub(r'[^\w\s\-]', '', title).strip().replace(' ', '_')
            attachment_name = f"{safe_title}.pdf" if safe_title else fname

            # Save a local copy in output folder (overwrite previous)
            username = _get_username(request)
            output_dir = os.path.join(os.path.dirname(__file__), "output", username)
            os.makedirs(output_dir, exist_ok=True)
            # Delete older files of same type in output folder
            for old_file in os.listdir(output_dir):
                if old_file.lower().startswith(attachment_type) or old_file == attachment_name:
                    try:
                        os.remove(os.path.join(output_dir, old_file))
                    except Exception:
                        pass
            local_path = os.path.join(output_dir, attachment_name)
            with open(local_path, "wb") as lf:
                lf.write(pdf_bytes_out)

            db.upload_attachment(
                file_bytes=pdf_bytes_out,
                file_name=attachment_name,
                file_type=attachment_type,
                document_id=saved["id"],
                username=username,
            )
        except Exception:
            pass  # Don't fail the request if upload fails

        resp = FileResponse(out_path, media_type="application/pdf", filename=fname)
        resp.headers["X-Document-Id"] = saved["id"]
        return resp

    except HTTPException:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise
    except Exception as e:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise HTTPException(500, f"Error: {e}")

@app.get("/health")
def health():
    return {"status": "ok"}


# ── Route: attachments CRUD ───────────────────────────────────────────────────

def _get_username(request: Request) -> str:
    """Extract username/session_id from auth token. Returns scoped path like 'user/a1b2c3d4'."""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.replace("Bearer ", "")
        try:
            payload = jwt.decode(token, LOCAL_JWT_SECRET, algorithms=["HS256"])
            username = payload.get("sub", "anonymous")
            session_id = payload.get("session_id", "default")
            return f"{username}/{session_id}"
        except Exception:
            pass
    return "anonymous/default"


@app.get("/attachments")
def list_attachments(request: Request, file_type: str = None):
    """List stored attachments for the current user only."""
    username = _get_username(request)
    attachments = db.list_attachments(file_type, username=username)
    for att in attachments:
        att["url"] = db.get_attachment_url(att["storage_path"])
    return attachments


@app.delete("/attachments/{attachment_id}")
def delete_attachment(request: Request, attachment_id: str):
    """Delete an attachment from storage and DB."""
    try:
        db.delete_attachment(attachment_id)
    except Exception:
        pass
    return {"ok": True}


# ── Route: email preview data ─────────────────────────────────────────────────
@app.get("/email-preview")
def email_preview():
    """
    Reads Mailer_App .env config and recipients JSON to provide
    a full email preview for the frontend panel.
    """
    import configparser
    from pathlib import Path

    mailer_root = Path(__file__).resolve().parent.parent.parent / "Mailer_App"
    env_path = mailer_root / ".env"
    template_path = mailer_root / "templates" / "default.html"

    # Read .env
    config_data = {}
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            eq = line.find("=")
            if eq == -1:
                continue
            key = line[:eq].strip()
            val = line[eq+1:].strip()
            config_data[key] = val

    smtp_user = config_data.get("SMTP_USER", "")
    from_name = config_data.get("FROM_NAME", "")
    subject = config_data.get("SUBJECT", "")
    recipients_path = config_data.get("RECIPIENTS_PATH", "../Scraper_App/rezultate_all.json")

    # Resolve recipients path relative to Mailer_App root
    rpath = (mailer_root / recipients_path).resolve()

    # Read template
    body_html = ""
    if template_path.exists():
        body_html = template_path.read_text(encoding="utf-8")

    # Read recipients
    recipients = []
    if rpath.exists():
        try:
            data = json.loads(rpath.read_text(encoding="utf-8"))
            seen = set()
            for _source, entries in data.get("rezultate", {}).items():
                if not isinstance(entries, list):
                    continue
                for entry in entries:
                    emails = entry.get("emailuri", [])
                    for email in emails:
                        normalized = email.lower().strip()
                        if normalized in seen:
                            continue
                        seen.add(normalized)
                        recipients.append({
                            "companyName": entry.get("nume", "Unknown"),
                            "email": normalized,
                            "source": entry.get("sursa", "unknown"),
                        })
        except Exception:
            pass

    return {
        "configured": bool(smtp_user),
        "from_name": from_name,
        "from_email": smtp_user,
        "subject": subject,
        "body_html": body_html,
        "recipients": recipients,
        "total_recipients": len(recipients),
    }


# ── Route: remove recipient ───────────────────────────────────────────────────
@app.delete("/recipients/{email:path}")
def remove_recipient(email: str):
    """
    Remove a recipient email from the Scraper rezultate_all.json file.
    """
    from pathlib import Path

    mailer_root = Path(__file__).resolve().parent.parent.parent / "Mailer_App"
    env_path = mailer_root / ".env"

    # Read .env to find recipients path
    config_data = {}
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            eq = line.find("=")
            if eq == -1:
                continue
            key = line[:eq].strip()
            val = line[eq+1:].strip()
            config_data[key] = val

    recipients_path = config_data.get("RECIPIENTS_PATH", "../Scraper_App/rezultate_all.json")
    rpath = (mailer_root / recipients_path).resolve()

    if not rpath.exists():
        raise HTTPException(404, "Recipients file not found")

    data = json.loads(rpath.read_text(encoding="utf-8"))
    normalized_target = email.lower().strip()
    removed = False

    for _source, entries in data.get("rezultate", {}).items():
        if not isinstance(entries, list):
            continue
        for entry in entries:
            emails = entry.get("emailuri", [])
            new_emails = [e for e in emails if e.lower().strip() != normalized_target]
            if len(new_emails) < len(emails):
                removed = True
                entry["emailuri"] = new_emails

    if not removed:
        raise HTTPException(404, f"Email '{email}' not found in recipients")

    # Update total count
    total = 0
    for _source, entries in data.get("rezultate", {}).items():
        if isinstance(entries, list):
            for entry in entries:
                total += len(entry.get("emailuri", []))
    data["total"] = total

    rpath.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"ok": True, "removed": normalized_target, "new_total": total}


# ── Route: send emails ────────────────────────────────────────────────────────
@app.post("/send-emails")
def send_emails(test_mode: bool = False):
    """
    Send emails to all recipients using the Mailer_App SMTP config.
    If test_mode=True, sends only to the configured SMTP_USER (self-test).
    """
    from pathlib import Path
    import time

    mailer_root = Path(__file__).resolve().parent.parent.parent / "Mailer_App"
    env_path = mailer_root / ".env"
    template_path = mailer_root / "templates" / "default.html"

    # Read .env config
    config_data = {}
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            eq = line.find("=")
            if eq == -1:
                continue
            key = line[:eq].strip()
            val = line[eq+1:].strip()
            config_data[key] = val

    smtp_host = config_data.get("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(config_data.get("SMTP_PORT", "587"))
    smtp_user = config_data.get("SMTP_USER", "")
    smtp_pass = config_data.get("SMTP_PASS", "")
    from_name = config_data.get("FROM_NAME", "Applicant")
    subject_template = config_data.get("SUBJECT", "Job Application")
    cv_path_str = config_data.get("CV_PATH", "")
    recipients_path = config_data.get("RECIPIENTS_PATH", "../Scraper_App/rezultate_all.json")

    if not smtp_user or not smtp_pass:
        raise HTTPException(400, "SMTP credentials not configured in Mailer_App/.env")

    # Resolve paths relative to Mailer_App root
    rpath = (mailer_root / recipients_path).resolve()

    # Read template
    body_html = ""
    if template_path.exists():
        body_html = template_path.read_text(encoding="utf-8")

    # Get attachment file paths
    attachment_paths = []
    if cv_path_str:
        for p in cv_path_str.split(","):
            resolved = (mailer_root / p.strip()).resolve()
            if resolved.exists():
                attachment_paths.append(str(resolved))

    # Build recipients list
    recipients = []
    if test_mode:
        recipients = [{"companyName": "TEST", "email": smtp_user, "source": "test"}]
    else:
        if not rpath.exists():
            raise HTTPException(404, "Recipients file not found")
        data = json.loads(rpath.read_text(encoding="utf-8"))
        seen = set()
        for _source, entries in data.get("rezultate", {}).items():
            if not isinstance(entries, list):
                continue
            for entry in entries:
                for email in entry.get("emailuri", []):
                    normalized = email.lower().strip()
                    if normalized in seen:
                        continue
                    seen.add(normalized)
                    recipients.append({
                        "companyName": entry.get("nume", "Unknown"),
                        "email": normalized,
                        "source": entry.get("sursa", "unknown"),
                    })

    if not recipients:
        raise HTTPException(400, "No recipients to send to")

    # Connect to SMTP
    try:
        server = smtplib.SMTP(smtp_host, smtp_port, timeout=30)
        server.starttls()
        server.login(smtp_user, smtp_pass)
    except Exception as e:
        raise HTTPException(502, f"SMTP connection failed: {e}")

    # Send emails
    results = []
    for i, recip in enumerate(recipients):
        try:
            msg = MIMEMultipart()
            msg["From"] = f"{from_name} <{smtp_user}>"
            msg["To"] = recip["email"]
            msg["Subject"] = subject_template.replace("{companyName}", recip["companyName"])

            # Body
            if body_html:
                rendered = body_html.replace("{companyName}", recip["companyName"])
                rendered = rendered.replace("{fromName}", from_name)
                msg.attach(MIMEText(rendered, "html", "utf-8"))
            else:
                plain = f"Bună ziua,\n\nVă scriu pentru a-mi exprima interesul față de oportunitățile disponibile în cadrul {recip['companyName']}.\n\nAtașez CV-ul meu.\n\nCu stimă,\n{from_name}"
                msg.attach(MIMEText(plain, "plain", "utf-8"))

            # Attachments
            for att_path in attachment_paths:
                with open(att_path, "rb") as f:
                    part = MIMEBase("application", "octet-stream")
                    part.set_payload(f.read())
                encoders.encode_base64(part)
                part.add_header("Content-Disposition",
                                f"attachment; filename={os.path.basename(att_path)}")
                msg.attach(part)

            server.sendmail(smtp_user, recip["email"], msg.as_string())
            results.append({"email": recip["email"], "company": recip["companyName"], "success": True})
        except Exception as e:
            results.append({"email": recip["email"], "company": recip["companyName"],
                            "success": False, "error": str(e)})

        # Small delay between emails to avoid rate limiting
        if i < len(recipients) - 1:
            time.sleep(1.5)

    server.quit()

    successful = [r for r in results if r["success"]]
    failed = [r for r in results if not r["success"]]

    return {
        "total": len(results),
        "sent": len(successful),
        "failed": len(failed),
        "results": results,
    }


# ── Route: scrapers ───────────────────────────────────────────────────────────
import subprocess

SCRAPER_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "Scraper_App")

SCRAPERS = {
    "maps": {
        "id": "maps",
        "name": "Google Maps",
        "icon": "🗺️",
        "description": "Firme IT din Iasi pe Google Maps",
        "command": "npx playwright test tests/maps_scraper.spec.ts",
        "result_file": "rezultate_maps.json",
        "options": {
            "category": {
                "label": "Category",
                "type": "select",
                "default": "IT",
                "choices": [
                    {"value": "IT", "label": "IT"},
                    {"value": "Software", "label": "Software"},
                    {"value": "Marketing", "label": "Marketing"},
                    {"value": "Contabilitate", "label": "Contabilitate"},
                    {"value": "Inginerie", "label": "Inginerie"},
                    {"value": "Constructii", "label": "Constructii"},
                ],
            },
            "max_results": {
                "label": "Max Jobs",
                "type": "number",
                "default": 10,
                "min": 1,
                "max": 50,
            },
            "location": {
                "label": "City",
                "type": "text",
                "default": "Iasi",
            },
        },
    },
    "linkedin": {
        "id": "linkedin",
        "name": "LinkedIn",
        "icon": "💼",
        "description": "Joburi IT din Iasi pe LinkedIn (public)",
        "command": "npx playwright test tests/linkedin_scraper.spec.ts",
        "result_file": "rezultate_linkedin.json",
        "options": {
            "category": {
                "label": "Category",
                "type": "select",
                "default": "IT",
                "choices": [
                    {"value": "IT", "label": "IT"},
                    {"value": "Software Engineer", "label": "Software Engineer"},
                    {"value": "Data", "label": "Data / Analytics"},
                    {"value": "DevOps", "label": "DevOps"},
                    {"value": "Marketing", "label": "Marketing"},
                    {"value": "Finance", "label": "Finance"},
                ],
            },
            "max_results": {
                "label": "Max Jobs",
                "type": "number",
                "default": 10,
                "min": 1,
                "max": 50,
            },
            "location": {
                "label": "City",
                "type": "text",
                "default": "Iasi",
            },
        },
    },
    "bestjobs": {
        "id": "bestjobs",
        "name": "BestJobs",
        "icon": "🏢",
        "description": "Joburi IT din Iasi pe BestJobs.eu",
        "command": "npx playwright test tests/bestjobs_scraper.spec.ts",
        "result_file": "rezultate_bestjobs.json",
        "options": {
            "category": {
                "label": "Category",
                "type": "select",
                "default": "IT",
                "choices": [
                    {"value": "IT", "label": "IT"},
                    {"value": "Software", "label": "Software"},
                    {"value": "Engineering", "label": "Engineering"},
                    {"value": "Marketing", "label": "Marketing"},
                    {"value": "Sales", "label": "Sales"},
                    {"value": "Finance", "label": "Finance"},
                ],
            },
            "max_results": {
                "label": "Max Jobs",
                "type": "number",
                "default": 10,
                "min": 1,
                "max": 50,
            },
            "location": {
                "label": "City",
                "type": "text",
                "default": "Iasi",
            },
        },
    },
    "ejobs": {
        "id": "ejobs",
        "name": "eJobs",
        "icon": "📋",
        "description": "Joburi pe eJobs.ro cu filtre de categorie",
        "command": "npx playwright test tests/ejobs_scraper.spec.ts",
        "result_file": "rezultate_ejobs.json",
        "options": {
            "category": {
                "label": "Category",
                "type": "select",
                "default": "it-software",
                "choices": [
                    {"value": "it-software", "label": "IT / Software"},
                    {"value": "inginerie", "label": "Inginerie"},
                    {"value": "marketing", "label": "Marketing"},
                    {"value": "financiar-contabilitate", "label": "Financiar / Contabilitate"},
                    {"value": "vanzari", "label": "Vanzari"},
                    {"value": "resurse-umane", "label": "Resurse Umane"},
                    {"value": "administrativ", "label": "Administrativ"},
                    {"value": "management", "label": "Management"},
                ],
            },
            "max_results": {
                "label": "Max Jobs",
                "type": "number",
                "default": 10,
                "min": 1,
                "max": 50,
            },
            "location": {
                "label": "City",
                "type": "text",
                "default": "iasi",
            },
        },
    },
    "hipo": {
        "id": "hipo",
        "name": "Hipo.ro",
        "icon": "🎓",
        "description": "Joburi pe Hipo.ro (studenti, absolventi, tineri)",
        "command": "npx playwright test tests/hipo_scraper.spec.ts",
        "result_file": "rezultate_hipo.json",
        "options": {
            "category": {
                "label": "Category",
                "type": "select",
                "default": "IT Software",
                "choices": [
                    {"value": "IT Software", "label": "IT Software"},
                    {"value": "IT Hardware", "label": "IT Hardware"},
                    {"value": "Inginerie", "label": "Inginerie"},
                    {"value": "Marketing", "label": "Marketing"},
                    {"value": "Vanzari", "label": "Vanzari"},
                    {"value": "Contabilitate Finante", "label": "Contabilitate / Finante"},
                    {"value": "Internet - eCommerce", "label": "Internet / eCommerce"},
                    {"value": "Management - Consultanta", "label": "Management"},
                ],
            },
            "max_results": {
                "label": "Max Jobs",
                "type": "number",
                "default": 10,
                "min": 1,
                "max": 50,
            },
            "location": {
                "label": "City",
                "type": "text",
                "default": "Iasi",
            },
        },
    },
}


@app.get("/scrapers")
def get_scrapers():
    """List available scrapers with their status (has results or not)."""
    from pathlib import Path
    scraper_root = Path(SCRAPER_ROOT).resolve()

    scrapers_list = []
    for key, cfg in SCRAPERS.items():
        result_path = scraper_root / cfg["result_file"]
        has_results = result_path.exists()
        result_count = 0
        last_run = None
        if has_results:
            try:
                data = json.loads(result_path.read_text(encoding="utf-8"))
                result_count = data.get("total", 0)
                # Try to get file modification time
                import datetime
                mtime = result_path.stat().st_mtime
                last_run = datetime.datetime.fromtimestamp(mtime).isoformat()
            except Exception:
                pass

        scrapers_list.append({
            **cfg,
            "has_results": has_results,
            "result_count": result_count,
            "last_run": last_run,
        })

    return scrapers_list


@app.get("/scraper-results/{name}")
def get_scraper_results(name: str):
    """
    Load recipients from a single scraper's result file.
    Returns list of {companyName, email, source} ready for the emailer.
    """
    from pathlib import Path

    if name not in SCRAPERS:
        raise HTTPException(404, f"Unknown scraper: {name}")

    scraper_root = Path(SCRAPER_ROOT).resolve()
    result_path = scraper_root / SCRAPERS[name]["result_file"]

    if not result_path.exists():
        raise HTTPException(404, f"No results file for '{name}'. Run the scraper first.")

    data = json.loads(result_path.read_text(encoding="utf-8"))
    entries = data.get("firme") or data.get("jobs") or []

    recipients = []
    seen = set()
    for entry in entries:
        emails = entry.get("emailuri", [])
        for email in emails:
            normalized = email.lower().strip()
            if normalized in seen or normalized == "nu s-a gasit" or normalized == "nu s-a găsit":
                continue
            seen.add(normalized)
            recipients.append({
                "companyName": entry.get("nume") or entry.get("companie") or "Unknown",
                "email": normalized,
                "source": name,
            })

    return {
        "source": name,
        "source_label": SCRAPERS[name]["name"],
        "total": len(recipients),
        "recipients": recipients,
    }


@app.get("/scraper-results-all")
def get_all_scraper_results():
    """
    Load recipients from rezultate_all.json (combined).
    Returns list of {companyName, email, source} ready for the emailer.
    """
    from pathlib import Path

    scraper_root = Path(SCRAPER_ROOT).resolve()
    result_path = scraper_root / "rezultate_all.json"

    if not result_path.exists():
        raise HTTPException(404, "rezultate_all.json not found. Run merge first.")

    data = json.loads(result_path.read_text(encoding="utf-8"))

    recipients = []
    seen = set()
    for source_name, entries in data.get("rezultate", {}).items():
        if not isinstance(entries, list):
            continue
        for entry in entries:
            emails = entry.get("emailuri", [])
            for email in emails:
                normalized = email.lower().strip()
                if normalized in seen or normalized == "nu s-a gasit" or normalized == "nu s-a găsit":
                    continue
                seen.add(normalized)
                recipients.append({
                    "companyName": entry.get("nume") or entry.get("companie") or "Unknown",
                    "email": normalized,
                    "source": source_name,
                })

    return {
        "source": "all",
        "source_label": "Toate sursele",
        "total": len(recipients),
        "recipients": recipients,
    }


@app.post("/scrape/merge")
def run_merge():
    """Run the merge script to combine all scraper results into rezultate_all.json."""
    from pathlib import Path
    import platform

    scraper_root = Path(SCRAPER_ROOT).resolve()
    cmd = "npx playwright test tests/merge_results.spec.ts"
    if platform.system() == "Windows":
        cmd = cmd.replace("npx ", "npx.cmd ")

    try:
        proc = subprocess.Popen(
            cmd,
            shell=True,
            cwd=str(scraper_root),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        try:
            proc.communicate(timeout=30)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.communicate()

        result_path = scraper_root / "rezultate_all.json"
        total = 0
        if result_path.exists():
            try:
                data = json.loads(result_path.read_text(encoding="utf-8"))
                total = data.get("total", 0)
            except Exception:
                pass

        return {
            "success": proc.returncode == 0,
            "total": total,
        }
    except Exception as e:
        raise HTTPException(500, f"Merge failed: {type(e).__name__}: {e}")


@app.post("/scrape/{scraper_name}")
def run_scraper(scraper_name: str, category: str = None, max_results: int = None, location: str = None):
    """
    Trigger a scraper by name. Runs the Playwright test in headed mode.
    For eJobs, accepts optional category, max_results, and location params.
    Returns immediately with process info (scraping runs in background).
    """
    from pathlib import Path

    if scraper_name not in SCRAPERS:
        raise HTTPException(404, f"Unknown scraper: {scraper_name}")

    cfg = SCRAPERS[scraper_name]
    scraper_root = Path(SCRAPER_ROOT).resolve()

    if not scraper_root.exists():
        raise HTTPException(500, f"Scraper_App directory not found at: {scraper_root}")

    # Verify npx is available
    import shutil as _shutil
    if not _shutil.which("npx"):
        raise HTTPException(500, "npx not found in PATH. Is Node.js installed?")

    # Build environment
    env = os.environ.copy()
    # Pass max_results to ALL scrapers via SCRAPER_MAX_RESULTS
    if max_results:
        env["SCRAPER_MAX_RESULTS"] = str(max_results)
    if category:
        env["SCRAPER_CATEGORY"] = category
    if location:
        env["SCRAPER_LOCATION"] = location
    # Also set scraper-specific env vars
    if scraper_name == "ejobs":
        if category:
            env["EJOBS_CATEGORY"] = category
        if max_results:
            env["EJOBS_MAX"] = str(max_results)
        if location:
            env["EJOBS_LOCATION"] = location
    elif scraper_name == "hipo":
        if category:
            env["HIPO_CATEGORY"] = category
        if max_results:
            env["HIPO_MAX"] = str(max_results)
        if location:
            env["HIPO_LOCATION"] = location

    # Run scraper as subprocess
    cmd = cfg["command"]
    import platform
    if platform.system() == "Windows":
        cmd = cmd.replace("npx ", "npx.cmd ")
    try:
        proc = subprocess.Popen(
            cmd,
            shell=True,
            cwd=str(scraper_root),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        try:
            stdout_bytes, stderr_bytes = proc.communicate(timeout=360)
            stdout_text = stdout_bytes.decode("utf-8", errors="replace") if stdout_bytes else ""
            stderr_text = stderr_bytes.decode("utf-8", errors="replace") if stderr_bytes else ""
            returncode = proc.returncode
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.communicate()
            return {
                "success": False,
                "scraper": scraper_name,
                "error": "Timeout — scraperul a durat mai mult de 6 minute",
            }

        # Check results file
        result_path = scraper_root / cfg["result_file"]
        result_data = None
        if result_path.exists():
            try:
                result_data = json.loads(result_path.read_text(encoding="utf-8"))
            except Exception:
                pass

        success = returncode == 0 or (result_data is not None and result_data.get("total", 0) > 0)

        return {
            "success": success,
            "scraper": scraper_name,
            "exit_code": returncode,
            "result_count": result_data.get("total", 0) if result_data else 0,
            "stdout_tail": stdout_text[-2000:],
            "stderr_tail": stderr_text[-1000:],
        }

    except FileNotFoundError as e:
        raise HTTPException(500, f"Command not found (is npx/node installed?): {e}")
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        raise HTTPException(500, f"Failed to run scraper: {type(e).__name__}: {e}\n\nTraceback:\n{tb}")
