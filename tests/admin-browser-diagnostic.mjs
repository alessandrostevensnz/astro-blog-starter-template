import { chromium } from 'playwright';

// Public-site only: no credentials or GitHub authorization are used.
// The native popup is stubbed to record URLs without visiting OAuth.
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-sandbox']});
try {
  const context=await browser.newContext();
  await context.addInitScript(() => {
    const captured=[];
    Object.defineProperty(window,'__androDebugOpens',{value:captured,configurable:true});
    window.open=function(url,target,features){
      captured.push({url:String(url),target:String(target||''),features:String(features||'')});
      return {focus(){},close(){},postMessage(){},closed:false};
    };
  });
  const page=await context.newPage();
  const failures=[];
  page.on('pageerror',e=>failures.push('PAGE_ERROR '+e.message.slice(0,180)));
  page.on('requestfailed',r=>failures.push('REQUEST_FAILED '+new URL(r.url()).pathname+' '+(r.failure()?.errorText||'')));
  const r=await page.goto('https://andro.co.nz/admin/?browser-diagnostic=1',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForTimeout(7000);
  const initial=await page.evaluate(()=>({
    title:document.title,
    helperInstalled:window.__androOAuthPopupInstalled===true,
    helperHasRelay:String(window.open).includes('andro_relay'),
    buttons:[...document.querySelectorAll('button')].map(b=>(b.textContent||'').trim().slice(0,90)).filter(Boolean).slice(0,15),
    bodyText:(document.body.innerText||'').slice(0,350),
    scripts:[...document.scripts].map(s=>s.src?new URL(s.src).pathname:'inline').slice(0,10)
  }));
  console.log('PAGE',r.status());
  console.log('INITIAL',JSON.stringify(initial));
  console.log('FAILURES',JSON.stringify(failures));
  const btn=page.getByRole('button',{name:/login with github|log in with github|sign in with github|github/i}).first();
  if(await btn.count()){
    await btn.click();
    await page.waitForTimeout(1500);
  }else{
    console.log('NO_GITHUB_BUTTON, trying buttons',JSON.stringify(initial.buttons));
  }
  const after=await page.evaluate(()=>({
    opens:window.__androDebugOpens.map(({url,target,features})=>{
      const u=new URL(url,window.location.href);
      return {origin:u.origin,path:u.pathname,provider:u.searchParams.get('provider'),relayLength:u.searchParams.get('andro_relay')?.length||0,target};
    }),
    buttons:[...document.querySelectorAll('button')].map(x=>(x.textContent||'').trim().slice(0,90)).filter(Boolean).slice(0,15),
    bodyText:(document.body.innerText||'').slice(0,350)
  }));
  console.log('AFTER_CLICK',JSON.stringify(after));
  console.log('FAILURES_AFTER',JSON.stringify(failures));
  if(!initial.helperInstalled) throw Error('OAuth helper did not install in real browser');
} finally {await browser.close();}
