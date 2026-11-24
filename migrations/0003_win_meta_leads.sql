-- Optional Meta/Facebook Instant Form integration. NOT activated by this migration.
-- Apply to the EXISTING andro-win Cloudflare D1 database only after consent/legal
-- and Meta app permission checks. Existing win_entries rows are untouched.
CREATE TABLE IF NOT EXISTS win_meta_leads (
  lead_id TEXT PRIMARY KEY NOT NULL,
  entry_id TEXT REFERENCES win_entries(id),
  form_id TEXT NOT NULL,
  received_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('accepted','duplicate','rejected')),
  reason TEXT,
  CHECK ((status = 'accepted' AND entry_id IS NOT NULL)
         OR (status <> 'accepted' AND entry_id IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_win_meta_received ON win_meta_leads(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_win_meta_status ON win_meta_leads(status);
