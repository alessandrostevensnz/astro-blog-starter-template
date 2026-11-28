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
    construction_work?: unknown;
    future_project?: unknown;
  };
};

const leadId = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  const cleaned = value.replace(/^[lf]:/i, '').trim();
  return /^\d{5,25}$/.test(cleaned) ? cleaned : '';
};

export function sheetsConnectionConfigured(env: Record<string, any>): boolean {
  return typeof env.WIN_META_SHEETS_SYNC_SECRET === 'string' &&
    env.WIN_META_SHEETS_SYNC_SECRET.length >= 32 &&
    /^\d{5,25}$/.test(String(env.WIN_META_FORM_ID || '')) &&
    typeof env.WIN_DB?.prepare === 'function' &&
    typeof env.WIN_DB?.batch === 'function';
}

/** Actual entry writes always require both independent production switches. */
export function sheetsImportConfigured(env: Record<string, any>): boolean {
  return env.WIN_META_IMPORT_ENABLED === 'true' &&
    env.WIN_META_SHEETS_SYNC_ENABLED === 'true' &&
    sheetsConnectionConfigured(env);
}

/** The already-installed Apps Script connection check sends only these fields.
 * Permit this exact no-consent, no-contact payload for authenticated dry runs. */
export function isSheetsConnectionProbe(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  const p = payload as MetaSheetsPayload;
  const rootKeys = Object.keys(p);
  const lead = p.lead;
  if (rootKeys.length !== 3 || !rootKeys.every(k => ['source','sent_at','lead'].includes(k)) ||
      p.source !== 'meta_google_sheets' || !lead || typeof lead !== 'object' ||
      Array.isArray(lead) || lead.terms_accepted !== false) return false;
  const keys = Object.keys(lead);
  return keys.length === 4 && keys.every(k => ['id','form_id','created_time','terms_accepted'].includes(k)) &&
    typeof lead.id === 'string' && typeof lead.form_id === 'string' && typeof lead.created_time === 'string';
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
  const originalForm = leadId(env.WIN_META_FORM_ID);
  const v2Form = leadId(env.WIN_META_SHEETS_V2_FORM_ID);
  const isV2 = Boolean(v2Form && v2Form !== originalForm && formKey === v2Form);
  const v3Form = leadId(env.WIN_META_SHEETS_V3_FORM_ID);
  const isV3 = Boolean(v3Form && v3Form !== originalForm && v3Form !== v2Form && formKey === v3Form);
  if (!leadKey || !formKey || (formKey !== originalForm && !isV2 && !isV3) ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:?\d\d)$/.test(stamp) ||
      !timestamp) return { ...base, error: 'invalid_lead_metadata' };
  // Validate original form-submission time, never the delayed Sheet sync time.
  if (winState(env, submittedAt).phase !== 'open') return { ...base, error: 'outside_promotion_period' };
  if (lead?.terms_accepted !== true) return { ...base, error: 'terms_acknowledgement_not_captured' };
  const full_name = typeof lead.full_name === 'string' ? lead.full_name.trim() : '';
  const email = typeof lead.email === 'string' ? lead.email.trim().toLowerCase() : '';
  const phone = typeof lead.phone_number === 'string' ? lead.phone_number.trim() : '';
  if (leadKey === '2345261342938853' || email === 'test@meta.com' || /<test lead:/i.test(full_name)) return { ...base, error: 'meta_sample_lead' };
  if (full_name.length < 2 || full_name.length > 100 ||
      email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      phone.length < 6 || phone.length > 30 || !/^[+()0-9\s.-]+$/.test(phone)) {
    return { ...base, error: 'invalid_contact_details' };
  }
  // V3's first answer fits service_type. For V3 ONLY, work_details stores the
  // second (12-month project intent) answer. The admin and CSV label both
  // separately by form ID; no database migration or reinterpretation of old rows.
  const construction = isV3 && typeof lead.construction_work === 'string'
    ? lead.construction_work.trim().replace(/_/g,' ').replace(/\s+/g,' ').slice(0,200) : '';
  const rawFuture = isV3 && typeof lead.future_project === 'string'
    ? lead.future_project.trim().replace(/_/g,' ').toLowerCase() : '';
  const future = ['Yes','Maybe','No','Prefer not to say'].find(answer => answer.toLowerCase() === rawFuture) || '';
  // Never invent suburb, property relationship, or uncollected answers.
  // They must be verified for the provisional winner before awarding the prize.
  return { ...base, entry: {
    full_name, email, phone,
    suburb: '', property_role: '', service_type: construction, work_details: future,
    // The original Instant Form never asked for marketing permission.
    // Only an affirmative response to the approved V2 question can opt in.
    marketing_opt_in: (isV2 || isV3) && lead.marketing_consent === true ? 1 : 0,
  } };
}

export function sheetsPayloadIsRecent(payload: MetaSheetsPayload, now = Date.now()): boolean {
  if (payload?.source !== 'meta_google_sheets' || typeof payload?.sent_at !== 'string') return false;
  const sent = Date.parse(payload.sent_at);
  return Number.isFinite(sent) && Math.abs(now - sent) < 5 * 60 * 1000;
}
