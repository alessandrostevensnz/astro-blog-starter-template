import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { cmsConfig } from '../src/lib/cms-config.ts';
import { typographyCss } from '../src/lib/typography.ts';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const data = JSON.parse(read('../content/pages/projects.json'));
const fields = ['heroEyebrow','heroHeading','heroDescription','galleryTip','galleryNote','ctaHeading','ctaButtonText','metaTitle','metaDescription'];
const styled = fields.slice(0,7);

test('Projects editor exposes all visible page copy before the existing photo gallery', () => {
  const pages = cmsConfig.collections.find(c => c.name === 'pages');
  assert(pages, 'Missing Pages collection');
  const projectPage = pages.files.find(f => f.name === 'projects');
  assert.equal(projectPage.file, 'content/pages/projects.json');
  const keys = projectPage.fields.map(field => field.name);
  for (const name of fields) {
    assert(keys.includes(name), 'Missing editor text field: '+name);
    assert(keys.indexOf(name) < keys.indexOf('photos'), name+' must appear before gallery');
    assert(typeof data[name] === 'string' && data[name].trim(), 'Missing initial text: '+name);
  }
  assert(keys.includes('photos'));
  assert(keys.includes('projects'));
  assert(keys.includes('heroVideo'));
  assert(keys.includes('heroVideoPoster'));
  assert(!keys.includes('footerImages'), 'Footer controls belong in Website-wide settings');
  assert.equal(new Set(keys).size, keys.length, 'Duplicate Decap fields detected');
  for (const name of styled) assert(keys.includes(name+'Style'), 'Missing size/colour controls for '+name);
});

test('all existing project photos and property copy remain intact', () => {
  assert(Array.isArray(data.projects));
  // Owners are free to add or remove project entries in Decap after this test is written.
  assert(data.projects.length >= 1, 'Project gallery should contain at least one entry');
  for(const entry of data.projects) {
    assert(entry.image && entry.title && entry.category,
      'Existing project gallery item missing photo or text');
  }
  assert(data.photos.hero.src && data.photos.hero.alt);
  assert(data.heroVideo && data.heroVideoPoster);
  assert.equal(data.footerImages, undefined, 'No duplicate footer settings on Projects');
  assert(typeof data.heroEyebrow === 'string' && data.heroEyebrow.trim(), 'Projects banner label must remain editable');
  assert(typeof data.heroHeading === 'string' && data.heroHeading.trim(), 'Projects banner heading must remain editable');
  assert(typeof data.heroDescription === 'string' && data.heroDescription.trim(), 'Projects intro should be present');
  assert(typeof data.ctaHeading === 'string' && data.ctaHeading.trim(), 'Projects CTA heading should be present');
});

test('Projects page renders each editable field and SEO content directly from page data', () => {
  const source = read('../src/pages/projects.astro');
  for (const name of fields) {
    assert(source.includes('projectCopy.'+name), 'Projects page does not use '+name);
  }
  for (const name of styled) {
    assert(source.includes('data-style-key="projects.'+name+'"'), 'Missing preview/style target: '+name);
  }
  assert(source.includes('white-space: pre-line'), 'Newline formatting was lost');
  assert(source.includes('siteContent.projects.map'), 'Gallery data source changed');
  assert(source.includes('pageContent.projects.photos.hero') || source.includes('projectCopy.photos.hero'));
  assert(source.includes('title={projectCopy.metaTitle}'));
  assert(source.includes('description={projectCopy.metaDescription}'));
});

test('Projects styles and live text preview work without impacting other pages', () => {
  const preview = read('../public/admin/preview.js');
  const html = read('../public/admin/index.html');
  const siteLayout = read('../src/components/SiteLayout.astro');
  for (const name of ['heroEyebrow','heroHeading','heroDescription','galleryTip','galleryNote','ctaHeading','ctaButtonText']) {
    assert(preview.includes("'"+name+"'"), 'Live preview key missing: '+name);
  }
  assert(html.includes('preview.js?v=global-footer-projects-gallery-v5'));
  assert(html.includes('/admin/oauth-popup.js?v=6'), 'Do not disturb working v6 OAuth login');
  assert(siteLayout.includes('projects: pageContent.projects'), 'Projects inline font styles not passed through');
  const css = typographyCss(undefined, { projects: {
    heroHeadingStyle: { sizePx: 54, color: '#FFFFFF' },
    galleryNoteStyle: { sizePx: 17, color: '#315C48' }
  } });
  assert(css.includes('[data-style-key="projects.heroHeading"]{font-size:54px;color:#FFFFFF;'));
  assert(css.includes('[data-style-key="projects.galleryNote"]{font-size:17px;color:#315C48;'));
});


test('Projects auto-scrolls slowly with readable captions and 2x5 manual navigation', () => {
  const source=read('../src/pages/projects.astro');
  assert(source.includes('siteContent.projects.map'), 'All CMS project photos must remain');
  assert(source.includes('data-project-prev') && source.includes('data-project-next'), 'Manual arrows must remain');
  assert(source.includes('grid-template-rows: repeat(2, auto)'), 'Two rows are required');
  assert(source.includes('grid-auto-columns: calc((100% - 4 * var(--project-gap)) / 5)'), 'Five columns must remain visible');
  assert(source.includes('const columnsPerClick = () => smallScreen.matches ? 1 : 3'), 'Desktop arrow must move three columns (six photos)');
  assert(source.includes('const pixelsPerSecond = smallScreen.matches ? 25 : 42'), 'Keep the automatic reel roughly half Construction speed');
  assert(source.includes('viewport.scrollLeft += pixelsPerSecond * elapsed'), 'Auto-scroll must advance smoothly');
  assert(source.includes('secondCopy.forEach(tile => gallery.appendChild(tile))'), 'Loop must be seamless');
  assert(source.includes("viewport.addEventListener('pointerenter'"), 'Hover should pause to allow reading');
  assert(source.includes('!reducedMotion.matches'), 'Respect reduced motion preferences');
  assert(source.includes('aria-hidden'), 'Duplicate looping photos must be hidden from screen readers');
  assert(source.includes('opacity: 1; transform: none;'), 'Descriptions must be visible at all times');
  assert(!source.includes('aria-expanded="false"'), 'Descriptions must not require tap');
  assert(source.includes('figcaption'), 'Captions must be semantic');
  assert.equal(data.projects.length >= 10,true);
});

test('All six pages share ONE editable footer with no Site Safe badge field', () => {
  const shared=JSON.parse(read('../content/site-footer.json'));
  assert.equal(shared.logo.src, '/images/andro-footer-circular.png');
  assert.equal(shared.companyName, 'Andro Construction Limited');
  for(const name of ['home','construction','maintenance','projects','about','contact']){
    const page=JSON.parse(read('../content/pages/' + name + '.json'));
    assert.equal(page.footerImages, undefined, 'Duplicate footer in '+name);
  }
  const layout=read('../src/components/SiteLayout.astro');
  const siteData=read('../src/data/site.ts');
  assert(layout.includes('siteFooter.logo.src') && layout.includes('siteFooter.companyName'));
  assert(layout.includes('siteFooter.establishedText') && layout.includes('siteFooter.domainText'));
  assert(!layout.includes('footerImages.badge') && !layout.includes('footerImagesForPath'));
  assert(siteData.includes("import footerSettings from '../../content/site-footer.json'"));
  assert(!siteData.includes('footerImagesForPath'));
  const settings=cmsConfig.collections.find(c=>c.name==='settings');
  const footer=settings.files.find(f=>f.name==='footer');
  assert.equal(footer.file,'content/site-footer.json');
  for(const name of ['logo','companyName','domainText','domainUrl','establishedText'])
    assert(footer.fields.some(f=>f.name===name));
  assert(!footer.fields.some(f=>f.name==='badge'));
  for(const page of cmsConfig.collections.find(c=>c.name==='pages').files)
    assert(!page.fields.some(f=>f.name==='footerImages'), 'Legacy footer editor remains on '+page.name);
  assert(!read('../src/lib/cms-config.ts').includes("photo('badge'"));
  assert(layout.includes('height: 142px'), 'Keep the circular logo large enough to read');
});
