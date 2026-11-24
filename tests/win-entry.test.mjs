import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { winState, winAuditReady, validateWinEntry, sameOriginPost, randomOffset } from '../src/lib/win.ts';

const env = {
  WIN_ENTRIES_ENABLED: 'true',
  WIN_BUSINESS_POSTAL_ADDRESS: 'Unit 3, 123 Example Road, Auckland, New Zealand',
  WIN_OPEN_AT: '2026-11-24T20:00:00+13:00',
  WIN_CLOSE_AT: '2026-12-25T00:00:00+13:00',
  WIN_DRAW_AT: '2026-12-25T12:00:00+13:00',
  WIN_TURNSTILE_SITE_KEY: 'example-test-site-key',
  WIN_TURNSTILE_SECRET_KEY: 'example-test-secret-key',
  WIN_DB: { prepare() {} },
  REPORT_PASSWORD: 'long-example-admin-password',
  REPORT_SESSION_SECRET: 'example-session-secret-with-32-characters-minimum',
};
function entry(overrides={}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    full_name: 'Jane Test',
    email: 'Jane@example.nz',
    phone: '021 123 4567',
    suburb: 'Takapuna',
    property_role: 'Owner',
    service_type: 'Handyman work',
    work_details: 'Please help repair our fence gate and paint the porch.',
    age: 'yes',
    authority: 'yes',
    terms: 'yes',
    ...overrides
  })) form.set(key, value);
  return form;
}

test('competition remains closed when unconfigured', () => {
  assert.equal(winState({}, Date.now()).phase, 'setup');
  assert.equal(winState({ ...env, WIN_ENTRIES_ENABLED: 'false' }).phase, 'setup');
  assert.equal(winState({ ...env, WIN_ENTRIES_ENABLED: undefined }).phase, 'setup');
  assert.equal(winState({ ...env, WIN_BUSINESS_POSTAL_ADDRESS: 'pending' }).phase, 'setup');
  assert.equal(winState({ ...env, WIN_BUSINESS_POSTAL_ADDRESS: '' }).phase, 'setup');
  assert.equal(winState({ ...env, WIN_TURNSTILE_SECRET_KEY: '' }).phase, 'setup');
  assert.equal(winState({ ...env, WIN_DB: undefined }).phase, 'setup');
  assert.equal(winState({ ...env, WIN_OPEN_AT:'2026-11-20T09:00:00' }).phase, 'setup');
  assert.equal(winState({ ...env, WIN_OPEN_AT: env.WIN_CLOSE_AT }).phase, 'setup');
});
test('competition respects New Zealand offset and UTC date bounds', () => {
  assert.equal(winState(env, Date.parse('2026-11-19T19:59:00Z')).phase, 'upcoming');
  assert.equal(winState(env, Date.parse(env.WIN_OPEN_AT)).phase, 'open');
  assert.equal(winState(env, Date.parse(env.WIN_CLOSE_AT)).phase, 'closed');
});
test('free-entry giveaway requires a precise published opening and fails closed for launch or pending', () => {
  assert.equal(winState({ ...env, WIN_OPEN_AT: 'pending' }).phase, 'setup');
  assert.equal(winState({ ...env, WIN_OPEN_AT: 'launch' }).phase, 'setup');
  assert.equal(winState({ ...env, WIN_OPEN_AT: '2026-11-27T09:00:00+13:00' },
    Date.parse('2026-11-27T08:59:59+13:00')).phase, 'upcoming');
  assert.equal(winState({ ...env, WIN_OPEN_AT: '2026-11-27T09:00:00+13:00' },
    Date.parse('2026-11-27T09:00:00+13:00')).phase, 'open');
  assert.equal(winState(env, Date.parse('2026-12-24T23:59:58+13:00')).phase, 'open');
  assert.equal(winState(env, Date.parse('2026-12-24T23:59:59+13:00')).phase, 'open');
  assert.equal(winState(env, Date.parse('2026-12-25T12:00:00+13:00')).phase, 'closed');
});

test('Christmas dates are advertised even before launch and the draw stays manual', () => {
  const publicPage = readFileSync(new URL('../src/pages/win.astro', import.meta.url), 'utf8');
  const adminPage = readFileSync(new URL('../src/pages/win/admin/index.astro', import.meta.url), 'utf8');
  assert.ok(publicPage.includes('Entries close on Christmas Eve:'));
  assert.ok(publicPage.includes('midnight at the end of Christmas Eve'));
  assert.ok(publicPage.includes('closeLabel'));
  assert.ok(publicPage.includes('promoterAddress'));
  assert.ok(publicPage.includes('correspondence address'));
  assert.ok(publicPage.includes('Christmas Day winner draw:'));
  assert.ok(publicPage.includes('campaign.openAt ?? configuredDate(env.WIN_OPEN_AT)'));
  assert.ok(publicPage.includes('campaign.closeAt ?? configuredDate(env.WIN_CLOSE_AT)'));
  assert.ok(publicPage.includes('campaign.drawAt ?? configuredDate(env.WIN_DRAW_AT)'));
  assert.ok(adminPage.includes('Christmas Day winner draw:'));
  assert.ok(adminPage.includes('This is a manual draw'));
  assert.ok(adminPage.includes("const canReview = campaign.phase === 'closed'"));
  assert.ok(adminPage.includes('Draw winner'));
});

test('legal terms and random selection are independently reviewable before launch', () => {
  const legal = JSON.parse(readFileSync(new URL('../content/pages/win.json', import.meta.url), 'utf8'));
  const entryHandler = readFileSync(new URL('../src/pages/api/win/entry.ts', import.meta.url), 'utf8');
  const draw = readFileSync(new URL('../src/pages/api/win/admin/draw.ts', import.meta.url), 'utf8');
  const exclude = readFileSync(new URL('../src/pages/api/win/admin/exclude.ts', import.meta.url), 'utf8');
  const schema = readFileSync(new URL('../migrations/0002_win_draw_audit.sql', import.meta.url), 'utf8');
  const dashboard = readFileSync(new URL('../src/pages/win/admin/index.astro', import.meta.url), 'utf8');

  assert.match(legal.eligibility, /mainland Auckland Council region/);
  assert.match(legal.prizeTerms, /up to eight hours of on-site labour/);
  assert.match(legal.prizeTerms, /Materials and consumables/);
  assert.match(legal.howToEnter, /NOT required/);
  assert.match(legal.socialMedia, /release Facebook and Instagram/);
  assert.match(legal.privacy, /30 June 2027/);
  assert.match(legal.privacy, /business correspondence address before entries open/);
  assert.match(entryHandler, /Re-check immediately before writing/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS win_entry_exclusions/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS win_draw_events/);
  assert.match(draw, /win_entry_exclusions/);
  assert.match(draw, /win_draw_events/);
  assert.match(draw, /db\.batch\(/);
  assert.match(exclude, /allowedReasons/);
  assert.match(exclude, /db\.batch\(/);
  assert.match(dashboard, /migration 0002/);
  assert.match(dashboard, /PROVISIONALLY SELECTED ENTRANT/);
});

test('the scheduled opening is 8 pm Auckland time and the end-of-Christmas-Eve cutoff is exclusive', () => {
  assert.equal(winState(env, Date.parse('2026-11-24T19:59:59+13:00')).phase, 'upcoming');
  assert.equal(winState(env, Date.parse('2026-11-24T20:00:00+13:00')).phase, 'open');
  assert.equal(winState(env, Date.parse('2026-12-24T23:59:59+13:00')).phase, 'open');
  assert.equal(winState(env, Date.parse('2026-12-25T00:00:00+13:00')).phase, 'closed');
});

test('draw-audit schema readiness prevents collecting entries into an unprepared database', async () => {
  const queried: string[] = [];
  const prepared = { WIN_DB: { prepare(statement: string) {
    queried.push(statement);
    return { all: async () => ({results: []}) };
  } } };
  assert.equal(await winAuditReady(prepared), true);
  assert.equal(queried.length, 3);
  assert.ok(queried.some(sql => sql.includes('win_entries')));
  assert.ok(queried.some(sql => sql.includes('win_draw_events')));
  assert.ok(queried.some(sql => sql.includes('win_entry_exclusions')));
  assert.equal(await winAuditReady({ WIN_DB: { prepare() { throw Error('no such table'); } } }), false);
  assert.equal(await winAuditReady({ WIN_DB: undefined }), false);
  const page = readFileSync(new URL('../src/pages/win.astro', import.meta.url), 'utf8');
  const endpoint = readFileSync(new URL('../src/pages/api/win/entry.ts', import.meta.url), 'utf8');
  assert.ok(page.includes('await winAuditReady(env)'), 'the public form must stay hidden until migration 0002 is installed');
  assert.ok(endpoint.includes('await winAuditReady(env)'), 'the server must refuse writes without migration 0002');
});

test('admin can prepare D1 audit tables without user-controlled SQL or deleting entries', () => {
  const setup = readFileSync(new URL('../src/pages/api/win/admin/setup.ts', import.meta.url), 'utf8');
  const dashboard = readFileSync(new URL('../src/pages/win/admin/index.astro', import.meta.url), 'utf8');
  assert.match(setup, /sameOriginPost\(request\)/);
  assert.match(setup, /db\.batch\(\[/);
  assert.match(setup, /CREATE TABLE IF NOT EXISTS win_entry_exclusions/);
  assert.match(setup, /CREATE TABLE IF NOT EXISTS win_draw_events/);
  assert.match(setup, /await winAuditReady\(env\)/);
  assert.ok(!/\b(?:DROP|DELETE|TRUNCATE)\s+(?:TABLE|FROM)\b/i.test(setup), 'Setup must not remove existing records');
  assert.ok(dashboard.includes('action="/api/win/admin/setup"'));
  assert.ok(dashboard.includes('Prepare draw database'));
  assert.ok(dashboard.includes("!auditReady && typeof env.WIN_DB?.prepare === 'function'"));
});

test('valid input normalizes email and does not assume marketing permission', () => {
  const result = validateWinEntry(entry());
  assert.equal(result.error, undefined);
  assert.equal(result.entry.email, 'jane@example.nz');
  assert.equal(result.entry.marketing_opt_in, 0);
  assert.equal(validateWinEntry(entry({ marketing:'yes' })).entry.marketing_opt_in, 1);
});
test('rejects missing consent, invalid data, and unapproved property role', () => {
  for (const fields of [
    { terms: 'no' }, { age: '' }, { authority: 'no' },
    { phone:'not a phone' }, { email:'bad@' },
    { work_details: 'short' }, { property_role: 'Tenant' }
  ]) assert.ok(validateWinEntry(entry(fields)).error, JSON.stringify(fields));
});
test('cross-origin writes fail origin guard', () => {
  assert.equal(sameOriginPost(new Request('https://andro.co.nz/api/win/entry', {
    method:'POST',headers:{Origin:'https://andro.co.nz'}
  })), true);
  assert.equal(sameOriginPost(new Request('https://andro.co.nz/api/win/entry', {
    method:'POST',headers:{Origin:'https://other.example'}
  })), false);
});
test('winner draw samples within valid bounds', () => {
  for (const count of [1,2,3,10,65537]) {
    const values = new Set();
    for (let i=0;i<100;i++) {
      const value = randomOffset(count);
      assert.ok(value >= 0 && value < count);
      values.add(value);
    }
    if (count===1) assert.deepEqual([...values],[0]);
    else assert.ok(values.size > 1);
  }
  assert.throws(() => randomOffset(0));
});

test('Cloudflare config contains the intended ANDRO D1 binding', () => {
  const config = JSON.parse(readFileSync(new URL('../wrangler.json', import.meta.url), 'utf8'));
  const win = config.d1_databases?.find(item => item.binding === 'WIN_DB');
  assert.ok(win, 'WIN_DB must be bound before deployment');
  assert.equal(win.database_name, 'andro-win');
  assert.match(win.database_id, /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);
  assert.equal(config.vars?.WIN_TURNSTILE_SITE_KEY, '0x4AAAAAAGBnK_eVlihsb2dT');
  assert.equal(config.vars?.WIN_ENTRIES_ENABLED, 'true', 'approved opening still gated by the clock and D1 audit tables');
  assert.equal(config.vars?.WIN_OPEN_AT, '2026-11-24T20:00:00+13:00');
  assert.equal(config.vars?.WIN_BUSINESS_POSTAL_ADDRESS, '23 Hampton Drive, St Heliers, Auckland, New Zealand');
  assert.equal(config.vars?.WIN_CLOSE_AT, '2026-12-25T00:00:00+13:00');
  assert.equal(config.vars?.WIN_DRAW_AT, '2026-12-25T12:00:00+13:00');
  assert.ok(!Object.keys(config.vars ?? {}).some(key => /turnstile_secret|report_password/i.test(key)), 'private secrets must not be committed to wrangler vars');
  assert.ok(!Object.keys(config).some(key => /turnstile_secret|report_password/i.test(key)), 'secrets must not be committed to wrangler.json');
});
