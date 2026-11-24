import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sheetsImportConfigured, mapSheetsWinLead, sheetsPayloadIsRecent } from '../src/lib/win-meta-sheets.ts';

const env = {
  WIN_ENTRIES_ENABLED: 'true',
  WIN_META_IMPORT_ENABLED: 'true',
  WIN_META_SHEETS_SYNC_ENABLED: 'true',
  WIN_META_FORM_ID: '113674087592221',
  WIN_META_SHEETS_SYNC_SECRET: 'a-strong-test-secret-which-will-never-be-used-in-production',
  WIN_OPEN_AT: '2026-11-24T17:50:00+13:00',
  WIN_CLOSE_AT: '2026-12-25T00:00:00+13:00',
  WIN_DRAW_AT: '2026-12-25T12:00:00+13:00',
  WIN_BUSINESS_POSTAL_ADDRESS: 'Testing address, Auckland, New Zealand',
  WIN_TURNSTILE_SITE_KEY: 'fake',
  WIN_TURNSTILE_SECRET_KEY: 'fake',
  REPORT_PASSWORD: 'fake-long-report-password',
  REPORT_SESSION_SECRET: 'X'.repeat(64),
  WIN_DB: { prepare(){}, batch(){} },
};
const lead = (changes={}) => ({
  source:'meta_google_sheets',
  sent_at: '2026-11-24T06:55:00.000Z',
  lead: {
    id: 'l:2693556051077',
    form_id: 'f:113674087592221',
    created_time: '2026-11-24T01:53:43-05:00',
    full_name: 'Example Auckland Resident',
    email: 'resident@example.nz',
    phone_number: '021 123 4567',
    terms_accepted: true,
    marketing_consent: false,
    ...changes
  }
});

test('Google Sheets import is disabled in the real Worker by two independent switches', () => {
  const config = JSON.parse(readFileSync(new URL('../wrangler.json', import.meta.url), 'utf8'));
  assert.equal(config.vars.WIN_META_IMPORT_ENABLED, 'false');
  assert.equal(config.vars.WIN_META_SHEETS_SYNC_ENABLED, 'false');
  assert.ok(!('WIN_META_SHEETS_SYNC_SECRET' in config.vars));
  assert.equal(sheetsImportConfigured(env), true);
  assert.equal(sheetsImportConfigured({...env,WIN_META_IMPORT_ENABLED:'false'}), false);
  assert.equal(sheetsImportConfigured({...env,WIN_META_SHEETS_SYNC_ENABLED:'false'}), false);
  assert.equal(sheetsImportConfigured({...env,WIN_META_SHEETS_SYNC_SECRET:''}), false);
  assert.equal(sheetsImportConfigured({...env,WIN_META_FORM_ID:''}), false);
});

test('Normalize prefixed Meta IDs and the original submission timestamp', () => {
  const x=mapSheetsWinLead(lead(),env);
  assert.equal(x.error, undefined);
  assert.equal(x.leadId, '2693556051077');
  assert.equal(x.formId, env.WIN_META_FORM_ID);
  assert.equal(x.timestamp, '2026-11-24T06:53:43.000Z');
  assert.equal(x.entry.email, 'resident@example.nz');
  assert.equal(x.entry.full_name, 'Example Auckland Resident');
  assert.equal(x.entry.phone, '021 123 4567');
  assert.equal(x.entry.marketing_opt_in, 0);
  assert.deepEqual([x.entry.suburb,x.entry.property_role,x.entry.service_type,x.entry.work_details],['','','','']);
});

test('No unverified Meta terms acknowledgement, no entry', () => {
  for (const v of [false,undefined,'yes',null,0]) {
    assert.equal(mapSheetsWinLead(lead({terms_accepted:v}),env).error,'terms_acknowledgement_not_captured');
  }
  assert.equal(mapSheetsWinLead(lead({email:'test@meta.com'}),env).error,'meta_sample_lead');
  assert.equal(mapSheetsWinLead(lead({full_name:'<test lead: dummy>'}),env).error,'meta_sample_lead');
  assert.equal(mapSheetsWinLead(lead({form_id:'f:99999999999'}),env).error,'invalid_lead_metadata');
  assert.equal(mapSheetsWinLead(lead({email:'not-an-email'}),env).error,'invalid_contact_details');
});

test('Preserves separate marketing permission but never infers it from giveaway terms', () => {
  assert.equal(mapSheetsWinLead(lead({marketing_consent:false}),env).entry.marketing_opt_in,0);
  assert.equal(mapSheetsWinLead(lead({marketing_consent:true}),env).entry.marketing_opt_in,1);
  assert.equal(mapSheetsWinLead(lead({marketing_consent:'yes'}),env).entry.marketing_opt_in,0);
  assert.equal(mapSheetsWinLead(lead({marketing_consent:undefined}),env).entry.marketing_opt_in,0);
});

test('No late or pre-opening competition entries; do allow delayed delivery within original entry period', () => {
  assert.equal(mapSheetsWinLead(lead({created_time:'2026-11-24T04:49:59Z'}),env).error,'outside_promotion_period');
  assert.equal(mapSheetsWinLead(lead({created_time:'2026-12-24T11:00:00Z'}),env).error,'outside_promotion_period');
  assert.equal(mapSheetsWinLead(lead({created_time:'24 November 2026'}),env).error,'invalid_lead_metadata');
  assert.ok(!mapSheetsWinLead(lead(),env,'2026-12-26T00:00:00Z').error);
});

test('Anti-replay timestamp only accepts recent signed ANDRO requests', () => {
  const x=lead();
  const at=Date.parse(x.sent_at);
  assert.equal(sheetsPayloadIsRecent(x,at),true);
  assert.equal(sheetsPayloadIsRecent(x,at+6*60*1000),false);
  assert.equal(sheetsPayloadIsRecent({...x,source:'other'},at),false);
});

test('The Sheets sync can never import directly without configured HMAC and an audit database', () => {
  const endpoint = readFileSync(new URL('../src/pages/api/win/meta/sheets.ts', import.meta.url), 'utf8');
  assert.ok(endpoint.includes('sheetsImportConfigured(env)'));
  assert.ok(endpoint.includes('winAuditReady(env)'));
  assert.ok(endpoint.includes('verifyMetaSignature(body,'));
  assert.ok(endpoint.includes('sheetsPayloadIsRecent(payload as MetaSheetsPayload)'));
  assert.ok(endpoint.includes('mapSheetsWinLead(payload as MetaSheetsPayload, env)'));
  assert.ok(endpoint.includes("status='winner'"));
  assert.ok(endpoint.includes('storeMetaLead(lead, env.WIN_DB)'));
  assert.ok(!endpoint.includes('console.log('));
  const script=readFileSync(new URL('../scripts/ANDRO_Facebook_Lead_Sync.gs',import.meta.url),'utf8');
  assert.ok(script.includes("props.getProperty('ANDRO_SYNC_ENABLED') !== 'true'"));
  assert.ok(script.includes("props.getProperty('ANDRO_TERMS_COLUMN')"));
  assert.ok(script.includes("if (!androAffirmative_(get(termsName)))"));
  assert.ok(script.includes("if (/^test@meta\\.com$/i.test(email)"));
  assert.ok(script.includes("Utilities.computeHmacSha256Signature("));
  assert.ok(script.includes("ScriptApp.newTrigger('androSyncLeads').timeBased().everyMinutes(5).create()"));
  assert.ok(!script.includes('function onEdit('));
});


test('Apps Script strips the Meta p: prefix and checks the signed endpoint without writing an entry', async () => {
  const { runInNewContext } = await import('node:vm');
  const script = readFileSync(new URL('../scripts/ANDRO_Facebook_Lead_Sync.gs', import.meta.url), 'utf8');
  const grid = [
    ['id','form_id','created_time','phone_number','email','full_name','terms'],
    ['l:1234567890123456','f:113674087592221','2026-11-24T02:53:56-05:00','p:+64211234567','owner@example.test','Owner test','yes']
  ];
  const props = {
    ANDRO_SYNC_ENABLED: 'false',
    ANDRO_SYNC_SECRET: 'X'.repeat(64),
    ANDRO_TEST_LEAD_ID: grid[1][0],
    ANDRO_TERMS_COLUMN: 'terms'
  };
  let sent, logged = [];
  const ctx = {
    PropertiesService: {getScriptProperties: () => ({getProperty: key => props[key]})},
    SpreadsheetApp: {getActiveSpreadsheet: () => ({getSheetByName: () => ({getDataRange: () => ({getDisplayValues: () => grid})})})},
    Utilities: {Charset: {UTF_8: 'UTF-8'}, computeHmacSha256Signature: () => Array(32).fill(0)},
    UrlFetchApp: {fetch: (url, opts) => {
      sent = JSON.parse(opts.payload);
      assert.match(opts.headers['X-ANDRO-Sheets-Signature'], /^sha256=[0-9a-f]{64}$/);
      return {getResponseCode: () => 422, getContentText: () => JSON.stringify({error:'terms_acknowledgement_not_captured'})};
    }},
    Logger: {log: (...args) => logged.push(args.join(' '))}
  };
  runInNewContext(script, ctx);
  assert.equal(ctx.androPhone_('p:+64211234567'), '+64211234567');
  assert.equal(ctx.androPhone_('021 123 4567'), '021 123 4567');
  ctx.androCheckConnection();
  assert.equal(sent.lead.terms_accepted, false);
  assert.equal(sent.lead.id, '1234567890123456');
  assert.equal(sent.lead.form_id, '113674087592221');
  for (const key of ['email','full_name','phone_number']) assert.ok(!(key in sent.lead));
  assert.ok(logged.some(line => line.includes('SIGNED CONNECTION PASSED')));
  props.ANDRO_SYNC_ENABLED = 'true';
  assert.throws(() => ctx.androCheckConnection(), /explicitly false/);
  assert.ok(script.includes("leadId === testLeadId"));
  assert.ok(script.includes("phone_number: androPhone_(get('phone_number'))"));
});
