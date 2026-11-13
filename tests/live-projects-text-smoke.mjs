import assert from 'node:assert/strict';
const origin = 'https://andro.co.nz';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let config, rendered, html, preview;
for (let attempt=1; attempt<=32; attempt++) {
  const res = await fetch(origin+'/admin/config.yml?projects-text-smoke='+attempt,{cache:'no-store',redirect:'manual'});
  const body=await res.text();
  try { config=JSON.parse(body); } catch { config=null; }
  const pages=config?.collections?.find(item=>item.name==='pages');
  const projects=pages?.files?.find(item=>item.name==='projects');
  const fields=projects?.fields?.map(item=>item.name)||[];
  const hasCopy=fields.includes('heroHeading') && fields.includes('galleryNote') && fields.includes('ctaHeading');
  if(hasCopy) {
    console.log('LIVE_CMS_CONFIG_DEPLOYED',JSON.stringify({status:res.status,
      fieldsBeforePhotos:fields.slice(0,19),galleryPreserved:fields.includes('projects'),
      photoPreserved:fields.includes('photos'),heroVideoPreserved:fields.includes('heroVideo')}));
    break;
  }
  console.log('WAITING_FOR_LIVE_PROJECTS_CONFIG',JSON.stringify({attempt,status:res.status,hasCopy}));
  if(attempt===32)throw Error('New Projects CMS text configuration did not deploy');
  await sleep(5000);
}
const projects=config.collections.find(item=>item.name==='pages').files.find(item=>item.name==='projects');
const fields=projects.fields.map(x=>x.name);
for(const name of ['heroEyebrow','heroHeading','heroDescription','galleryTip','galleryNote','ctaHeading','ctaButtonText','metaTitle','metaDescription']){
  assert(fields.includes(name),'Missing public CMS field: '+name);
  assert(fields.indexOf(name)<fields.indexOf('photos'),'Text field not above photos: '+name);
}
for(const name of ['heroHeading','heroDescription','galleryTip','galleryNote','ctaHeading','ctaButtonText']){
  assert(fields.includes(name+'Style'),'Missing style controls: '+name);
}
const projResp=await fetch(origin+'/projects/?cms-projects-check=1',{cache:'no-store'});
html=await projResp.text();
const checks={
 heroHeading:html.includes('Every brief') && html.includes('starts somewhere.'),
 intro:html.includes('Buildings are shaped by hundreds of decisions'),
 galleryHelp:html.includes('Hover over a photo to learn more.'),
 galleryClosing:html.includes('Every property and project has its own requirements.'),
 contact:html.includes('Have a brief') && html.includes('to share?'),
 meta:html.includes('Projects | ANDRO Construction + Projects Auckland'),
 gallery:html.includes('Custom Kitchen') && html.includes('New Kwila Deck')
};
console.log('LIVE_PROJECTS_PAGE',JSON.stringify({status:projResp.status,checks}));
assert.equal(projResp.status,200);
assert(Object.values(checks).every(Boolean),'Projects page text/gallery did not render');
const adminResp=await fetch(origin+'/admin/?projects-preview-check=1',{cache:'no-store'});
const admin=await adminResp.text();
assert(admin.includes('preview.js?v=projects-text-1'));
assert(admin.includes('oauth-popup.js?v=6'));
const previewResp=await fetch(origin+'/admin/preview.js?v=projects-text-1',{cache:'no-store'});
preview=await previewResp.text();
assert(preview.includes("'02 - main projects banner heading': 'heroHeading'"));
assert(preview.includes("'05 - paragraph below the project photos': 'galleryNote'"));
console.log('LIVE_PROJECTS_PREVIEW_AND_AUTH',JSON.stringify({status:previewResp.status,
 previewTextKeys:true,workingV6LoginPreserved:true}));
