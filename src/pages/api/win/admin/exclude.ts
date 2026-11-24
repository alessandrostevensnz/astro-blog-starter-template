import type { APIRoute } from 'astro';
import { noStoreHeaders, sameOriginPost, winState } from '../../../../lib/win';

export const prerender = false;
const allowedReasons = new Set([
  'Duplicate entry', 'Outside advertised Auckland area',
  'Entrant under 18 or without property authority', 'ANDRO promoter, employee or immediate family', 'Inaccurate or fraudulent entry',
  'Selected entrant declined the prize', 'Selected entrant did not respond within seven days',
  'Unlawful or unsafe work scope with no suitable alternative',
]);
const headers = noStoreHeaders();

export const POST: APIRoute = async ({ request, locals }) => {
  if (!sameOriginPost(request)) return new Response('Forbidden', { status: 403, headers });
  const env = (locals as any).runtime?.env ?? {};
  const state = winState(env);
  if (state.phase !== 'closed') return new Response('Entries must close before exclusions are finalised.', { status: 403, headers });
  try {
    const form = await request.formData();
    const entryId = form.get('entry_id');
    const reason = form.get('reason');
    if (typeof entryId !== 'string' || !/^[0-9a-f-]{36}$/i.test(entryId) ||
        typeof reason !== 'string' || !allowedReasons.has(reason)) {
      return new Response('A valid entry and exclusion reason are required.', { status: 400, headers });
    }
    const db = env.WIN_DB;
    const entry = await db.prepare('SELECT id, status FROM win_entries WHERE id=? LIMIT 1').bind(entryId).first();
    if (!entry?.id) return new Response('Entry not found.', { status: 404, headers });
    if (entry.status !== 'valid' && entry.status !== 'winner') return new Response('Entry is not eligible for exclusion.', { status: 409, headers });
    const old = await db.prepare('SELECT entry_id FROM win_entry_exclusions WHERE entry_id=?').bind(entryId).first();
    if (old) return new Response('Entry is already excluded. Check the audit log.', { status: 409, headers });
    const stamp = new Date().toISOString();
    // Cloudflare D1 batch is transactional. If one statement fails, none apply.
    await db.batch([
      db.prepare('INSERT INTO win_entry_exclusions (entry_id, excluded_at, reason) VALUES (?,?,?)').bind(entryId, stamp, reason),
      db.prepare("INSERT INTO win_draw_events (id, entry_id, event_type, recorded_at, reason) VALUES (?,?,'excluded',?,?)").bind(crypto.randomUUID(), entryId, stamp, reason),
      db.prepare("UPDATE win_entries SET status='valid', selected_at=NULL WHERE id=? AND status='winner'").bind(entryId),
    ]);
    return new Response(null, { status: 303, headers: { ...headers, Location: '/win/admin' } });
  } catch {
    return new Response('Could not safely record the exclusion. Confirm migration 0002 is applied; do not redraw until resolved.', { status: 503, headers });
  }
};
