import type { APIRoute } from 'astro';
import { noStoreHeaders, winAuditReady } from '../../../../lib/win.ts';
import { verifyMetaSignature, storeMetaLead } from '../../../../lib/win-meta.ts';
import { mapSheetsWinLead, sheetsImportConfigured, sheetsConnectionConfigured, isSheetsConnectionProbe, sheetsPayloadIsRecent } from '../../../../lib/win-meta-sheets.ts';
import type { MetaSheetsPayload } from '../../../../lib/win-meta-sheets.ts';

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
  const enabled = sheetsImportConfigured(env);
  const disabled = () => json({ error: 'ANDRO Sheets import is disabled.' }, 503);
  const signature = request.headers.get('x-andro-sheets-signature');
  // An unsigned request cannot probe a disabled integration. A signed dry run
  // may check configuration only if the secret, form ID and DB are configured.
  if (!enabled && (!signature || !sheetsConnectionConfigured(env))) return disabled();
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return json({ error: 'Expected JSON request.' }, 415);
  }
  const max = 8192;
  if (Number(request.headers.get('content-length') || '0') > max) return json({ error: 'Request too large.' }, 413);
  let body: ArrayBuffer;
  try { body = await request.arrayBuffer(); } catch { return json({ error: 'Invalid request.' }, 400); }
  if (body.byteLength > max) return json({ error: 'Request too large.' }, 413);
  if (!(await verifyMetaSignature(body, signature, env.WIN_META_SHEETS_SYNC_SECRET))) {
    return json({ error: 'Invalid import signature.' }, 403);
  }
  let payload: unknown;
  try { payload = JSON.parse(new TextDecoder().decode(body)); }
  catch { return json({ error: 'Invalid JSON.' }, 400); }
  if (!payload || typeof payload !== 'object' || !sheetsPayloadIsRecent(payload as MetaSheetsPayload)) {
    return json({ error: 'Unknown source or expired import request.' }, 403);
  }
  const probe = isSheetsConnectionProbe(payload);
  if (!enabled && !probe) return disabled();
  if (!(await winAuditReady(env))) return json({ error: 'Giveaway audit database not ready.' }, 503);
  try {
    await env.WIN_DB.prepare('SELECT lead_id FROM win_meta_leads LIMIT 0').all();
  } catch { return json({ error: 'Meta lead log migration 0003 is missing.' }, 503); }
  const lead = mapSheetsWinLead(payload as MetaSheetsPayload, env);
  // A probe cannot reach the storage branch, even if mapping changes later.
  if (probe) return json({ error: lead.error || 'terms_acknowledgement_not_captured' }, 422);
  if (!enabled) return disabled();
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
