import type { APIRoute } from 'astro';
import { noStoreHeaders, sameOriginPost, winAuditReady } from '../../../../lib/win';

export const prerender = false;

/** Run only from /win/admin behind the existing signed report-password session.
 * All SQL is fixed, idempotent DDL. Never accept SQL or table names from a request. */
export const POST: APIRoute = async ({ request, locals }) => {
  const headers = noStoreHeaders();
  if (!sameOriginPost(request)) return new Response('Forbidden', { status: 403, headers });
  const env = (locals as any).runtime?.env ?? {};
  const db = env.WIN_DB;
  if (typeof db?.prepare !== 'function' || typeof db?.batch !== 'function') {
    return new Response('Cloudflare giveaway database is not available.', { status: 503, headers });
  }
  try {
    // Never alter, delete, or recreate existing giveaway entries.
    await db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS win_entry_exclusions (
        entry_id TEXT PRIMARY KEY NOT NULL REFERENCES win_entries(id),
        excluded_at TEXT NOT NULL,
        reason TEXT NOT NULL CHECK(length(reason) BETWEEN 5 AND 200)
      )`),
      db.prepare(`CREATE TABLE IF NOT EXISTS win_draw_events (
        id TEXT PRIMARY KEY NOT NULL,
        entry_id TEXT NOT NULL REFERENCES win_entries(id),
        event_type TEXT NOT NULL CHECK(event_type IN ('selected','excluded')),
        recorded_at TEXT NOT NULL,
        reason TEXT
      )`),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_win_draw_events_created ON win_draw_events(recorded_at DESC)'),
      db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_win_draw_events_once ON win_draw_events(entry_id, event_type)'),
    ]);
    if (!(await winAuditReady(env))) {
      return new Response('Audit tables are still unavailable. Please check the Cloudflare D1 console.', { status: 503, headers });
    }
    return new Response(null, { status: 303, headers: { ...headers, Location: '/win/admin' } });
  } catch {
    return new Response('Could not prepare the draw-audit database. Check the D1 binding and existing win_entries table.', { status: 503, headers });
  }
};
