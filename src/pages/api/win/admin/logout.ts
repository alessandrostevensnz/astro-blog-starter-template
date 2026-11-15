import type { APIRoute } from 'astro';
import { sameOriginPost, noStoreHeaders } from '../../../../lib/win';
export const prerender = false;
export const POST: APIRoute = ({ request, cookies }) => {
  if (!sameOriginPost(request)) return new Response('Forbidden', { status: 403, headers: noStoreHeaders() });
  cookies.delete('andro_win_admin', { path: '/' });
  return new Response(null, { status: 303, headers: { ...noStoreHeaders(), Location: '/win/admin/login' } });
};