import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cmsConfig } from '../src/lib/cms-config.ts';

const contents = JSON.parse(readFileSync(new URL('../content/pages/win.json', import.meta.url), 'utf8'));
const page = readFileSync(new URL('../src/pages/win.astro', import.meta.url), 'utf8');
const admin = readFileSync(new URL('../public/admin/index.html', import.meta.url), 'utf8');
const pages = cmsConfig.collections.find(x => x.name === 'pages');
const giveaway = pages?.files.find(x => x.name === 'win');

test('ANDRO editor has a dedicated win entry linked to the correct content file', () => {
  assert.ok(giveaway, 'Missing giveaway page in Decap CMS');
  assert.equal(giveaway.file, 'content/pages/win.json');
  assert.equal(giveaway.preview_path, '/win/');
  assert.ok(admin.includes('andro-win-editor-v1'), 'Admin config cache revision was not bumped');
});

test('every editable term exists in data and is rendered as escaped text', () => {
  assert.match(page, /import winCopy from/);
  for(const field of giveaway.fields) {
    assert.equal(typeof contents[field.name], 'string', 'Missing or non-string field: ' + field.name);
    assert.ok(contents[field.name].length > 10, 'Empty published field: ' + field.name);
    assert.ok(page.includes('{winCopy.' + field.name + '}'), 'Unrendered editable field: ' + field.name);
  }
  assert.ok(page.includes('data-cms-text'), 'Paragraph breaks are not handled');
  assert.ok(!page.includes('set:html={winCopy.'), 'User-managed terms must not render HTML');
});

test('giveaway switch stays disabled while terms are under review', () => {
  const config = JSON.parse(readFileSync(new URL('../wrangler.json', import.meta.url), 'utf8'));
  assert.equal(config.vars.WIN_ENTRIES_ENABLED, 'false');
  assert.match(page, /Launch review required/);
});
