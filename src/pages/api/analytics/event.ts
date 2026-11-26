import type { APIRoute } from 'astro';
import { PAGES, SOURCES, DEVICES, OWNER_COOKIE, nzDay, noTracking } from '../../../lib/analytics';
import { sameOriginPost } from '../../../lib/win';
export const prerender = false;
const reply = (status = 204) => new Response(null,{status,headers:{'Cache-Control':'no-store'}});
export const POST: APIRoute = async ({request, locals, cookies}) => {
  if (!sameOriginPost(request)) return reply(403);
  if (noTracking(request) || (request as any).cf?.botManagement?.verifiedBot) return reply();
  if (!request.headers.get('content-type')?.startsWith('application/json')) return reply(415);
  if (Number(request.headers.get('content-length')) > 512) return reply(413);
  const env = (locals as any).runtime?.env ?? {};
  if (!env.WIN_DB || !env.REPORT_LOGIN_IP_LIMITER || !env.REPORT_LOGIN_GLOBAL_LIMITER) return reply(503);
  // Separate keys in the existing rate-limit bindings. No IP is written to analytics storage.
  try {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const [a,b] = await Promise.all([
      env.REPORT_LOGIN_IP_LIMITER.limit({key:'analytics-event:' + ip}),
      env.REPORT_LOGIN_GLOBAL_LIMITER.limit({key:'analytics-events-global'})
    ]);
    if (!a.success || !b.success) return reply(429);
    const reader = request.body?.getReader();
    if (!reader) return reply(400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const {done,value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 512) { await reader.cancel(); return reply(413); }
      chunks.push(value);
    }
    const buffer = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { buffer.set(chunk,offset); offset += chunk.byteLength; }
    const event = JSON.parse(new TextDecoder().decode(buffer));
    if (!event || !PAGES.includes(event.page) || !SOURCES.includes(event.source) || !DEVICES.includes(event.device)) return reply(400);
    if (event.kind !== 'view' && !(event.kind === 'entry' && event.page === 'Win a Day')) return reply(400);
    const view = event.kind === 'view' ? 1 : 0;
    const owner = cookies.get(OWNER_COOKIE)?.value === '1' ? 1 : 0;
    await env.WIN_DB.prepare(`INSERT INTO andro_analytics_daily(day,page,source,device,owner,views,sessions,entries)
      VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(day,page,source,device,owner) DO UPDATE SET
      views=views+excluded.views,sessions=sessions+excluded.sessions,entries=entries+excluded.entries`)
      .bind(nzDay(),event.page,event.source,event.device,owner,view,view && event.start === true ? 1 : 0,view ? 0 : 1).run();
    return reply();
  } catch { return reply(503); }
};
