import { defineMiddleware } from 'astro:middleware';
import { configured, validSession, COOKIE } from './lib/report-auth';
export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;
  if (path !== '/report' && path !== '/report/' && !path.startsWith('/report/')) return next();
  const env = (context.locals as any).runtime?.env ?? {};
  if (!configured(env)) return new Response('Reporting login is not configured.', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  if (path !== '/report/login' && path !== '/report/login/') {
    const valid = await validSession(context.cookies.get(COOKIE)?.value, env.REPORT_SESSION_SECRET);
    if (!valid) return context.redirect('/report/login', 303);
  }
  const response = await next();
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
});
