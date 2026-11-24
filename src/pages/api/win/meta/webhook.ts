import type { APIRoute } from 'astro';
import { noStoreHeaders, winAuditReady } from '../../../../lib/win';
import { fetchMetaLead, mapMetaWinLead, metaIntegrationConfigured, storeMetaLead, verifyMetaSignature } from '../../../../lib/win-meta';

export const prerender = false;
const plain = (text: string, status = 200) => new Response(text, {
  status, headers: { ...noStoreHeaders(), 'Content-Type': 'text/plain; charset=utf-8' },
});

export const GET: APIRoute = async ({ request, locals }) => {
  const env = (locals as any).runtime?.env ?? {};
  const url = new URL(request.url);
  const expected = env.WIN_META_VERIFY_TOKEN;
  // Verification can be completed before the import switch is enabled.
  if (typeof expected !== 'string' || expected.length < 24 ||
      url.searchParams.get('hub.mode') !== 'subscribe' ||
      url.searchParams.get('hub.verify_token') !== expected) return plain('Forbidden', 403);
  const challenge = url.searchParams.get('hub.challenge');
  if (!challenge || !/^\d{1,128}$/.test(challenge)) return plain('Invalid challenge', 400);
  return plain(challenge);
};

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any).runtime?.env ?? {};
  // Do not accept one Facebook entrant until the revised promotion has been
  // reviewed and the Meta app/form/consents are genuinely connected.
  if (!metaIntegrationConfigured(env) || !(await winAuditReady(env))) return plain('Meta import not configured', 503);
  const declaredSize = Number(request.headers.get('content-length') || '0');
  if (declaredSize > 262144) return plain('Payload too large', 413);
  let body: ArrayBuffer;
  try { body = await request.arrayBuffer(); } catch { return plain('Invalid payload', 400); }
  if (body.byteLength > 262144) return plain('Payload too large', 413);
  if (!(await verifyMetaSignature(body, request.headers.get('x-hub-signature-256'), env.WIN_META_APP_SECRET))) {
    return plain('Forbidden', 403);
  }
  let payload: any;
  try { payload = JSON.parse(new TextDecoder().decode(body)); } catch { return plain('Bad JSON', 400); }
  if (payload?.object !== 'page' || !Array.isArray(payload.entry)) return plain('Not a Page update', 400);
  const changes: string[] = [];
  for (const entry of payload.entry) {
    if (String(entry?.id) !== env.WIN_META_PAGE_ID || !Array.isArray(entry?.changes)) continue;
    for (const item of entry.changes) {
      if (item?.field !== 'leadgen') continue;
      const value = item.value;
      if (String(value?.page_id) !== env.WIN_META_PAGE_ID ||
          String(value?.form_id) !== env.WIN_META_FORM_ID ||
          !/^\d{5,25}$/.test(String(value?.leadgen_id))) continue;
      changes.push(String(value.leadgen_id));
    }
  }
  // A webhook may be retried or contain the same lead twice. The DB has a
  // unique lead ID and a unique email across website and Facebook entries.
  const unique = [...new Set(changes)];
  const db = env.WIN_DB;
  try {
    for (const leadId of unique) {
      // Never silently add an entrant once a winner has already been selected.
      const winner = await db.prepare("SELECT id FROM win_entries WHERE status='winner' LIMIT 1").first();
      if (winner) return plain('Winner selection already started; manual review required', 503);
      const lead = await fetchMetaLead(leadId, env);
      const mapped = mapMetaWinLead(lead, env);
      if (!mapped.leadId || mapped.formId !== env.WIN_META_FORM_ID) return plain('Unexpected Meta lead data', 503);
      await storeMetaLead(mapped, db);
    }
  } catch {
    // Meta retries a failed webhook; processing is idempotent in D1.
    // Do not log phone numbers, names, emails or Page secrets.
    return plain('Lead import temporarily unavailable', 503);
  }
  return plain('EVENT_RECEIVED', 200);
};
