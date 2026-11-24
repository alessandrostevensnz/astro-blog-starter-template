/** ANDRO public giveaway configuration and validation. Nothing is open until setup is complete. */
export type WinPhase = 'setup' | 'upcoming' | 'open' | 'closed';
export type WinState = {
  phase: WinPhase;
  openAt?: string;
  closeAt?: string;
  drawAt?: string;
  turnstileSiteKey?: string;
};
export type WinEntry = {
  id: string;
  created_at: string;
  full_name: string;
  email: string;
  phone: string;
  suburb: string;
  property_role: string;
  service_type: string;
  work_details: string;
  marketing_opt_in: number;
  status: string;
  selected_at: string | null;
};

export function winState(env: Record<string, any>, at = Date.now()): WinState {
  const openAt = typeof env.WIN_OPEN_AT === 'string' ? env.WIN_OPEN_AT.trim() : '';
  const closeAt = typeof env.WIN_CLOSE_AT === 'string' ? env.WIN_CLOSE_AT.trim() : '';
  const drawAt = typeof env.WIN_DRAW_AT === 'string' ? env.WIN_DRAW_AT.trim() : '';
  const dateWithZone = /^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?(?:Z|[+-]\d\d:\d\d)$/;
  // A fixed, published opening date with timezone is required before any entries.
  // "launch" and other ambiguous values must fail closed.
  const open = Date.parse(openAt);
  const close = Date.parse(closeAt), draw = Date.parse(drawAt);
  const contactAddress = typeof env.WIN_BUSINESS_POSTAL_ADDRESS === 'string' ? env.WIN_BUSINESS_POSTAL_ADDRESS.trim() : '';
  const ready = env.WIN_ENTRIES_ENABLED === 'true' &&
    contactAddress.length >= 8 && contactAddress.toLowerCase() !== 'pending' &&
    [openAt, closeAt, drawAt].every(x => dateWithZone.test(x)) &&
    [open, close, draw].every(Number.isFinite) &&
    open < close && close <= draw &&
    typeof env.WIN_TURNSTILE_SITE_KEY === 'string' && env.WIN_TURNSTILE_SITE_KEY.trim().length > 0 &&
    typeof env.WIN_TURNSTILE_SECRET_KEY === 'string' && env.WIN_TURNSTILE_SECRET_KEY.trim().length > 0 &&
    typeof env.WIN_DB?.prepare === 'function' &&
    typeof env.REPORT_PASSWORD === 'string' && env.REPORT_PASSWORD.length >= 10 &&
    typeof env.REPORT_SESSION_SECRET === 'string' && env.REPORT_SESSION_SECRET.length >= 32;
  if (!ready) return { phase: 'setup' };
  const shared = { openAt, closeAt, drawAt, turnstileSiteKey: env.WIN_TURNSTILE_SITE_KEY.trim() };
  if (at < open) return { phase: 'upcoming', ...shared };
  if (at >= close) return { phase: 'closed', ...shared };
  return { phase: 'open', ...shared };
}

/** Prevent opening entries if the existing entries table or new draw/exclusion audit
 * tables have not been installed in the same production Cloudflare D1 database.
 * A schema-only read works with an empty database without exposing entrant data. */
export async function winAuditReady(env: Record<string, any>): Promise<boolean> {
  const db = env?.WIN_DB;
  if (typeof db?.prepare !== 'function') return false;
  try {
    for (const statement of [
      'SELECT id FROM win_entries LIMIT 0',
      'SELECT entry_id FROM win_entry_exclusions LIMIT 0',
      'SELECT id FROM win_draw_events LIMIT 0',
    ]) {
      await db.prepare(statement).all();
    }
    return true;
  } catch {
    return false;
  }
}

export function nzDate(iso: string | undefined): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-NZ', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Pacific/Auckland',
  }).format(new Date(iso));
}

export function validateWinEntry(form: FormData): { error?: string; entry?: {
  full_name: string; email: string; phone: string; suburb: string;
  property_role: string; service_type: string; work_details: string;
  marketing_opt_in: number;
} } {
  const get = (key: string) => {
    const value = form.get(key);
    return typeof value === 'string' ? value.trim() : '';
  };
  const full_name = get('full_name');
  const email = get('email').toLowerCase();
  const phone = get('phone');
  const suburb = get('suburb');
  const property_role = get('property_role');
  const service_type = get('service_type');
  const work_details = get('work_details');

  if (full_name.length < 2 || full_name.length > 100) return { error: 'Please enter your full name.' };
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Please enter a valid email address.' };
  if (phone.length < 6 || phone.length > 30 || !/^[+()0-9\s.-]+$/.test(phone)) return { error: 'Please enter a valid phone number.' };
  if (suburb.length < 2 || suburb.length > 80) return { error: 'Please enter your Auckland suburb.' };
  if (!['Owner', 'Property manager', 'Tenant with owner permission'].includes(property_role)) return { error: 'Please choose your relationship to the property.' };
  if (!['Property maintenance', 'Handyman work', 'Minor building repairs', 'Other eligible work'].includes(service_type)) return { error: 'Please choose the work category.' };
  if (work_details.length < 20 || work_details.length > 1200) return { error: 'Please describe the work in 20 to 1,200 characters.' };
  if (get('authority') !== 'yes') return { error: 'You must have permission for work at this property.' };
  if (get('terms') !== 'yes') return { error: 'Please accept the giveaway terms.' };
  if (get('age') !== 'yes') return { error: 'You must be 18 or older to enter.' };
  return { entry: {
    full_name, email, phone, suburb, property_role, service_type, work_details,
    marketing_opt_in: get('marketing') === 'yes' ? 1 : 0,
  } };
}

export function noStoreHeaders(): Record<string, string> {
  return {
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Robots-Tag': 'noindex, nofollow',
    'X-Content-Type-Options': 'nosniff',
  };
}

export function sameOriginPost(request: Request): boolean {
  return request.headers.get('origin') === new URL(request.url).origin;
}

export function randomOffset(count: number): number {
  if (!Number.isSafeInteger(count) || count < 1 || count > 0xffffffff) throw new Error('Invalid entry count');
  const max = 0x100000000;
  const ceiling = Math.floor(max / count) * count;
  const words = new Uint32Array(1);
  do { crypto.getRandomValues(words); } while (words[0] >= ceiling);
  return words[0] % count;
}
