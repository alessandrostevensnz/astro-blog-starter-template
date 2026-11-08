import { defineMiddleware } from 'astro:middleware';
import { configured, validSession, COOKIE } from './lib/report-auth';

type RateLimiter = { limit: (options: { key: string }) => Promise<{ success: boolean }> };

const protectedHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow',
};

function failClosed(message: string): Response {
  return new Response(message, { status: 503, headers: protectedHeaders });
}

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;

  // All unrelated routes, including /admin and the public site, are untouched.
  if (path !== '/report' && path !== '/report/' && !path.startsWith('/report/')) return next();

  const env = (context.locals as any).runtime?.env ?? {};
  if (!configured(env)) return failClosed('Reporting login is not configured.');

  const isLogin = path === '/report/login' || path === '/report/login/';
  if (isLogin && context.request.method === 'POST') {
    // Enforce limits BEFORE reading the password or doing any password verification.
    // Cloudflare's rate limits are approximate and scoped per data center.
    const perIp = env.REPORT_LOGIN_IP_LIMITER as RateLimiter | undefined;
    const global = env.REPORT_LOGIN_GLOBAL_LIMITER as RateLimiter | undefined;

    // Never allow unrestricted password attempts when the bindings are absent.
    if (typeof perIp?.limit !== 'function' || typeof global?.limit !== 'function') {
      return failClosed('Reporting login protection is not configured.');
    }

    // CF-Connecting-IP is provided by Cloudflare; do not use user-controlled X-Forwarded-For.
    const clientIp = context.request.headers.get('CF-Connecting-IP') || 'unknown-client';

    try {
      const [clientResult, globalResult] = await Promise.all([
        perIp.limit({ key: 'report-login-ip:' + clientIp }),
        global.limit({ key: 'report-login-shared-password' }),
      ]);
      if (!clientResult.success || !globalResult.success) {
        return new Response('Too many sign-in attempts. Please wait a minute before trying again.', {
          status: 429,
          headers: { ...protectedHeaders, 'Retry-After': '60' },
        });
      }
    } catch {
      return failClosed('Reporting login protection is temporarily unavailable.');
    }
  }

  if (!isLogin) {
    const valid = await validSession(context.cookies.get(COOKIE)?.value, env.REPORT_SESSION_SECRET);
    if (!valid) return context.redirect('/report/login', 303);
  }

  const response = await next();
  response.headers.set('Cache-Control', protectedHeaders['Cache-Control']);
  response.headers.set('X-Robots-Tag', protectedHeaders['X-Robots-Tag']);
  return response;
});
