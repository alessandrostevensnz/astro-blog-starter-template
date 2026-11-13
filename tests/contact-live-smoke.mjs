import assert from 'node:assert/strict';
const origin='https://andro.co.nz';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const required=['heroEyebrow','heroHeading','heroDescription','sectionEyebrow','sectionHeading',
  'sectionDescription','contactEmail','emailPrefix','nameLabel','emailLabel','serviceLabel',
  'servicePlaceholder','serviceOptions','messageLabel','submitLabel','formNotice',
  'sendingButton','sendingStatus','successStatus','providerErrorFallback',
  'errorSuffix','genericError','metaTitle','metaDescription'];
let config;
for(let i=0;i<30;i++) {
  const response=await fetch(origin+'/admin/config.yml?contact-smoke='+i,{cache:'no-store'});
  try{config=await response.json();}catch{config=null;}
  const entry=config?.collections?.find(c=>c.name==='pages')?.files?.find(f=>f.name==='contact');
  if(response.status===200&&required.every(key=>entry?.fields?.some(f=>f.name===key)))break;
  console.log('CONTACT_CONFIG_NOT_LIVE_YET',i,response.status);
  if(i===29)throw Error('Updated Contact fields not present in production');
  await sleep(5000);
}
const contact=config.collections.find(c=>c.name==='pages').files.find(f=>f.name==='contact');
const keys=contact.fields.map(f=>f.name);
assert.equal(new Set(keys).size,keys.length);
assert(keys.indexOf('heroHeading')<keys.indexOf('footerImages'));
const dropdown=contact.fields.find(f=>f.name==='serviceOptions');
assert.equal(dropdown.widget,'list');
assert.equal(dropdown.fields[0].name,'label');
for(const key of ['heroHeading','sectionHeading','heroDescription','sectionDescription','nameLabel','submitLabel','formNotice'])
  assert(keys.includes(key+'Style'),'Missing styling control: '+key);
console.log('LIVE_CONTACT_CONFIG',JSON.stringify({status:200,fields:required.length,
  styles:keys.filter(k=>k.endsWith('Style')).length,serviceOptions:true,
  footerImagesStillEditable:keys.includes('footerImages')}));
const response=await fetch(origin+'/contact/?contact-smoke=1',{cache:'no-store'});
const html=await response.text();
assert.equal(response.status,200);
const checks={
  heading:html.includes('Let’s make a')&&html.includes('good start.'),
  intro:html.includes('Have a maintenance issue you are unsure about'),
  section:html.includes('A considered')&&html.includes('conversation.'),
  description:html.includes('A few useful details help us understand your enquiry'),
  formLabels:html.includes('Your name')&&html.includes('What can we help with?')&&html.includes('A little about your property'),
  serviceChoices:html.includes('Residential construction or carpentry')&&html.includes('Other enquiry'),
  emailMeta:html.includes('Contact ANDRO | Construction &amp; Property Maintenance Auckland') ||
            html.includes('Contact ANDRO | Construction & Property Maintenance Auckland'),
  formEndpoint:html.includes('https://api.web3forms.com/submit'),
  hiddenInputs:['name="access_key"','name="subject"','name="from_name"','name="botcheck"'].every(v=>html.includes(v)),
  statusAttrs:html.includes('data-success-status=')&&html.includes('data-error-suffix='),
  previewIds:html.includes('data-style-key="contact.heroHeading"') &&
             html.includes('data-style-key="contact.submitLabel"')
};
console.log('LIVE_CONTACT_PAGE',JSON.stringify({status:response.status,checks}));
assert(Object.values(checks).every(Boolean),'Production Contact content or form invariant missing');
const adminResp=await fetch(origin+'/admin/?contact-smoke=1',{cache:'no-store'});
const admin=await adminResp.text();
assert(admin.includes('preview.js?v=projects-contact-text-2'));
assert(admin.includes('oauth-popup.js?v=6'));
const scriptResp=await fetch(origin+'/admin/preview.js?v=projects-contact-text-2',{cache:'no-store'});
const preview=await scriptResp.text();
assert(preview.includes("'02 - contact banner heading': 'heroHeading'"));
assert(preview.includes("'14 - send button wording': 'submitLabel'"));
console.log('LIVE_CONTACT_PREVIEW_AUTH',JSON.stringify({previewScript:scriptResp.status,
  previewKeys:true,oauthV6Preserved:true}));
