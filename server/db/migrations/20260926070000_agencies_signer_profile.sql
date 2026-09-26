-- Personal signatory profile on agencies (super_admin Mon profil).
ALTER TABLE agencies
  ADD COLUMN IF NOT EXISTS fonction VARCHAR(120),
  ADD COLUMN IF NOT EXISTS signature_base64 TEXT;
