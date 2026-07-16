-- Migration: Create email_attachments table + storage bucket
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- 1. Create the storage bucket for PDF attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow public read access to attachments bucket
CREATE POLICY "Public read access on attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'attachments');

-- 3. Allow authenticated/anon insert (upload)
CREATE POLICY "Allow upload to attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'attachments');

-- 4. Allow authenticated/anon update (overwrite)
CREATE POLICY "Allow update in attachments"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'attachments');

-- 5. Allow authenticated/anon delete
CREATE POLICY "Allow delete in attachments"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'attachments');

-- 6. Create the email_attachments table
CREATE TABLE IF NOT EXISTS email_attachments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  file_type   TEXT NOT NULL CHECK (file_type IN ('cv', 'cover_letter', 'extras')),
  file_name   TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size   INTEGER,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- 7. Index for quick lookups by file_type
CREATE INDEX IF NOT EXISTS idx_email_attachments_file_type
  ON email_attachments(file_type);

-- 8. Index for lookups by document_id
CREATE INDEX IF NOT EXISTS idx_email_attachments_document_id
  ON email_attachments(document_id);

-- 9. Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON email_attachments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 10. Enable RLS
ALTER TABLE email_attachments ENABLE ROW LEVEL SECURITY;

-- 11. Allow all operations for anon (since app uses anon key)
CREATE POLICY "Allow all for anon on email_attachments"
  ON email_attachments FOR ALL
  USING (true)
  WITH CHECK (true);
