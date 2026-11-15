import type { APIRoute } from 'astro';
import { noStoreHeaders } from '../../../../lib/win';
export const prerender = false;
function cell(value: unknown): string {
  let raw = String(value ?? '').replace(/\r\n?/g, '\n');
  // Block spreadsheet formula injection, even if a cell starts with whitespace.
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(raw)) raw = "'" + raw;
  return '"' + raw.replace(/"/g, '""') + '"';
}
export const GET: APIRoute = async ({ locals }) => {
  const env = (locals as any).runtime?.env ?? {};
  if (!env.WIN_DB?.prepare) return new Response('Database unavailable', { status: 503, headers: noStoreHeaders() });
  try {
    const rows = await env.WIN_DB.prepare('SELECT id, created_at, full_name, email, phone, suburb, property_role, service_type, work_details, marketing_opt_in, status, selected_at FROM win_entries ORDER BY created_at ASC').all();
    const cols = ['id','created_at','full_name','email','phone','suburb','property_role','service_type','work_details','marketing_opt_in','status','selected_at'];
    const csv = '\uFEFF' + [cols.map(cell).join(','), ...(rows.results || []).map((row: any) => cols.map(k => cell(row[k])).join(','))].join('\r\n');
    return new Response(csv, { headers: { ...noStoreHeaders(), 'Content-Type':'text/csv; charset=utf-8', 'Content-Disposition':'attachment; filename="andro-win-entries.csv"' } });
  } catch { return new Response('Database query failed', { status: 503, headers: noStoreHeaders() }); }
};