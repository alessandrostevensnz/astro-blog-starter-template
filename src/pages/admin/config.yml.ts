import type { APIRoute } from 'astro';
import { cmsConfig } from '../../lib/cms-config';

// JSON is valid YAML. Build this into a static file at Decap's existing URL.
export const prerender = true;
export const GET: APIRoute = () => new Response(JSON.stringify(cmsConfig, null, 2), {
  headers: { 'Content-Type': 'application/yaml; charset=utf-8' },
});
