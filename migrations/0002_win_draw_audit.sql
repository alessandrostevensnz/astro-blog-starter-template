-- Run once against the same Cloudflare D1 database as win_entries.
-- Makes ineligible/duplicate exclusions and replacement draws auditable.
-- Does not alter the existing entry table or delete entry data.
CREATE TABLE IF NOT EXISTS win_entry_exclusions (
  entry_id TEXT PRIMARY KEY NOT NULL REFERENCES win_entries(id),
  excluded_at TEXT NOT NULL,
  reason TEXT NOT NULL CHECK(length(reason) BETWEEN 5 AND 200)
);

CREATE TABLE IF NOT EXISTS win_draw_events (
  id TEXT PRIMARY KEY NOT NULL,
  entry_id TEXT NOT NULL REFERENCES win_entries(id),
  event_type TEXT NOT NULL CHECK(event_type IN ('selected', 'excluded')),
  recorded_at TEXT NOT NULL,
  reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_win_draw_events_created ON win_draw_events(recorded_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_win_draw_events_once ON win_draw_events(entry_id, event_type);
