import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { cmsConfig } from '../src/lib/cms-config.ts';
import { typographyCss } from '../src/lib/typography.ts';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const content = JSON.parse(read('../content/pages/contact.json'));
const page = read('../src/pages/contact.astro');
const metaKeys = ['metaTitle','metaDescription'];
const textKeys = [
  'heroEyebrow','heroHeading','heroDescription','sectionEyebrow',
  'sectionHeading','sectionDescription','emailPrefix','nameLabel',
  'emailLabel','serviceLabel','servicePlaceholder','messageLabel',
  'submitLabel','formNotice','sendingButton','sendingStatus',
  'successStatus','providerErrorFallback','errorSuffix','genericError'
];
const styled = [
  'heroEyebrow','heroHeading','heroDescription','sectionEyebrow',
  'sectionHeading','sectionDescription','emailPrefix','nameLabel',
  'emailLabel','serviceLabel','messageLabel','submitLabel','formNotice'
];

test('Contact is editable from page-first Decap, with every field above footer', () => {
  const pages = cmsConfig.collections.find(c => c.name === 'pages');
  assert(pages);
  const contact = pages.files.find(f => f.name === 'contact');
  assert.equal(contact.file, 'content/pages/contact.json');
  const names = contact.fields.map(field => field.name);
  for (const key of [...textKeys, ...metaKeys, 'serviceOptions', 'contactEmail']) {
    assert(names.includes(key), 'Missing field in contact admin: ' + key);
    assert(names.indexOf(key) < names.indexOf('footerImages'), 'Contact text should precede footer: ' + key);
    if(key !== 'contactEmail') assert(typeof content[key] === 'string' || key === 'serviceOptions',
      'Initial Contact wording missing: ' + key);
  }
  for (const key of styled) assert(names.includes(key+'Style'), 'Missing text size/colour: ' + key);
  assert.equal(names[0], 'heroEyebrow');
  assert.equal(new Set(names).size, names.length, 'Duplicate Contact CMS fields');
  const options = contact.fields.find(field => field.name === 'serviceOptions');
  assert.equal(options.widget, 'list');
  assert.equal(options.fields[0].name, 'label');
  assert.equal(contact.fields.find(field => field.name === 'contactEmail').required, false);
});

test('owner-edited Contact copy, service dropdown and footer images remain valid', () => {
  // Text in /admin belongs to the site owner: never insist on the launch
  // wording once the user has published a custom headline or paragraph.
  for (const key of [...textKeys, ...metaKeys]) {
    assert(typeof content[key] === 'string' && content[key].trim(),
      'Missing published Contact text: ' + key);
  }
  assert(Array.isArray(content.serviceOptions) && content.serviceOptions.length > 0);
  for (const item of content.serviceOptions) {
    assert(typeof item.label === 'string' && item.label.trim(),
      'Every Contact service choice should contain a label');
  }
  assert(content.footerImages.logo.src);
  assert.equal(content.footerImages.badge, undefined);
});

test('Contact page uses editor copy but retains same working form integration', () => {
  for(const key of [...textKeys, ...metaKeys,'contactEmail','serviceOptions']) {
    if(key === 'providerErrorFallback'||key === 'errorSuffix'||key === 'genericError'
       || key === 'sendingButton'||key === 'sendingStatus'||key === 'successStatus') {
      assert(page.includes('contactCopy.'+key), 'Missing status binding: '+key);
    } else {
      assert(page.includes('contactCopy.'+key), 'Missing rendered Contact value: '+key);
    }
  }
  for(const key of styled) assert(page.includes('data-style-key="contact.'+key+'"'),
    'Missing Contact preview/style selector: '+key);
  assert(page.includes('title={contactCopy.metaTitle}'));
  assert(page.includes('description={contactCopy.metaDescription}'));
  assert(page.includes('contactCopy.serviceOptions.map'));
  assert(page.includes('white-space:pre-line'));
  assert(page.includes('action="https://api.web3forms.com/submit"'));
  for(const attr of ['name="access_key"', 'name="subject"', 'name="from_name"',
    'name="botcheck"', 'name="name"', 'name="email"', 'name="service"', 'name="message"']) {
    assert(page.includes(attr), 'Submission field removed: '+attr);
  }
  assert(page.includes('method="POST"'));
  assert(page.includes('form.reportValidity()'));
  assert(page.includes('new FormData(form)'));
  assert(page.includes('headers: { Accept: \'application/json\' }'));
  assert(page.includes('aria-live="polite"'));
  assert(page.includes('form.reset()'));
});

test('Contact font formatting, live preview and working GitHub login are preserved', () => {
  const siteLayout = read('../src/components/SiteLayout.astro');
  const preview = read('../public/admin/preview.js');
  const index = read('../public/admin/index.html');
  assert(siteLayout.includes('contact: pageContent.contact'));
  for (const key of styled.filter(x => x !== 'emailPrefix')) {
    assert(preview.includes("'"+key+"'"), 'Missing preview key: '+key);
  }
  assert(preview.includes('Press Return for a new line'));
  assert(index.includes('/admin/preview.js?v=commercial-text-first-20261113-v4'));
  assert(index.includes('/admin/oauth-popup.js?v=6'));
  const css = typographyCss(undefined,{ contact:{
    heroHeadingStyle:{sizePx:72,color:'#FFFFFF'},
    nameLabelStyle:{sizePx:15,color:'#315C48'}
  }});
  assert(css.includes('[data-style-key="contact.heroHeading"]{font-size:72px;color:#FFFFFF;'));
  assert(css.includes('[data-style-key="contact.nameLabel"]{font-size:15px;color:#315C48;'));
});
