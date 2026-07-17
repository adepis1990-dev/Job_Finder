"""Supabase client + document CRUD helpers + attachment storage."""
from __future__ import annotations
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

_sb: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY"),
)

TABLE = "documents"
ATTACHMENTS_TABLE = "email_attachments"
STORAGE_BUCKET = "attachments"


# ── Document CRUD ─────────────────────────────────────────────────────────────

def list_documents(doc_type: str = None):
    q = _sb.table(TABLE).select("id,type,title,tone,theme,created_at,updated_at")
    if doc_type:
        q = q.eq("type", doc_type)
    return q.order("updated_at", desc=True).execute().data


def get_document(doc_id: str):
    res = _sb.table(TABLE).select("*").eq("id", doc_id).single().execute()
    return res.data


def create_document(data: dict):
    res = _sb.table(TABLE).insert(data).execute()
    return res.data[0]


def update_document(doc_id: str, data: dict):
    res = _sb.table(TABLE).update(data).eq("id", doc_id).execute()
    return res.data[0]


def delete_document(doc_id: str):
    _sb.table(TABLE).delete().eq("id", doc_id).execute()


# ── Attachment Storage ────────────────────────────────────────────────────────

def upload_attachment(file_bytes: bytes, file_name: str, file_type: str,
                      document_id: str = None, username: str = "anonymous") -> dict:
    """
    Upload a PDF to Supabase Storage and create a record in email_attachments.
    Keeps only 1 copy per file_type per user — deletes older ones.

    Args:
        file_bytes: Raw PDF bytes
        file_name: Display name (e.g. "CV_Dascalu_Mircea.pdf")
        file_type: One of 'cv', 'cover_letter', 'extras'
        document_id: Optional FK to documents table
        username: User who owns this attachment

    Returns:
        The created email_attachments row
    """
    # Storage path scoped by username: username/file_type/filename
    storage_path = f"{username}/{file_type}/{file_name}"

    # Delete ALL existing attachments of same file_type for this user (keep only 1 copy)
    existing = (_sb.table(ATTACHMENTS_TABLE)
                .select("id,storage_path")
                .eq("file_type", file_type)
                .like("storage_path", f"{username}/%")
                .execute().data)

    for old in existing:
        try:
            _sb.storage.from_(STORAGE_BUCKET).remove([old["storage_path"]])
        except Exception:
            pass
        _sb.table(ATTACHMENTS_TABLE).delete().eq("id", old["id"]).execute()

    # Upload to storage
    _sb.storage.from_(STORAGE_BUCKET).upload(
        path=storage_path,
        file=file_bytes,
        file_options={"content-type": "application/pdf", "upsert": "true"},
    )

    # Insert new record
    record = {
        "file_type": file_type,
        "file_name": file_name,
        "storage_path": storage_path,
        "file_size": len(file_bytes),
        "document_id": document_id,
    }
    res = _sb.table(ATTACHMENTS_TABLE).insert(record).execute()
    return res.data[0]


def list_attachments(file_type: str = None, username: str = None) -> list[dict]:
    """List attachments, filtered by file_type and/or username."""
    q = _sb.table(ATTACHMENTS_TABLE).select("*")
    if file_type:
        q = q.eq("file_type", file_type)
    if username:
        q = q.like("storage_path", f"{username}/%")
    return q.order("updated_at", desc=True).execute().data


def get_attachment(attachment_id: str) -> dict | None:
    """Get a single attachment record by ID."""
    try:
        res = (_sb.table(ATTACHMENTS_TABLE)
               .select("*")
               .eq("id", attachment_id)
               .execute())
        return res.data[0] if res.data else None
    except Exception:
        return None


def get_attachment_url(storage_path: str) -> str:
    """Get the public URL for a file in storage."""
    return _sb.storage.from_(STORAGE_BUCKET).get_public_url(storage_path)


def download_attachment(storage_path: str) -> bytes:
    """Download file bytes from Supabase Storage."""
    return _sb.storage.from_(STORAGE_BUCKET).download(storage_path)


def delete_attachment(attachment_id: str):
    """Delete an attachment record and its file from storage."""
    record = get_attachment(attachment_id)
    if record:
        # Remove from storage
        try:
            _sb.storage.from_(STORAGE_BUCKET).remove([record["storage_path"]])
        except Exception:
            pass  # File might already be gone
        # Remove DB record
        _sb.table(ATTACHMENTS_TABLE).delete().eq("id", attachment_id).execute()
    else:
        # Just try to delete the DB record anyway
        _sb.table(ATTACHMENTS_TABLE).delete().eq("id", attachment_id).execute()
