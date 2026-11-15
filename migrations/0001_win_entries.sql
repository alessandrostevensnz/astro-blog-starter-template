-- Private giveaway entries. Run via wrangler d1 migrations apply andro-win --remote.
CREATE TABLE IF NOT EXISTS win_entries (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  phone TEXT NOT NULL,
  suburb TEXT NOT NULL,
  property_role TEXT NOT NULL,
  service_type TEXT NOT NULL,
  work_details TEXT NOT NULL,
  marketing_opt_in INTEGER NOT NULL DEFAULT 0 CHECK (marketing_opt_in IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'winner')),
  selected_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_win_entries_created ON win_entries(created_at DESC);
-- Enforce one winner even if two administrators attempt to draw simultaneously.
CREATE UNIQUE INDEX IF NOT EXISTS idx_win_one_winner ON win_entries(status) WHERE status = 'winner';
