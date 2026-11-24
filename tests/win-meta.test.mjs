import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mapMetaWinLead, metaIntegrationConfigured, verifyMetaSignature, storeMetaLead } from '../src/lib/win-meta.ts';

const env = {
  WIN_ENTRIES_ENABLED: 'true',
  WIN_OPEN_AT: '2026-11-24T17:50:00+13:00',
  WIN_CLOSE_AT: '2026-12-25T00:00:00+13:00',
  WIN_DRAW_AT: '2026-12-25T12:00:00+13:00',
  WIN_BUSINESS_POSTAL_ADDRESS: 'Sample testing address, Auckland, New Zealand',
  WIN_TURNSTILE_SITE_KEY: 'fake-site-key',
  WIN_TURNSTILE_SECRET_KEY: 'fake-turnstile-secret',
  REPORT_PASSWORD: 'fake-password-abcdef',
  REPORT_SESSION_SECRET: 'x'.repeat(64),
  WIN_DB: { prepare() {}, batch() {} },
  WIN_META_IMPORT_ENABLED: 'true',
  WIN_META_PAGE_ID: '1234567890123',
  WIN_META_FORM_ID: '9876543210123',
  WIN_META_APP_SECRET: 'fake-meta-app-secret-abcdef',
  WIN_META_VERIFY_TOKEN: 'fake-long-meta-webhook-verification-token',
  WIN_META_PAGE_TOKEN: 'fake-meta-page-token-example-abcdef',
  WIN_META_TERMS_KEY: 'mandatory_1',
  WIN_META_MARKETING_KEY: 'optional_1',
};
const valid = (overrides = {}) => ({
  id: '555554444433333',
  form_id: env.WIN_META_FORM_ID,
  created_time: '2026-11-24T06:20:00+0000',
  field_data: [
    { name: 'full_name', values: ['Test Homeowner'] },
    { name: 'email', values: ['Homeowner@Example.nz'] },
    { name: 'phone_number', values: ['021 123 4567'] },
  ],
  custom_disclaimer_responses: [
    { checkbox_key: 'mandatory_1', is_checked: '1' },
    { checkbox_key: 'optional_1', is_checked: '' },
  ],
  ...overrides,
});

test('Meta lead import is disabled by default in real deployment', () => {
  const config = JSON.parse(readFileSync(new URL('../wrangler.json', import.meta.url), 'utf8'));
  assert.equal(config.vars.WIN_META_IMPORT_ENABLED, 'false');
  assert.ok(!('WIN_META_PAGE_TOKEN' in config.vars), 'Never commit Meta access token to GitHub');
  assert.ok(!('WIN_META_APP_SECRET' in config.vars), 'Never commit Meta app secret to GitHub');
  assert.ok(!('WIN_META_VERIFY_TOKEN' in config.vars), 'Never commit webhook verification secret to GitHub');
  assert.equal(metaIntegrationConfigured({ ...env, WIN_META_IMPORT_ENABLED: 'false' }), false);
  assert.equal(metaIntegrationConfigured({ ...env, WIN_META_FORM_ID: undefined }), false);
  assert.equal(metaIntegrationConfigured({ ...env, WIN_META_TERMS_KEY: 'pending' }), false);
  assert.equal(metaIntegrationConfigured({ ...env, WIN_META_PAGE_TOKEN: undefined }), false);
  assert.equal(metaIntegrationConfigured(env), true);
});

test('a consented, in-period Meta lead maps to same ANDRO entry schema', () => {
  const lead = mapMetaWinLead(valid(), env);
  assert.equal(lead.error, undefined);
  assert.equal(lead.leadId, '555554444433333');
  assert.equal(lead.formId, env.WIN_META_FORM_ID);
  assert.equal(lead.entry.email, 'homeowner@example.nz');
  assert.equal(lead.entry.phone, '021 123 4567');
  // Extra property details are NOT fabricated when the form collects only
  // name, phone, and email; verify the winner before awarding the prize.
  assert.equal(lead.entry.suburb, '');
  assert.equal(lead.entry.property_role, '');
  assert.equal(lead.entry.service_type, '');
  assert.equal(lead.entry.work_details, '');
  assert.equal(lead.entry.marketing_opt_in, 0);
});

test('marketing permission is NEVER inferred from entry acceptance', () => {
  const lead = mapMetaWinLead(valid({ custom_disclaimer_responses: [
    { checkbox_key: 'mandatory_1', is_checked: '1' },
    { checkbox_key: 'optional_1', is_checked: '1' },
  ] }), env);
  assert.equal(lead.entry.marketing_opt_in, 1);
  assert.equal(mapMetaWinLead(valid(), { ...env, WIN_META_MARKETING_KEY: undefined }).entry.marketing_opt_in, 0);
  assert.equal(mapMetaWinLead(valid(), { ...env, WIN_META_MARKETING_KEY: 'mandatory_1' }).entry.marketing_opt_in, 0);
});

test('the only requested contact questions are name, email, phone plus required terms agreement', () => {
  const fields = valid().field_data.map(x => x.name);
  assert.deepEqual(fields, ['full_name', 'email', 'phone_number']);
  assert.equal(mapMetaWinLead(valid(), env).error, undefined);
  const cases = [
    valid({ custom_disclaimer_responses: [] }),
    valid({ custom_disclaimer_responses: [{ checkbox_key: 'mandatory_1', is_checked: '' }] }),
    valid({ field_data: valid().field_data.filter(x => x.name !== 'full_name') }),
    valid({ field_data: valid().field_data.filter(x => x.name !== 'email') }),
    valid({ field_data: valid().field_data.filter(x => x.name !== 'phone_number') }),
    valid({ field_data: valid().field_data.map(x => x.name === 'email' ? {...x, values: ['bad@']} : x) }),
    valid({ field_data: valid().field_data.map(x => x.name === 'phone_number' ? {...x, values: ['invalid phone']} : x) }),
  ];
  for (const lead of cases) assert.equal(mapMetaWinLead(lead, env).entry, undefined);
  assert.equal(mapMetaWinLead(valid({custom_disclaimer_responses:[]}), env).error, 'missing_terms_and_eligibility_agreement');
});

test('Meta importer leaves uncollected property fields blank and never invents age verification', () => {
  const mapped = mapMetaWinLead(valid(), env);
  assert.equal(mapped.entry.suburb, '');
  assert.equal(mapped.entry.property_role, '');
  assert.equal(mapped.entry.service_type, '');
  assert.equal(mapped.entry.work_details, '');
  const source = readFileSync(new URL('../src/lib/win-meta.ts', import.meta.url), 'utf8');
  assert.ok(!source.includes("read('are_you_18_or_older')"), 'Do not ask a separate age question');
  assert.ok(source.includes('NOT independent proof of age'));
  const admin = readFileSync(new URL('../src/pages/win/admin/index.astro', import.meta.url), 'utf8');
  assert.ok(admin.includes('Auckland eligibility to verify'));
  assert.ok(admin.includes('Property authority to verify'));
});

test('reject a different form ID and a lead submitted outside the published entry period', () => {
  assert.equal(mapMetaWinLead(valid({ form_id: '7777777777777' }), env).error, 'invalid_lead_metadata');
  assert.equal(mapMetaWinLead(valid({ created_time: '2026-11-24T04:49:59+0000' }), env).error, 'outside_published_entry_period');
  assert.equal(mapMetaWinLead(valid({ created_time: '2026-12-24T11:00:00+0000' }), env).error, 'outside_published_entry_period');
  assert.equal(mapMetaWinLead(valid({ created_time: 'bad-date' }), env).error, 'invalid_lead_metadata');
});

test('reject unsigned, malformed or forged webhook signatures', async () => {
  const bytes = new TextEncoder().encode(JSON.stringify({object:'page',entry:[]}));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.WIN_META_APP_SECRET), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  const sig = Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
  assert.equal(await verifyMetaSignature(bytes.buffer, 'sha256='+sig, env.WIN_META_APP_SECRET), true);
  assert.equal(await verifyMetaSignature(bytes.buffer, 'sha256='+sig, 'different-meta-app-secret'), false);
  assert.equal(await verifyMetaSignature(bytes.buffer, null, env.WIN_META_APP_SECRET), false);
  assert.equal(await verifyMetaSignature(bytes.buffer, 'not-a-signature', env.WIN_META_APP_SECRET), false);
});

test('Meta webhook checks signatures, Page and Form, D1 and does not open until approved', () => {
  const webhook = readFileSync(new URL('../src/pages/api/win/meta/webhook.ts', import.meta.url), 'utf8');
  assert.ok(webhook.includes('metaIntegrationConfigured(env)'));
  assert.ok(webhook.includes('winAuditReady(env)'));
  assert.ok(webhook.includes('verifyMetaSignature(body,'));
  assert.ok(webhook.includes("item?.field !== 'leadgen'"));
  assert.ok(webhook.includes('env.WIN_META_PAGE_ID'));
  assert.ok(webhook.includes('env.WIN_META_FORM_ID'));
  assert.ok(webhook.includes('storeMetaLead(mapped, db)'));
  assert.ok(webhook.includes('status=\'winner\''));
  assert.ok(!webhook.includes('console.log('));
  const metaSchema = readFileSync(new URL('../migrations/0003_win_meta_leads.sql', import.meta.url), 'utf8');
  assert.ok(metaSchema.includes('CREATE TABLE IF NOT EXISTS win_meta_leads'));
  assert.ok(metaSchema.includes('lead_id TEXT PRIMARY KEY NOT NULL'));
  assert.ok(metaSchema.includes("status IN ('accepted','duplicate','rejected')"));
  assert.ok(!/\bDROP\s+TABLE\b/i.test(metaSchema));
});

test('D1 import is idempotent and dedupes existing website entrants by email', async () => {
  const queries = [];
  const db = {
    prepare(sql) { const q={sql, bind(...values){this.values=values;return this;}, async first(){return null;}, async run(){return {success:true,meta:{changes:1}};}};queries.push(q);return q; },
    async batch(statements){ assert.equal(statements.length,2);return [{success:true,meta:{changes:1}},{success:true,meta:{changes:1}}]; },
  };
  const mapped=mapMetaWinLead(valid(),env);
  assert.equal(await storeMetaLead(mapped,db), 'accepted');
  assert.ok(queries.some(q=>q.sql.includes('INSERT OR IGNORE INTO win_entries')));
  assert.ok(queries.some(q=>q.sql.includes('INSERT OR IGNORE INTO win_meta_leads')));
  const invalid = mapMetaWinLead(valid({custom_disclaimer_responses:[]}),env);
  assert.equal(await storeMetaLead({...invalid,leadId:'7777777777777'},db), 'rejected');
  assert.ok(queries.some(q=>q.sql.includes("'rejected'")));
});
