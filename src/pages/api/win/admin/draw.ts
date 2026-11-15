import type { APIRoute } from 'astro';
import { noStoreHeaders, randomOffset, sameOriginPost, winState } from '../../../../lib/win';
export const prerender = false;
export const POST: APIRoute = async ({ request, locals }) => {
  if (!sameOriginPost(request)) return new Response('Forbidden', { status: 403, headers: noStoreHeaders() });
  const env = (locals as any).runtime?.env ?? {};
  const state = winState(env);
  if (state.phase !== 'closed' || !state.drawAt || Date.now() < Date.parse(state.drawAt)) return new Response('Draw not yet available', { status: 403, headers: noStoreHeaders() });
  try {
    const db = env.WIN_DB;
    const count = await db.prepare("SELECT count(*) as n FROM win_entries WHERE status = 'valid'").first();
    if (!count?.n) return new Response('No eligible entries or a winner has already been selected', { status: 409, headers: noStoreHeaders() });
    const index = randomOffset(count.n);
    const selected = await db.prepare("SELECT id FROM win_entries WHERE status = 'valid' ORDER BY id LIMIT 1 OFFSET ?").bind(index).first();
    if (!selected?.id) return new Response('Entry not found; retry after checking the database', { status: 409, headers: noStoreHeaders() });
    const updated = await db.prepare("UPDATE win_entries SET status='winner', selected_at=? WHERE id=? AND status='valid' AND NOT EXISTS (SELECT 1 FROM win_entries WHERE status='winner')").bind(new Date().toISOString(), selected.id).run();
    if (updated.meta.changes !== 1) return new Response('Winner was already chosen; refresh the dashboard', { status: 409, headers: noStoreHeaders() });
    return new Response(null, { status: 303, headers: { ...noStoreHeaders(), Location: '/win/admin' } });
  } catch { return new Response('Unable to draw the winner. Refresh and check the dashboard.', { status: 503, headers: noStoreHeaders() }); }
};