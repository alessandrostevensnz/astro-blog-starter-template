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
  const existing = JSON.parse(read('../content/pages/about.json'));
  assert(existing.craftText.includes('\n\n'),
    'Existing real About copy must retain its blank paragraph break');
  assert(existing.craftText.includes('\n'),
    'Existing About copy must retain deliberate single-line breaks');
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
  assert(admin.includes('/admin/preview.js?v=linebreaks-3'));
  assert(admin.includes('/admin/oauth-popup.js?v=6'),'Working admin OAuth v6 must stay intact');
});
