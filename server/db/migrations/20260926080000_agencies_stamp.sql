-- Personal stamp (cachet) on agencies (Mon profil).
ALTER TABLE agencies
  ADD COLUMN IF NOT EXISTS stamp_base64 TEXT;
