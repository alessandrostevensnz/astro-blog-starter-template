import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = 'https://andro.co.nz';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let html = '';

for (let attempt = 1; attempt <= 18; attempt++) {
  const response = await fetch(origin + '/admin/?andro_smoke_v5=' + attempt, {
    redirect: 'manual', cache: 'no-store'
  });
  html = await response.text();
  if (response.status === 200 && html.includes('oauth-popup.js?v=5')) break;
  console.log('Deployment not ready for v5 (attempt '+attempt+'), status='+response.status);
  if (attempt === 18) throw new Error('Production /admin does not serve the v5 helper');
  await pause(7000);
}

console.log('LIVE_ADMIN', JSON.stringify({
  version5: html.includes('oauth-popup.js?v=5'),
  htmlStatus: 200
}));

const helper = await fetch(origin + '/admin/oauth-popup.js?v=5', {cache:'no-store'});
const source = await helper.text();
assert.equal(helper.status, 200);
assert(source.includes("status = window.__androOAuthStatus"));
assert(source.includes('monitorLegacyClick'));
assert(source.includes('relay='));
console.log('LIVE_HELPER', JSON.stringify({status:helper.status, v5:source.includes("version: '5'")}));

const auth = await fetch(origin + '/api/auth?provider=github', {redirect:'manual'});
const location = auth.headers.get('location') || '';
const target = new URL(location);
const state = target.searchParams.get('state') || '';
const relay = state.slice(65);
const cookie = auth.headers.get('set-cookie') || '';
console.log('AUTH_NO_RELAY_QUERY', JSON.stringify({
  status:auth.status, targetHost:target.hostname, stateLength:state.length,
  hasRelay:/^[a-f0-9]{64}\.[a-f0-9]{32}$/.test(state),
  stateCookieMatches:cookie.startsWith('__Host-andro_oauth_state_'+relay+'='),
  secure:cookie.includes('Secure'), httpOnly:cookie.includes('HttpOnly')
}));
assert.equal(auth.status,302);
assert.equal(target.hostname,'github.com');
assert.match(state,/^[a-f0-9]{64}\.[a-f0-9]{32}$/);
assert(cookie.startsWith('__Host-andro_oauth_state_'+relay+'='));
assert(cookie.includes('Secure') && cookie.includes('HttpOnly'));

const publicPoll = await fetch(origin + '/api/auth/poll?relay=auto');
const editorPoll = await fetch(origin + '/api/auth/poll?relay=auto', {
  headers:{'X-ANDRO-Editor':'login-v5',Accept:'application/json'}
});
console.log('POLL_SAFETY', JSON.stringify({
  publicStatus:publicPoll.status, editorEmptyStatus:editorPoll.status
}));
assert.equal(publicPoll.status,403);
assert.equal(editorPoll.status,204);

const callback = await fetch(origin+'/api/auth/callback?state='+encodeURIComponent(state)+'&code=INVALID_TEST_CODE', {
  redirect:'manual',headers:{Cookie:cookie.split(';')[0]}
});
const callbackHtml = await callback.text();
console.log('CALLBACK',JSON.stringify({
  status:callback.status,
  v5:callbackHtml.includes('ANDRO GitHub login v5'),
  sameRelay:callbackHtml.includes('const relay = "'+relay+'"'),
  realError:callbackHtml.includes('github_code_rejected') ||
    callbackHtml.includes('github_token_error') ||
    callbackHtml.includes('github_token_request_failed')
}));
assert.equal(callback.status,200);
assert(callbackHtml.includes('ANDRO GitHub login v5'));
assert(callbackHtml.includes('const relay = "'+relay+'"'));

const browser = await chromium.launch({headless:true,channel:'chrome',args:['--no-sandbox']});
try {
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => {
    const opens=[];
    Object.defineProperty(window,'__loginOpens',{value:opens,configurable:true});
    const native = window.open.bind(window);
    window.open = (url,target,features)=>{
      const parsed = new URL(String(url),window.location.href);
      opens.push({path:parsed.pathname,hasRelay:parsed.searchParams.has('andro_relay'),
        relayLength:parsed.searchParams.get('andro_relay')?.length || 0,
        name:target});
      return native('about:blank',target,features);
    };
  });
  const page = await ctx.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message.slice(0,160)));
  await page.goto(origin+'/admin/?v=5',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(7000);
  const btn=page.getByRole('button',{name:/login with github/i}).first();
  assert(await btn.count(), 'Login button missing');
  await btn.click();
  await page.waitForTimeout(700);
  const details=await page.evaluate(()=>({
    helper:window.__androOAuthStatus?.version,
    installed:window.__androOAuthPopupInstalled===true,
    opens:window.__loginOpens
  }));
  console.log('CHROMIUM',JSON.stringify({version:details.helper,
    installed:details.installed,
    popupCount:details.opens.length,
    popupHasRelay:details.opens.some(o=>o.path==='/api/auth' && o.hasRelay && o.relayLength===32),
    errors}));
  assert.equal(details.helper,'5');
  assert.equal(details.installed,true);
  assert(details.opens.some(o=>o.path==='/api/auth' && o.hasRelay && o.relayLength===32));
} finally { await browser.close(); }
