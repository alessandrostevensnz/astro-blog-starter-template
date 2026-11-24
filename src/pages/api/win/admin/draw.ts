import type { APIRoute } from 'astro';
import { noStoreHeaders, randomOffset, sameOriginPost, winState } from '../../../../lib/win';

export const prerender = false;
const headers = noStoreHeaders();

export const POST: APIRoute = async ({ request, locals }) => {
  if (!sameOriginPost(request)) return new Response('Forbidden', { status: 403, headers });
  const env = (locals as any).runtime?.env ?? {};
  const state = winState(env);
  if (state.phase !== 'closed' || !state.drawAt || Date.now() < Date.parse(state.drawAt)) {
    return new Response('Draw not yet available', { status: 403, headers });
  }
  try {
    const db = env.WIN_DB;
    const previous = await db.prepare("SELECT id FROM win_entries WHERE status = 'winner' LIMIT 1").first();
    if (previous?.id) return new Response('A selected entrant already exists. Confirm eligibility or record an exclusion before another draw.', { status: 409, headers });

    const eligible = "status = 'valid' AND NOT EXISTS (SELECT 1 FROM win_entry_exclusions x WHERE x.entry_id = win_entries.id)";
    const count = await db.prepare("SELECT count(*) as n FROM win_entries WHERE " + eligible).first();
    const n = Number(count?.n ?? 0);
    if (!Number.isSafeInteger(n) || n < 1) return new Response('No eligible entries remain. Review the exclusion log.', { status: 409, headers });

    const index = randomOffset(n);
    const selected = await db.prepare("SELECT id FROM win_entries WHERE " + eligible + " ORDER BY id LIMIT 1 OFFSET ?").bind(index).first();
    if (!selected?.id) return new Response('No eligible entry selected; check the database before retrying.', { status: 409, headers });
    const stamp = new Date().toISOString();
    const results = await db.batch([
      db.prepare("UPDATE win_entries SET status='winner', selected_at=? WHERE id=? AND status='valid' AND NOT EXISTS (SELECT 1 FROM win_entry_exclusions x WHERE x.entry_id=win_entries.id) AND NOT EXISTS (SELECT 1 FROM win_entries WHERE status='winner')").bind(stamp, selected.id),
      db.prepare("INSERT INTO win_draw_events (id, entry_id, event_type, recorded_at, reason) SELECT ?, ?, 'selected', ?, NULL WHERE EXISTS (SELECT 1 FROM win_entries WHERE id=? AND status='winner') AND NOT EXISTS (SELECT 1 FROM win_draw_events WHERE entry_id=? AND event_type='selected')").bind(crypto.randomUUID(), selected.id, stamp, selected.id, selected.id),
    ]);
    if (results?.[0]?.meta?.changes !== 1 || results?.[1]?.meta?.changes !== 1) {
      return new Response('Draw could not be recorded. Check the audit log before retrying.', { status: 409, headers });
    }
    return new Response(null, { status: 303, headers: { ...headers, Location: '/win/admin' } });
  } catch {
    return new Response('The draw could not be recorded. Check that migration 0002 is installed; no winner should be announced until resolved.', { status: 503, headers });
  }
};
