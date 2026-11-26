import { defineMiddleware } from 'astro:middleware';
import { configured, validSession, COOKIE } from './lib/report-auth';
import { noStoreHeaders } from './lib/win';

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

  // Analytics is private, independent of giveaway and report sessions.
  if (path === '/analytics' || path.startsWith('/analytics/')) {
    const env = (context.locals as any).runtime?.env ?? {};
    if (!configured(env)) return failClosed('Analytics sign-in is not configured.');
    const login = /^\/analytics\/login\/?$/.test(path);
    if (login && context.request.method === 'POST') {
      try {
        if (!env.REPORT_LOGIN_IP_LIMITER || !env.REPORT_LOGIN_GLOBAL_LIMITER) return failClosed('Login protection unavailable.');
        const ip = context.request.headers.get('CF-Connecting-IP') || 'unknown-client';
        const [a,b] = await Promise.all([
          env.REPORT_LOGIN_IP_LIMITER.limit({key:'analytics-login:' + ip}),
          env.REPORT_LOGIN_GLOBAL_LIMITER.limit({key:'analytics-login-global'})
        ]);
        if (!a.success || !b.success) return new Response('Too many sign-in attempts. Please retry later.',{status:429,headers:{...protectedHeaders,'Retry-After':'60'}});
      } catch { return failClosed('Login protection unavailable.'); }
    }
    if (!login && !(await validSession(context.cookies.get('andro_analytics_session')?.value,env.REPORT_SESSION_SECRET))) {
      return context.redirect('/analytics/login',303);
    }
    const response = await next();
    Object.entries(protectedHeaders).forEach(([key,value]) => response.headers.set(key,value));
    return response;
  }

  // Protect the giveaway administration HTML and API, without changing public /win.
  const winPrivate = path === '/win/admin' || path === '/win/admin/' || path.startsWith('/win/admin/') || path.startsWith('/api/win/admin/');
  if (winPrivate) {
    const env = (context.locals as any).runtime?.env ?? {};
    if (!configured(env)) return new Response('Giveaway administration is not configured.', { status: 503, headers: noStoreHeaders() });
    const login = path === '/win/admin/login' || path === '/win/admin/login/';
    if (login && context.request.method === 'POST') {
      const perIp = env.REPORT_LOGIN_IP_LIMITER as RateLimiter | undefined;
      const global = env.REPORT_LOGIN_GLOBAL_LIMITER as RateLimiter | undefined;
      if (typeof perIp?.limit !== 'function' || typeof global?.limit !== 'function') return new Response('Login protection unavailable.', { status: 503, headers: noStoreHeaders() });
      const ip = context.request.headers.get('CF-Connecting-IP') || 'unknown-client';
      try {
        const [ipResult, globalResult] = await Promise.all([
          perIp.limit({ key: 'win-admin-login:' + ip }),
          global.limit({ key: 'win-admin-login-all' }),
        ]);
        if (!ipResult.success || !globalResult.success) return new Response('Too many sign-in attempts. Please retry later.', { status: 429, headers: { ...noStoreHeaders(), 'Retry-After': '60' } });
      } catch {
        return new Response('Login protection unavailable.', { status: 503, headers: noStoreHeaders() });
      }
    }
    if (!login && !(await validSession(context.cookies.get('andro_win_admin')?.value, env.REPORT_SESSION_SECRET))) {
      if (path.startsWith('/api/')) return new Response('Sign in required.', { status: 401, headers: noStoreHeaders() });
      return context.redirect('/win/admin/login', 303);
    }
    const response = await next();
    Object.entries(noStoreHeaders()).forEach(([key, value]) => response.headers.set(key, value));
    return response;
  }

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
