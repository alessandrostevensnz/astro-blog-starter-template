import { chromium } from 'playwright';

const origin = 'https://andro.co.nz';
const relay = 'b'.repeat(32);
for(let i=0;i<30;i++){
  const response=await fetch(origin+'/admin/?v6-check='+i,{cache:'no-store'});
  const html=await response.text();
  if(response.status===200 && html.includes('oauth-popup.js?v=6'))break;
  if(i===29)throw new Error('Live /admin/ did not deploy login v6');
  await new Promise(resolve=>setTimeout(resolve,6000));
}
console.log('LIVE_VERSION_6',true);
const blocked=await fetch(origin+'/api/auth/poll?relay=auto',{headers:{Accept:'application/json'},redirect:'manual'});
const blockReason=blocked.headers.get('X-ANDRO-Poll-Block');
const versionHeader=blocked.headers.get('X-ANDRO-Poll-Version');
console.log('SITE_GUARD_403',JSON.stringify({status:blocked.status,blockReason,versionHeader}));
if(blocked.status!==403 || blockReason!=='editor-header'||versionHeader!=='6')
  throw new Error('Expected transparent site-side 403 diagnostics from v6');
const browser = await chromium.launch({headless:true, channel:'chrome', args:['--no-sandbox']});
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const reqs = [];
  const responses = [];
  page.on('request', request => {
    if (!request.url().includes('/api/auth/poll?')) return;
    const headers = request.headers();
    reqs.push({path: new URL(request.url()).pathname,
      relayKind: new URL(request.url()).searchParams.get('relay') === 'auto' ? 'auto' : 'exact',
      origin: headers.origin || '', secFetchSite: headers['sec-fetch-site'] || '',
      secFetchMode: headers['sec-fetch-mode'] || '',
      editorHeader: headers['x-andro-editor'] || '', credentialsCookiePresent: !!headers.cookie });
  });
  page.on('response', response => {
    if (!response.url().includes('/api/auth/poll?')) return;
    const headers = response.headers();
    responses.push({status:response.status(),contentType:headers['content-type'],
      cfRayPresent:!!headers['cf-ray'], cacheControl:headers['cache-control'],
      server:headers.server||'', cfMitigated:headers['cf-mitigated']||''});
  });
  const nav = await page.goto(origin + '/admin/?auth-diagnostic-403=1', {waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForTimeout(3500);
  const results = await page.evaluate(async relay => {
    const paths=['/api/auth/poll?relay='+relay,'/api/auth/poll?relay=auto'];
    const out=[];
    for (const path of paths) for(const editorHeader of [false,true]) {
      try {
        const response = await fetch(path, {
          credentials:'same-origin', cache:'no-store',
          headers: editorHeader ? {'X-ANDRO-Editor':'login-v5','Accept':'application/json'} : {'Accept':'application/json'}
        });
        const body=await response.text();
        out.push({path:path.split('?')[0],relayType:path.endsWith('auto')?'auto':'exact',
          editorHeader,status:response.status, finalPath:new URL(response.url).pathname,
          contentType:response.headers.get('content-type') || '',
          cfMitigated:response.headers.get('cf-mitigated') || '',
          cfRayPresent:!!response.headers.get('cf-ray'),
          bodyBytes:body.length,bodyPrefix:body.slice(0,180).replace(/\\s+/g,' ')});
      } catch(e){out.push({path,editorHeader,error:String(e).slice(0,140)});}
    }
    return {version:window.__androOAuthStatus?.version || 'missing',out};
  }, relay);
  console.log('BROWSER_PAGE', nav.status(), page.url());
  console.log('BROWSER_REQUESTS', JSON.stringify(reqs));
  console.log('BROWSER_RESPONSES', JSON.stringify(responses));
  console.log('BROWSER_FETCH_RESULTS', JSON.stringify(results));
  if(results.version!=='6')throw new Error('Browser did not load login v6');

  // Reproduce the cookie shape present after a successful GitHub callback.
  // The value is deliberately invalid; no personal account or real token.
  const cookieName='__Host-andro_oauth_result_'+relay;
  async function setFakeReceipt() {
    await ctx.addCookies([
      {name:cookieName, value:'dummy-test-not-a-token', url:origin+'/', secure:true, httpOnly:true, sameSite:'Lax'},
      {name:'__Host-andro_oauth_state_'+relay, value:'c'.repeat(64)+'.'+relay,
       url:origin+'/', secure:true, httpOnly:true, sameSite:'Lax'}
    ]);
  }
  for (const scenario of [
    {label:'exact-with-httpOnly-result-cookie', type:'exact'},
    {label:'auto-with-httpOnly-result-cookie', type:'auto'}
  ]) {
    await setFakeReceipt();
    const state=await page.evaluate(async ({type,relay})=>{
      const response=await fetch('/api/auth/poll?relay='+(type==='auto'?'auto':relay),{
        credentials:'same-origin',cache:'no-store',
        headers:{'X-ANDRO-Editor':'login-v5','Accept':'application/json'}
      });
      const body=await response.text();
      return {status:response.status,bodyBytes:body.length,contentType:response.headers.get('content-type')||''};
    },{type:scenario.type,relay});
    console.log('FAKE_COOKIE',JSON.stringify({...scenario,...state}));
  }

  const urls = [
    '/api/auth/poll?relay='+relay,
    '/api/auth/poll?relay=auto'
  ];
  for(const path of urls){
    const headers={'Accept':'application/json','X-ANDRO-Editor':'login-v5'};
    const res=await fetch(origin+path,{headers,redirect:'manual'});
    const body=await res.text();
    console.log('NODE_FETCH', JSON.stringify({relayType:path.endsWith('auto')?'auto':'exact',
      status:res.status,contentType:res.headers.get('content-type')||'',
      cfMitigated:res.headers.get('cf-mitigated')||'',bodyBytes:body.length,
      bodyPrefix:body.slice(0,180).replace(/\\s+/g,' ')}));
  }
}finally{await browser.close();}
