import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { cmsConfig } from '../src/lib/cms-config.ts';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const layout = read('../src/components/SiteLayout.astro');
const pages = {
  home: 'index.astro',
  construction: 'construction.astro',
  maintenance: 'property-maintenance.astro',
  projects: 'projects.astro',
  about: 'about.astro',
  contact: 'contact.astro'
};
const bodyFields = {
  home: ['introText','constructionCardDescription','maintenanceCardDescription','philosophyText','subtitle'],
  construction: ['description','introText','residentialText','commercialText','processText'],
  maintenance: ['description','introText','preventativeText','residentialText','commercialText','assetText','improvementsText'],
  projects: ['heroDescription','galleryTip','galleryNote'],
  about: ['heroIntro','whoText','craftText'],
  contact: ['heroDescription','sectionDescription','formNotice']
};
const headingFields = {
  home: ['title','introHeading','servicesHeading','constructionCardTitle','maintenanceCardTitle','featureHeading','philosophyHeading','closingHeading'],
  construction: ['introHeading','residentialHeading','commercialHeading','processHeading'],
  maintenance: ['introHeading','preventativeHeading','residentialHeading','commercialHeading','assetHeading','improvementsHeading'],
  projects: ['heroHeading','ctaHeading'],
  about: ['whoHeading'],
  contact: ['heroHeading','sectionHeading']
};

test('shared stylesheet preserves individual Return and blank-line gaps, without HTML injection', () => {
  assert(layout.includes('[data-style-key], [data-cms-text]'));
  assert(layout.includes('white-space: pre-wrap !important;'));
  assert(layout.includes('overflow-wrap: break-word;'));
  assert(layout.includes("target.textContent = fields[key]"), 'live preview must use safe textContent');
  assert(!layout.includes("target.innerHTML = fields[key]"), 'untrusted editor text must not be interpreted as HTML');
  // The About copy is owner-controlled; formatting must also work after
  // they rewrite it and remove or add paragraphs.
  const existing = JSON.parse(read('../content/pages/about.json'));
  assert(typeof existing.craftText === 'string', 'About copy should remain editable');
});

test('all six published pages mark CMS text for preserved whitespace', () => {
  for (const [page,filename] of Object.entries(pages)) {
    const src=read('../src/pages/'+filename);
    for(const key of [...bodyFields[page], ...headingFields[page]]) {
      const attribute='data-style-key="'+page+'.'+key+'"';
      assert(src.includes(attribute),filename+' missing paragraph formatting for '+key);
    }
  }
  const maintenance=read('../src/pages/property-maintenance.astro');
  for(const code of ['service.number','service.title','service.description','service.caption']) {
    assert(maintenance.includes('data-cms-text>{'+code+'}'), 'Maintenance service entry missing '+code);
  }
  const projects=read('../src/pages/projects.astro');
  for(const code of ['entry.category','entry.title','entry.description']) {
    assert(projects.includes('data-cms-text>{'+code+'}'), 'Project gallery entry missing '+code);
  }
  const construction=read('../src/pages/construction.astro');
  for(const code of ['project.category','project.title']) {
    assert(construction.includes('data-cms-text>{'+code+'}'), 'Construction gallery entry missing '+code);
  }
});

test('all page headings and descriptions accept multiline Return in Decap', () => {
  const collection=cmsConfig.collections.find(item=>item.name==='pages');
  assert(collection,'Page-first CMS collection is missing');
  for(const page of Object.keys(pages)) {
    const fields=collection.files.find(item=>item.name===page)?.fields;
    assert(fields, 'No editable '+page+' page');
    for(const key of [...bodyFields[page],...headingFields[page]]) {
      const editor=fields.find(item=>item.name===key);
      assert(editor,'Cannot edit '+page+'.'+key);
      assert.equal(editor.widget,'text',
        page+'.'+key+' must accept Return, not only single-line typing');
      assert(editor.hint?.includes('blank line'),
        'The editor should explain how to make a paragraph gap for '+page+'.'+key);
    }
  }
});

test('live CMS preview mirrors typed newlines and preserves working authentication', () => {
  const preview=read('../public/admin/preview.js');
  const admin=read('../public/admin/index.html');
  for(const label of [
    "'craftsmanship description': 'craftText'",
    "'banner introduction': 'heroIntro'",
    "'page description': 'description'",
    "'construction card description': 'constructionCardDescription'",
    "'residential introduction (above three service rows)': 'residentialText'",
    "'preventative maintenance description': 'preventativeText'"
  ])assert(preview.includes(label),'Missing instant preview mapping '+label);
  assert(preview.includes('Press Return for a new line'));
  assert(admin.includes('/admin/preview.js?v=construction-services-editor-20261113-v3'));
  assert(admin.includes('/admin/oauth-popup.js?v=6'),'Working admin OAuth v6 must stay intact');
});

// Regression: the Construction editor must not fall back to photo-only fields.
test('Construction editor loads a fresh configuration with editable, repeatable residential services', () => {
  const html = read('../public/admin/index.html');
  assert(html.includes('rel="cms-config-url"'), 'Decap must use the versioned configuration link');
  assert(html.includes('/admin/config.yml?v=residential-editor-20261113-v2'), 'Versioned CMS URL must bypass stale browser cache');
  const pages = cmsConfig.collections.find(c => c.name === 'pages');
  const construction = pages.files.find(entry => entry.name === 'construction');
  const rootFields = construction.fields;
  const get = name => rootFields.find(item => item.name === name);
  const services = get('residentialServices');
  const bullets = get('residentialHighlights');
  assert(services, 'Residential service list must be editable');
  assert(bullets, 'Additional residential bullet points must be editable');
  assert.equal(services.widget, 'list');
  assert.equal(bullets.widget, 'list');
  assert.equal(services.allow_add, true, 'Add residential service button must be enabled');
  assert.equal(bullets.allow_add, true, 'Add bullet point button must be enabled');
  assert(rootFields.indexOf(services) < rootFields.findIndex(x => x.name === 'photos'), 'Residential text edits must be above the photo gallery');
  for (const key of ['title','description','bulletPoints','image','imageAlt']) {
    assert(services.fields.some(f => f.name === key), 'Missing editable residential service field: ' + key);
  }
  const subBullets = services.fields.find(f => f.name === 'bulletPoints');
  assert.equal(subBullets.widget, 'list');
  assert.equal(subBullets.allow_add, true);
  assert.equal(subBullets.field?.widget, 'string');
  const content = JSON.parse(read('../content/pages/construction.json'));
  assert(content.residentialServices.length >= 3, 'Original residential services must be preserved');
  assert(content.residentialServices.every(s => typeof s.title === 'string' && typeof s.description === 'string' && s.image));
  const photoFields = rootFields.find(f => f.name === 'photos').fields.map(f => f.name);
  for(const key of ['serviceCarpentry','serviceDecks','serviceRenovations']) {
    assert(!photoFields.includes(key), 'Duplicate residential photo field must not remain: ' + key);
  }
  const page = read('../src/pages/construction.astro');
  assert(page.includes('residentialServices.map'), 'Public site must render the repeatable rows');
  assert(page.includes('residentialHighlights.map'), 'Public site must render extra bullet points');
});


test('Commercial Construction has fully editable service text, bullet points and photos like Residential', () => {
  const cmsPage = cmsConfig.collections.find(c => c.name === 'pages').files.find(f => f.name === 'construction');
  const fields = cmsPage.fields;
  const commercial = fields.find(f => f.name === 'commercialServices');
  const highlights = fields.find(f => f.name === 'commercialHighlights');
  assert(commercial && highlights, 'Commercial service and bullet editors must be accessible');
  assert.equal(commercial.widget, 'list');
  assert.equal(highlights.widget, 'list');
  assert.equal(commercial.allow_add, true);
  assert.equal(commercial.allow_remove, true);
  assert.equal(commercial.allow_reorder, true);
  assert.equal(highlights.allow_add, true);
  const fieldNames = commercial.fields.map(f => f.name);
  for (const name of ['title','description','bulletPoints','image','imageAlt']) assert(fieldNames.includes(name), 'Commercial editor missing '+name);
  const nestedBullets = commercial.fields.find(f => f.name === 'bulletPoints');
  assert.equal(nestedBullets.widget, 'list');
  assert.equal(nestedBullets.field.widget, 'string');
  assert.equal(nestedBullets.allow_add, true);
  const photos = fields.find(f => f.name === 'photos');
  for (const k of ['serviceCommercialCarpentry','serviceCommercialFitouts','serviceCommercialRefurbishment']) {
    assert(!photos.fields.some(f => f.name === k), 'Old duplicate photo field remains in /admin: '+k);
  }
  const data = JSON.parse(read('../content/pages/construction.json'));
  assert(Array.isArray(data.commercialServices) && data.commercialServices.length >= 3, 'Original three commercial services must survive');
  assert(data.commercialServices.every(s => s.title && s.description && s.image), 'All migrated commercial services should retain text and photos');
  assert(Array.isArray(data.commercialHighlights));
  assert(Array.isArray(data.residentialServices) && data.residentialServices.length >= 3, 'Do not change residential data');
  const source = read('../src/pages/construction.astro');
  assert(source.includes('commercialServices.map'), 'Live commercial rows should render from new editable data');
  assert(source.includes('commercialHighlights.map'), 'Live commercial bullet list is missing');
  assert(!source.includes('photos.serviceCommercialCarpentry.src'), 'Old fixed commercial photo reference must not override CMS');
  assert(read('../public/admin/index.html').includes('construction-services-editor-20261113-v3'), 'CMS should load a fresh configuration');
});
