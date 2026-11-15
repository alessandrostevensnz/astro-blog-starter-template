import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { winState, validateWinEntry, sameOriginPost, randomOffset } from '../src/lib/win.ts';

const env = {
  WIN_ENTRIES_ENABLED: 'true',
  WIN_OPEN_AT: '2026-11-20T09:00:00+13:00',
  WIN_CLOSE_AT: '2026-12-15T23:59:00+13:00',
  WIN_DRAW_AT: '2026-12-16T12:00:00+13:00',
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
test('launch-based opening uses deployment time rather than a fictitious scheduled opening', () => {
  const launch = { ...env, WIN_OPEN_AT: 'launch' };
  assert.equal(winState(launch, Date.parse('2026-11-15T19:00:00+13:00')).phase, 'open');
  assert.equal(winState(launch, Date.parse('2026-12-15T23:58:00+13:00')).phase, 'open');
  assert.equal(winState(launch, Date.parse('2026-12-15T23:59:00+13:00')).phase, 'closed');
  assert.equal(winState(launch, Date.parse('2026-12-16T12:00:00+13:00')).phase, 'closed');
  assert.equal(winState(launch).openAt, undefined);
  assert.equal(winState({ ...launch, WIN_OPEN_AT: 'auto' }).phase, 'setup');
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
  assert.equal(config.vars?.WIN_ENTRIES_ENABLED, 'false', 'giveaway must remain disabled before approval');
  assert.equal(config.vars?.WIN_OPEN_AT, 'launch');
  assert.equal(config.vars?.WIN_CLOSE_AT, '2026-12-15T23:59:00+13:00');
  assert.equal(config.vars?.WIN_DRAW_AT, '2026-12-16T12:00:00+13:00');
  assert.ok(!Object.keys(config.vars ?? {}).some(key => /turnstile_secret|report_password/i.test(key)), 'private secrets must not be committed to wrangler vars');
  assert.ok(!Object.keys(config).some(key => /turnstile_secret|report_password/i.test(key)), 'secrets must not be committed to wrangler.json');
});
