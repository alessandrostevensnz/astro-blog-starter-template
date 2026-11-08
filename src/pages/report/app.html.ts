import type { APIRoute } from 'astro';
import { reportHtml } from '../../lib/report-app';
export const prerender = false;
export const GET: APIRoute = () => new Response(reportHtml, {
  headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow' }
});
