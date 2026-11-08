const encoder = new TextEncoder();
const COOKIE = 'andro_report_session';
export function configured(env: Record<string, unknown>) {
  return typeof env.REPORT_PASSWORD === 'string' && env.REPORT_PASSWORD.length >= 16 &&
    typeof env.REPORT_SESSION_SECRET === 'string' && env.REPORT_SESSION_SECRET.length >= 32;
}
function key(secret: string) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
function hex(bytes: Uint8Array) { return [...bytes].map(b => b.toString(16).padStart(2, '0')).join(''); }
async function digest(s: string) { return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(s))); }
export async function checkPassword(input: string, expected: string) {
  const a = await digest(input), b = await digest(expected);
  let mismatch = 0; for (let i = 0; i < a.length; i++) mismatch |= a[i] ^ b[i];
  return mismatch === 0;
}
export async function issueSession(secret: string) {
  const expiry = Math.floor(Date.now() / 1000) + 8 * 60 * 60;
  const payload = String(expiry);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(payload)));
  return payload + '.' + hex(signature);
}
export async function validSession(value: string | undefined, secret: string) {
  if (!value) return false;
  const parts = value.split('.');
  if (parts.length !== 2 || !/^\\d{10}$/.test(parts[0]) || !/^[a-f0-9]{64}$/.test(parts[1])) return false;
  const expiry = Number(parts[0]);
  if (expiry <= Date.now() / 1000 || expiry > Date.now() / 1000 + 8 * 60 * 60) return false;
  const expected = new Uint8Array(await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(parts[0])));
  let mismatch = 0; for (let i = 0; i < expected.length; i++) mismatch |= expected[i] ^ parseInt(parts[1].slice(i * 2, i * 2 + 2), 16);
  return mismatch === 0;
}
export { COOKIE };
