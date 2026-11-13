import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin='https://andro.co.nz';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
for(let attempt=0;attempt<30;attempt++){
  const response=await fetch(origin+'/admin/?breaks-check='+attempt,{cache:'no-store'});
  const html=await response.text();
  if(response.status===200&&html.includes('/admin/preview.js?v=linebreaks-3')) {
    console.log('LIVE_EDITOR_VERSION',JSON.stringify({status:response.status,hasNewPreview:true}));
    break;
  }
  if(attempt===29)throw new Error('Cloudflare has not served the new editor version');
  await sleep(5000);
}

const fixtures=[
 {path:'/',selectors:['[data-style-key="home.title"]','[data-style-key="home.introText"]','[data-style-key="home.constructionCardDescription"]']},
 {path:'/construction/',selectors:['[data-style-key="construction.description"]','[data-style-key="construction.residentialText"]','[data-style-key="construction.processText"]','.construction-photo-title[data-cms-text]']},
 {path:'/property-maintenance/',selectors:['[data-style-key="maintenance.description"]','[data-style-key="maintenance.preventativeText"]','[data-style-key="maintenance.improvementsText"]','.maintenance-service-copy p[data-cms-text]']},
 {path:'/projects/',selectors:['[data-style-key="projects.heroHeading"]','[data-style-key="projects.galleryNote"]','.andro-project-title[data-cms-text]']},
 {path:'/about/',selectors:['[data-style-key="about.heroIntro"]','[data-style-key="about.whoText"]','[data-style-key="about.craftText"]']},
 {path:'/contact/',selectors:['[data-style-key="contact.sectionDescription"]','[data-style-key="contact.sectionHeading"]','[data-style-key="contact.formNotice"]']}
];
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:1280,height:850}});
 for (const fixture of fixtures){
   const page=await context.newPage();
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message.slice(0,120)));
   const response=await page.goto(origin+fixture.path+'?spacing-check=1',{waitUntil:'domcontentloaded',timeout:45000});
   assert.equal(response.status(),200,fixture.path+' should render');
   const result=await page.evaluate(selectors=>selectors.map(selector=>{
      const node=document.querySelector(selector);
      if(!node)return {selector,error:'missing'};
      const value=node.textContent||'';
      const style=getComputedStyle(node);
      return {selector,whiteSpace:style.whiteSpace,
        containsNewline:value.includes('\n'),containsParagraphGap:value.includes('\n\n'),
        renderedNewlines:(node.innerText||'').includes('\n'),textLength:value.length};
   }),fixture.selectors);
   console.log('LIVE_PAGE',JSON.stringify({path:fixture.path,results:result,errors}));
   assert(result.every(row=>row.whiteSpace==='pre-wrap'),fixture.path+' editor text must preserve newlines');
   assert(!errors.length,'Unexpected browser page script errors: '+fixture.path);
   if(fixture.path==='/about/'){
      const craft=result.find(row=>row.selector.includes('craftText'));
      if(craft.containsNewline)assert(craft.renderedNewlines,
         'Existing About craftsmanship newlines should be visible in browser layout');
   }
   await page.close();
 }
 const mobile=await context.newPage({viewport:{width:390,height:844}});
 await mobile.goto(origin+'/about/?spacing-mobile=1',{waitUntil:'domcontentloaded'});
 const mobileStyle=await mobile.evaluate(()=>getComputedStyle(document.querySelector('[data-style-key="about.craftText"]')).whiteSpace);
 console.log('MOBILE_ABOUT_CRAFT_WHITESPACE',mobileStyle);
 assert.equal(mobileStyle,'pre-wrap');
 await mobile.close();
}finally{await browser.close();}
