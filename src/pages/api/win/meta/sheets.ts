import type { APIRoute } from 'astro';
import { noStoreHeaders, winAuditReady } from '../../../../lib/win';
import { verifyMetaSignature, storeMetaLead } from '../../../../lib/win-meta';
import { mapSheetsWinLead, sheetsImportConfigured, sheetsPayloadIsRecent } from '../../../../lib/win-meta-sheets';

export const prerender = false;
const json = (value: object, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { ...noStoreHeaders(), 'Content-Type': 'application/json; charset=utf-8' }
});

/** HMAC-authenticated intake for a private Google Apps Script.
 * Remains OFF until both WIN_META_IMPORT_ENABLED and WIN_META_SHEETS_SYNC_ENABLED
 * are explicitly enabled AFTER a legally reviewed entry method and tested form.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any).runtime?.env ?? {};
  if (!sheetsImportConfigured(env)) return json({ error: 'ANDRO Sheets import is disabled.' }, 503);
  if (!(await winAuditReady(env))) return json({ error: 'Giveaway audit database not ready.' }, 503);
  try {
    await env.WIN_DB.prepare('SELECT lead_id FROM win_meta_leads LIMIT 0').all();
  } catch { return json({ error: 'Meta lead log migration 0003 is missing.' }, 503); }
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return json({ error: 'Expected JSON request.' }, 415);
  }
  const max = 8192;
  if (Number(request.headers.get('content-length') || '0') > max) return json({ error: 'Request too large.' }, 413);
  let body: ArrayBuffer;
  try { body = await request.arrayBuffer(); } catch { return json({ error: 'Invalid request.' }, 400); }
  if (body.byteLength > max) return json({ error: 'Request too large.' }, 413);
  if (!(await verifyMetaSignature(body, request.headers.get('x-andro-sheets-signature'), env.WIN_META_SHEETS_SYNC_SECRET))) {
    return json({ error: 'Invalid import signature.' }, 403);
  }
  let payload: unknown;
  try { payload = JSON.parse(new TextDecoder().decode(body)); }
  catch { return json({ error: 'Invalid JSON.' }, 400); }
  if (!payload || typeof payload !== 'object' || !sheetsPayloadIsRecent(payload)) {
    return json({ error: 'Unknown source or expired import request.' }, 403);
  }
  const lead = mapSheetsWinLead(payload, env);
  if (!lead.entry) return json({ error: lead.error || 'Not a verifiable competition entry.' }, 422);
  try {
    const winner = await env.WIN_DB.prepare("SELECT id FROM win_entries WHERE status='winner' LIMIT 1").first();
    if (winner) return json({ error: 'Winner selection already started.' }, 409);
    const result = await storeMetaLead(lead, env.WIN_DB);
    return json({ status: result });
  } catch {
    // Never leak personal information, database structure or the HMAC secret.
    return json({ error: 'Temporary import failure. The original lead remains in Meta/Sheets.' }, 503);
  }
};
