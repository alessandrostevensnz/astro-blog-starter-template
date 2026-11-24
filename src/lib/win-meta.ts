/** Meta Instant Form lead validation for the ANDRO giveaway.
 * Only three contact questions are required. A separately acknowledged, linked
 * terms/eligibility statement replaces individual age/property questions.
 * The eventual winner still needs eligibility and property authority verification.
 * The official Facebook form must be configured to match docs/win-facebook-instant-form.md.
 */
import { validateWinEntry, winState } from './win.ts';

type MetaField = { name?: unknown; values?: unknown };
type MetaCheck = { checkbox_key?: unknown; is_checked?: unknown };
export type MetaLead = {
  id?: unknown;
  form_id?: unknown;
  created_time?: unknown;
  field_data?: unknown;
  custom_disclaimer_responses?: unknown;
};

export type MetaMapped = {
  leadId: string;
  formId: string;
  timestamp: string;
  entry?: NonNullable<ReturnType<typeof validateWinEntry>['entry']>;
  error?: string;
};

const slug = (x: string): string => x.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const id = (x: unknown) => typeof x === 'string' && /^\d{5,25}$/.test(x);
const check = (value: unknown) => value === '1' || value === 1 || value === true;

export function metaIntegrationConfigured(env: Record<string, any>): boolean {
  return env.WIN_META_IMPORT_ENABLED === 'true' &&
    id(env.WIN_META_PAGE_ID) && id(env.WIN_META_FORM_ID) &&
    typeof env.WIN_META_TERMS_KEY === 'string' && /^[a-zA-Z0-9_-]{3,100}$/.test(env.WIN_META_TERMS_KEY) &&
    env.WIN_META_TERMS_KEY !== 'pending' &&
    typeof env.WIN_META_APP_SECRET === 'string' && env.WIN_META_APP_SECRET.length >= 16 &&
    typeof env.WIN_META_VERIFY_TOKEN === 'string' && env.WIN_META_VERIFY_TOKEN.length >= 24 &&
    typeof env.WIN_META_PAGE_TOKEN === 'string' && env.WIN_META_PAGE_TOKEN.length >= 20 &&
    typeof env.WIN_DB?.prepare === 'function' && typeof env.WIN_DB?.batch === 'function';
}

export function mapMetaWinLead(lead: MetaLead, env: Record<string, any>): MetaMapped {
  const leadId = id(lead.id) ? String(lead.id) : '';
  const formId = id(lead.form_id) ? String(lead.form_id) : '';
  const dateString = typeof lead.created_time === 'string'
    ? lead.created_time.replace(/([+-]\d{2})(\d{2})$/, '$1:$2') : '';
  const at = Date.parse(dateString);
  const timestamp = Number.isFinite(at) ? new Date(at).toISOString() : '';
  const start = { leadId, formId, timestamp };
  if (!leadId || formId !== env.WIN_META_FORM_ID || !timestamp) return { ...start, error: 'invalid_lead_metadata' };
  // Assess the entrant's SUBMISSION TIME, not webhook delivery time.
  // A lead arriving just after closing still counts if submitted before closing.
  if (winState(env, at).phase !== 'open') return { ...start, error: 'outside_published_entry_period' };
  const fields = new Map<string, string>();
  if (!Array.isArray(lead.field_data)) return { ...start, error: 'missing_form_questions' };
  for (const row of lead.field_data as MetaField[]) {
    if (typeof row?.name !== 'string' || !Array.isArray(row.values) || typeof row.values[0] !== 'string') continue;
    const name = slug(row.name);
    if (!fields.has(name)) fields.set(name, (row.values[0] as string).trim());
  }
  const read = (...keys: string[]): string => keys.map(k => fields.get(k)).find(x => typeof x === 'string' && x.length > 0) || '';
  const boxes = new Map<string, unknown>();
  if (Array.isArray(lead.custom_disclaimer_responses)) {
    for (const row of lead.custom_disclaimer_responses as MetaCheck[]) {
      if (typeof row?.checkbox_key === 'string') boxes.set(row.checkbox_key, row.is_checked);
    }
  }
  // The mandatory checkbox must clearly state 18+, eligible mainland Auckland
  // property/authority, prize terms and one-entry rule (see integration guide).
  // It is a self-declaration, NOT independent proof of age or authority.
  if (!check(boxes.get(env.WIN_META_TERMS_KEY))) return { ...start, error: 'missing_terms_and_eligibility_agreement' };
  const full_name = read('full_name');
  const email = read('email', 'email_address').toLowerCase();
  const phone = read('phone_number', 'phone');
  if (full_name.length < 2 || full_name.length > 100 ||
      email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      phone.length < 6 || phone.length > 30 || !/^[+()0-9\s.-]+$/.test(phone)) {
    return { ...start, error: 'missing_or_invalid_contact_information' };
  }
  // NO fabricated Auckland suburb, work category or property relationship.
  // Unlike the more detailed website form, Meta only collects three contact fields.
  // Empty values are legitimate in the existing D1 TEXT NOT NULL columns and must
  // be checked against the published eligibility conditions before the prize is awarded.
  const entry = {
    full_name, email, phone,
    suburb: '', property_role: '', service_type: '', work_details: '',
    marketing_opt_in: typeof env.WIN_META_MARKETING_KEY === 'string' &&
      env.WIN_META_MARKETING_KEY !== env.WIN_META_TERMS_KEY &&
      check(boxes.get(env.WIN_META_MARKETING_KEY)) ? 1 : 0,
  };
  return { ...start, entry };
}

/** Meta sends an HMAC SHA-256 over the *raw* request bytes. */
export async function verifyMetaSignature(body: ArrayBuffer, signature: string | null, secret: string): Promise<boolean> {
  if (!signature || !/^sha256=[0-9a-f]{64}$/i.test(signature) || !secret) return false;
  const hex = signature.slice(7);
  const bytes = new Uint8Array(32);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, bytes, body);
}

export async function metaAppSecretProof(token: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(token)));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function fetchMetaLead(leadId: string, env: Record<string, any>): Promise<MetaLead> {
  if (!id(leadId)) throw new Error('Invalid Meta lead identifier');
  const url = new URL('https://graph.facebook.com/v27.0/' + leadId);
  url.searchParams.set('fields', 'id,created_time,form_id,field_data,custom_disclaimer_responses');
  url.searchParams.set('appsecret_proof', await metaAppSecretProof(env.WIN_META_PAGE_TOKEN, env.WIN_META_APP_SECRET));
  const response = await fetch(url, {
    headers: { Authorization: 'Bearer ' + env.WIN_META_PAGE_TOKEN },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error('Meta Lead Retrieval unavailable');
  const json = await response.json() as MetaLead;
  if (json.id !== leadId) throw new Error('Meta lead identifier mismatch');
  return json;
}

/** D1 batches are atomic. Rows logged as duplicates are not eligible for a second entry.
 * We never store a full Meta webhook/lead payload or the Page access token. */
export async function storeMetaLead(lead: MetaMapped, db: any): Promise<'accepted'|'duplicate'|'rejected'|'already_seen'> {
  if (!lead.leadId || !lead.formId) throw new Error('Missing Meta lead identity');
  const seen = await db.prepare('SELECT status FROM win_meta_leads WHERE lead_id=?').bind(lead.leadId).first();
  if (seen) return 'already_seen';
  const stamp = new Date().toISOString();
  if (!lead.entry) {
    const rejected = await db.prepare('INSERT OR IGNORE INTO win_meta_leads (lead_id, form_id, received_at, status, reason) VALUES (?,?,?,\'rejected\',?)')
      .bind(lead.leadId, lead.formId, stamp, lead.error || 'invalid_fields').run();
    if (!rejected?.success) throw new Error('Could not record invalid Meta submission');
    return 'rejected';
  }
  const row = lead.entry, entryId = crypto.randomUUID();
  const results = await db.batch([
    db.prepare('INSERT OR IGNORE INTO win_entries (id, created_at, full_name, email, phone, suburb, property_role, service_type, work_details, marketing_opt_in) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .bind(entryId, lead.timestamp, row.full_name, row.email, row.phone, row.suburb, row.property_role, row.service_type, row.work_details, row.marketing_opt_in),
    db.prepare(`INSERT OR IGNORE INTO win_meta_leads (lead_id, entry_id, form_id, received_at, status, reason)
      SELECT ?, CASE WHEN EXISTS (SELECT 1 FROM win_entries WHERE id=?) THEN ? ELSE NULL END,
        ?, ?, CASE WHEN EXISTS (SELECT 1 FROM win_entries WHERE id=?) THEN 'accepted' ELSE 'duplicate' END, NULL`)
      .bind(lead.leadId, entryId, entryId, lead.formId, stamp, entryId),
  ]);
  if (!results?.[0]?.success || !results?.[1]?.success) throw new Error('Could not record Meta entry');
  return results[0].meta?.changes === 1 ? 'accepted' : 'duplicate';
}
