// Aggregate-only analytics. No client IDs, full referrers, IPs, or entry details are stored.
export const PAGES = ['Home','Construction','Projects','About','Contact','Win a Day'] as const;
export const SOURCES = ['Facebook / Instagram','Google','Direct / unknown','Other website','Other campaign'] as const;
export const DEVICES = ['Mobile','Tablet','Desktop / other'] as const;
export const TABLE = 'andro_analytics_daily';
// The owner flag is a reporting preference, never an authentication credential.
// A new name avoids collisions with the old host-only cookie.
export const LEGACY_OWNER_COOKIE = 'andro_analytics_owner';
export const OWNER_COOKIE = 'andro_analytics_owner_v2';
export function ownerCookieScope(hostname: string) {
  return /^(www\.)?andro\.co\.nz$/i.test(hostname) ? {domain:'andro.co.nz',path:'/'} : {path:'/'};
}
export function ownerMarked(request: Request): boolean {
  return (request.headers.get('cookie') || '').split(';').some(part => part.trim() === OWNER_COOKIE + '=1');
}
export const AUTH_COOKIE = 'andro_analytics_session';
export const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS andro_analytics_daily (
  day TEXT NOT NULL, page TEXT NOT NULL, source TEXT NOT NULL, device TEXT NOT NULL,
  owner INTEGER NOT NULL CHECK(owner IN (0,1)),
  views INTEGER NOT NULL DEFAULT 0, sessions INTEGER NOT NULL DEFAULT 0, entries INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(day,page,source,device,owner)
) WITHOUT ROWID`;
export function nzDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-NZ', {timeZone:'Pacific/Auckland',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const part = (type: string) => parts.find(p => p.type === type)?.value;
  return part('year') + '-' + part('month') + '-' + part('day');
}
export function dayBefore(day: string, days: number) {
  const d = new Date(day + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0,10);
}
export function noTracking(request: Request) {
  const ua = request.headers.get('user-agent') || '';
  return !ua || /bot|crawler|spider|headless|preview|facebookexternalhit|curl|wget/i.test(ua)
    || request.headers.get('sec-gpc') === '1' || request.headers.get('dnt') === '1';
}
