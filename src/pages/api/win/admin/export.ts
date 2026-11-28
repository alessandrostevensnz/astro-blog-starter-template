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
    // Preserve the original export even if the optional Meta ledger is absent.
    let forms = new Map<string,string>();
    try {
      const meta = await env.WIN_DB.prepare("SELECT entry_id,form_id FROM win_meta_leads WHERE status='accepted'").all();
      forms = new Map((meta.results||[]).map((r:any)=>[String(r.entry_id),String(r.form_id)]));
    } catch {}
    const enriched = (rows.results||[]).map((r:any)=>{
      const form = forms.get(r.id)||'';
      const v3 = Boolean(form&&form===String(env.WIN_META_SHEETS_V3_FORM_ID||''));
      return {...r,work_details:v3?'':r.work_details,source:form?'Facebook Instant Form':'ANDRO website',form_id:form,construction_work:v3?r.service_type:'',future_project_12_months:v3?r.work_details:''};
    });
    const cols = ['id','created_at','full_name','email','phone','suburb','property_role','service_type','work_details','marketing_opt_in','status','selected_at','source','form_id','construction_work','future_project_12_months'];
    const csv = '\uFEFF' + [cols.map(cell).join(','), ...enriched.map((row: any) => cols.map(k => cell(row[k])).join(','))].join('\r\n');
    return new Response(csv, { headers: { ...noStoreHeaders(), 'Content-Type':'text/csv; charset=utf-8', 'Content-Disposition':'attachment; filename="andro-win-entries.csv"' } });
  } catch { return new Response('Database query failed', { status: 503, headers: noStoreHeaders() }); }
};