import type { APIRoute } from 'astro';
import { sameOriginPost, validateWinEntry, winState } from '../../../lib/win';
export const prerender = false;

const json = (value: object, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any).runtime?.env ?? {};
  if (winState(env).phase !== 'open') return json({ error: 'Entries are not currently open.' }, 503);
  if (!sameOriginPost(request)) return json({ error: 'Invalid submission origin.' }, 403);
  const size = Number(request.headers.get('content-length'));
  if (Number.isFinite(size) && size > 18000) return json({ error: 'Submission is too large.' }, 413);
  let form: FormData;
  try { form = await request.formData(); } catch { return json({ error: 'Invalid form.' }, 400); }
  const fields = [...form.entries()];
  if (fields.length > 22 || fields.some(([key, value]) => typeof value !== 'string' || value.length > 4000)) return json({ error: 'Invalid submission.' }, 400);
  if (form.get('website')) return json({ success: true });
  const parsed = validateWinEntry(form);
  if (parsed.error || !parsed.entry) return json({ error: parsed.error || 'Please check your details.' }, 400);
  const token = String(form.get('cf-turnstile-response') ?? '');
  if (!token || token.length > 2048) return json({ error: 'Please complete the security check.' }, 400);
  const verifyBody = new URLSearchParams({
    secret: env.WIN_TURNSTILE_SECRET_KEY,
    response: token,
    remoteip: request.headers.get('CF-Connecting-IP') || '',
  });
  try {
    const verification = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: verifyBody.toString(),
    });
    const result = await verification.json() as { success?: boolean; hostname?: string; action?: string };
    const host = new URL(request.url).hostname;
    if (!verification.ok || result.success !== true || result.hostname !== host || result.action !== 'andro-win-entry') {
      return json({ error: 'Security check failed. Please try again.' }, 403);
    }
  } catch {
    return json({ error: 'Security check temporarily unavailable.' }, 503);
  }
  const entry = parsed.entry;
  try {
    await env.WIN_DB.prepare(
      'INSERT OR IGNORE INTO win_entries (id, created_at, full_name, email, phone, suburb, property_role, service_type, work_details, marketing_opt_in) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), new Date().toISOString(), entry.full_name, entry.email, entry.phone, entry.suburb,
      entry.property_role, entry.service_type, entry.work_details, entry.marketing_opt_in).run();
    return json({ success: true });
  } catch {
    return json({ error: 'Entries are temporarily unavailable. Please try again later.' }, 503);
  }
};
