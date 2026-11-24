/** Server-side validation of HMAC-signed ANDRO Google Sheets lead imports.
 * The original Google Sheet must capture a Meta form's affirmative terms response;
 * an invented column or owner's assumption is NOT sufficient consent evidence.
 */
import { winState } from './win.ts';
import type { MetaMapped } from './win-meta.ts';

export type MetaSheetsPayload = {
  source?: unknown;
  sent_at?: unknown;
  lead?: {
    id?: unknown;
    form_id?: unknown;
    created_time?: unknown;
    full_name?: unknown;
    email?: unknown;
    phone_number?: unknown;
    terms_accepted?: unknown;
    marketing_consent?: unknown;
  };
};

const leadId = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  const cleaned = value.replace(/^[lf]:/i, '').trim();
  return /^\d{5,25}$/.test(cleaned) ? cleaned : '';
};

export function sheetsImportConfigured(env: Record<string, any>): boolean {
  return env.WIN_META_IMPORT_ENABLED === 'true' &&
    env.WIN_META_SHEETS_SYNC_ENABLED === 'true' &&
    typeof env.WIN_META_SHEETS_SYNC_SECRET === 'string' &&
    env.WIN_META_SHEETS_SYNC_SECRET.length >= 32 &&
    /^\d{5,25}$/.test(String(env.WIN_META_FORM_ID || '')) &&
    typeof env.WIN_DB?.prepare === 'function' &&
    typeof env.WIN_DB?.batch === 'function';
}

export function mapSheetsWinLead(payload: MetaSheetsPayload, env: Record<string, any>, now = Date.now()): MetaMapped {
  const lead = payload?.lead;
  const leadKey = leadId(lead?.id);
  const formKey = leadId(lead?.form_id);
  const when = lead?.created_time;
  const stamp = typeof when === 'string' ? when.trim() : '';
  const submittedAt = Date.parse(stamp);
  const timestamp = Number.isFinite(submittedAt) ? new Date(submittedAt).toISOString() : '';
  const base = { leadId: leadKey, formId: formKey, timestamp };
  if (!leadKey || !formKey || formKey !== String(env.WIN_META_FORM_ID) ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:?\d\d)$/.test(stamp) ||
      !timestamp) return { ...base, error: 'invalid_lead_metadata' };
  // Validate original form-submission time, never the delayed Sheet sync time.
  if (winState(env, submittedAt).phase !== 'open') return { ...base, error: 'outside_promotion_period' };
  if (lead?.terms_accepted !== true) return { ...base, error: 'terms_acknowledgement_not_captured' };
  const full_name = typeof lead.full_name === 'string' ? lead.full_name.trim() : '';
  const email = typeof lead.email === 'string' ? lead.email.trim().toLowerCase() : '';
  const phone = typeof lead.phone_number === 'string' ? lead.phone_number.trim() : '';
  if (email === 'test@meta.com' || /<test lead:/i.test(full_name)) return { ...base, error: 'meta_sample_lead' };
  if (full_name.length < 2 || full_name.length > 100 ||
      email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      phone.length < 6 || phone.length > 30 || !/^[+()0-9\s.-]+$/.test(phone)) {
    return { ...base, error: 'invalid_contact_details' };
  }
  // These weren't collected by the three-field Instant Form. Never invent them.
  // They must be verified for the provisional winner before awarding the prize.
  return { ...base, entry: {
    full_name, email, phone,
    suburb: '', property_role: '', service_type: '', work_details: '',
    marketing_opt_in: lead.marketing_consent === true ? 1 : 0,
  } };
}

export function sheetsPayloadIsRecent(payload: MetaSheetsPayload, now = Date.now()): boolean {
  if (payload?.source !== 'meta_google_sheets' || typeof payload?.sent_at !== 'string') return false;
  const sent = Date.parse(payload.sent_at);
  return Number.isFinite(sent) && Math.abs(now - sent) < 5 * 60 * 1000;
}
