// Test the live server redirect/callback using a synthetic state and invalid code.
// No user account, real GitHub authorization code, or secret is involved.
const origin='https://andro.co.nz';
const relay='a'.repeat(32);
const auth=await fetch(origin+'/api/auth?provider=github&andro_relay='+relay,{redirect:'manual'});
const destination=auth.headers.get('location');
const link=destination?new URL(destination):null;
const state=link?.searchParams.get('state')||'';
const setCookie=auth.headers.get('set-cookie')||'';
console.log('AUTH',JSON.stringify({
  status:auth.status, domain:link?.hostname, path:link?.pathname,
  stateLen:state.length,
  relayInState:state.endsWith('.'+relay),
  expectedCookie:setCookie.startsWith('__Host-andro_oauth_state_'+relay+'='),
  secure:setCookie.includes('Secure'),httpOnly:setCookie.includes('HttpOnly'),
  sameSiteLax:setCookie.includes('SameSite=Lax')
}));
if(auth.status!==302||!state.endsWith('.'+relay)||!setCookie.startsWith('__Host-andro_oauth_state_'+relay+'=')) throw new Error('Server failed to carry relay into OAuth state');
const cookie=setCookie.split(';')[0];
const callback=await fetch(origin+'/api/auth/callback?code=INVALID_DIAGNOSTIC_CODE&state='+encodeURIComponent(state),
{headers:{Cookie:cookie},redirect:'manual'});
const html=await callback.text();
console.log('CALLBACK',JSON.stringify({
 status:callback.status,
 carriedRelay:html.includes('const relay = "'+relay+'"'),
 detectedGithubError:html.includes('github_code_rejected')||html.includes('github_token_error'),
 csrfMismatch:html.includes('csrf_state_mismatch'),
 hasBridge:html.includes('function beginBridge()'),
 resultCookieSet:(callback.headers.get('set-cookie')||'').includes('andro_oauth_result'),
 bodyBytes:html.length
}));
if(!html.includes('const relay = "'+relay+'"')) throw new Error('Callback lost relay after round trip');
