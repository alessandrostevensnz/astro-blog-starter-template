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
  assert.ok(admin.includes('win-photos-preview-v2'), 'Admin config cache revision was not bumped');
});

test('every editable term exists in data and is rendered as escaped text', () => {
  assert.match(page, /import winCopy from/);
  for(const field of giveaway.fields.filter(item => item.name !== 'photos')) {
    assert.equal(typeof contents[field.name], 'string', 'Missing or non-string field: ' + field.name);
    assert.ok(contents[field.name].trim().length > 0, 'Empty published field: ' + field.name);
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

test('remaining giveaway photos are editable and the removed middle image stays absent', () => {
  const photoField = giveaway.fields.find(f => f.name === 'photos');
  assert.ok(photoField, 'Photo section must be visible in Decap');
  assert.equal(giveaway.fields[0].name, 'photos', 'Photo controls must be at the top of the editor');
  assert.deepEqual(photoField.fields.map(f => f.name), ['hero', 'closing']);
  assert.equal(contents.photos.work, undefined, 'Removed photo must not remain in the CMS data');
  assert.ok(!page.includes('win-work-photo'), 'Removed photo markup and CSS must not remain');
  assert.ok(!page.includes('winCopy.photos.work'), 'Removed photo must not be rendered');
  for (const imageField of photoField.fields) {
    const key = imageField.name;
    assert.equal(imageField.widget, 'object');
    assert.ok(imageField.fields.some(f => f.name === 'src' && f.widget === 'image'), key + ' must have an image upload control');
    assert.ok(imageField.fields.some(f => f.name === 'alt'), key + ' must have editable description');
    assert.equal(typeof contents.photos[key].src, 'string');
    assert.ok(contents.photos[key].src.startsWith('/images/'), key + ' must start with an actual site image');
    assert.ok(contents.photos[key].alt);
    assert.ok(page.includes('src={winCopy.photos.' + key + '.src}'), key + ' must render the CMS image');
    assert.ok(page.includes('alt={winCopy.photos.' + key + '.alt}'), key + ' must render accessible alt text');
    assert.ok(page.includes('data-cms-image="win.photos.' + key + '"'), key + ' must be identifiable in preview');
  }
});

test('giveaway live preview displays the real /win layout and updates editable copy', () => {
  const preview = readFileSync(new URL('../public/admin/preview.js', import.meta.url), 'utf8');
  const layout = readFileSync(new URL('../src/components/SiteLayout.astro', import.meta.url), 'utf8');
  assert.ok(preview.includes("win: { path: '/win/', label: 'Win a Day' }"), 'Giveaway route must open the site iframe');
  assert.ok(preview.includes("page === 'win' ? winTextKeys : textKeys"), 'Giveaway fields must be read from actual editor');
  assert.ok(admin.includes('/admin/preview.js?v=win-photos-preview-v2'), 'Admin must bypass stale preview script');
  assert.ok(admin.includes('/admin/config.yml?v=win-photos-preview-v2'), 'Admin must bypass cached field schema');
  assert.ok(layout.includes("event.data.type !== 'andro-cms-preview'"), 'Iframe must listen for editable text changes');
  for(const field of giveaway.fields.filter(f => f.name !== 'photos')) {
    assert.ok(preview.includes("'" + field.name + "'"), 'Preview mapping missing: ' + field.name);
    assert.ok(page.includes('data-style-key="win.' + field.name + '"'), 'Website text target missing: ' + field.name);
  }
});
