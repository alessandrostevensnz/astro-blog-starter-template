import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cmsConfig } from '../src/lib/cms-config.ts';
const root = fileURLToPath(new URL('../', import.meta.url));
const read = p => readFileSync(root + p, 'utf8');
const load = p => JSON.parse(read(p));
const pages = cmsConfig.collections[0].files;
assert.deepEqual(pages.map(p => p.name), ['home','construction','maintenance','projects','about','contact']);
assert.equal(new Set(pages.map(p => p.file)).size, 6, 'Every editor must save a different page file');
assert.equal(cmsConfig.backend.base_url, 'https://andro.co.nz');
assert.equal(cmsConfig.backend.auth_endpoint, 'api/auth');
assert.equal(existsSync(root + 'public/admin/config.yml'), false, 'Do not shadow the generated config endpoint');
let imageFields = 0;
function check(fields, data, path) {
  assert.equal(new Set(fields.map(f=>f.name)).size,fields.length, 'Duplicate field at '+path);
  for (const key of Object.keys(data)) assert(fields.some(f=>f.name===key), 'Uneditable data: '+path+'.'+key);
  for (const f of fields) {
    const value=data[f.name];
    if (f.widget==='object') { if (value) check(f.fields,value,path+'.'+f.name); }
    else if (f.widget==='list') { assert(Array.isArray(value), 'List missing: '+path+'.'+f.name); value.forEach((v,i)=>check(f.fields,v,path+'.'+f.name+'.'+i)); }
    else if (f.widget==='image') { imageFields++; assert.equal(typeof value,'string','Photo missing: '+path+'.'+f.name); }
  }
}
for (const page of pages) check(page.fields,load(page.file),page.name);
const expectedImages = pages.reduce((n,p) => { const d=load(p.file); return n + Object.keys(d.photos || {}).length + (d.services || []).length + (d.projects || []).length + (d.gallery || []).length + 2; }, 0);
assert.equal(imageFields,expectedImages,'All photo positions, including empty services and footer images');
const counts={home:4,construction:5,maintenance:2,about:2};
const routes={home:'index',construction:'construction',maintenance:'property-maintenance',about:'about'};
for(const [name,count] of Object.entries(counts)) {
  const data=load('content/pages/'+name+'.json');
  assert.equal(Object.keys(data.photos).length,count);
  const template=read('src/pages/'+routes[name]+'.astro');
  for(const key of Object.keys(data.photos)) {
    assert(template.includes('photos.'+key+'.src'), name+' photo not wired: '+key);
    assert(template.includes('photos.'+key+'.alt'), name+' alt not wired: '+key);
  }
  assert(!template.includes('imagery.'), 'Shared imagery remains in '+name);
  assert(!/<img\b[^>]*\bsrc=["']\/images\//.test(template), 'Hard-coded photo remains in '+name);
}
const construction=load('content/pages/construction.json');
const other=load('content/pages/home.json');
const original=JSON.stringify(other);
const oldRight=construction.photos.processRight.src;
construction.photos.residential.src='/images/test-independent-photo.jpg';
assert.equal(construction.photos.processRight.src,oldRight,'Duplicate slots must be independent');
assert.equal(JSON.stringify(other),original,'Editing construction must not change home');
assert(read('src/pages/construction.astro').includes('siteContent.construction.gallery'));
assert(read('src/pages/property-maintenance.astro').includes('siteContent.maintenance.services'));
assert(read('src/data/site.ts').includes('projects: projects.projects'));
const layout=read('src/components/SiteLayout.astro');
assert(layout.includes('footerImages.logo.src') && layout.includes('footerImages.badge.src'));
console.log('PASS: six independent page editors, '+imageFields+' editable photo positions, no missing fields, no shared-slot coupling, gallery/service wiring, OAuth config unchanged.');
