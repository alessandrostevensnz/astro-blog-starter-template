import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { popupResponse, validState, newState, stateCookie, cookieValue, SITE_ORIGIN, oauthState, stateRelay, stateCookieName, expiredStateCookie, validRelay } from '../src/lib/decap-oauth.ts';

// Dummy token only. No GitHub requests, personal data, or saved browser storage.
const TOKEN = 'TEST_TOKEN_NOT_A_CREDENTIAL';
const HELLO = 'authorizing:github';
async function harness(token = TOKEN, reason, options = {}) {
  const response = popupResponse(token, reason);
  const html = await response.text();
  const script = html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)[1];
  const messages = [], listeners = new Map(), timers = new Map();
  const elements = { 'login-status': { textContent: '' }, 'login-help': { hidden: true } };
  let clock = 0, id = 0, selfCloseCalls = 0, replacedUrl = null;
  const opener = options.missing ? null : {
    closed: options.closed || false,
    postMessage(data, targetOrigin) { messages.push({ data, targetOrigin, time: clock }); }
  };
  const timer = (fn, delay, repeat) => { timers.set(++id,{fn, at:clock+delay,repeat}); return id; };
  const window = {
    opener,
    close() { selfCloseCalls++; },
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type,new Set()); listeners.get(type).add(fn); },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
  };
  vm.runInNewContext(script, {
    window, document: {getElementById: id => elements[id]},
    history: {replaceState(_,__,url) {replacedUrl=url;}},
    location: { pathname:'/api/auth/callback' },
    setInterval: (fn,ms)=>timer(fn,ms,ms), setTimeout:(fn,ms)=>timer(fn,ms,0),
    clearInterval: id=>timers.delete(id), clearTimeout:id=>timers.delete(id),
  });
  function emit(event, type='message') {
    for (const listener of [...(listeners.get(type)||[])]) listener(event);
  }
  function advance(ms) {
    const until=clock+ms;
    for (;;) {
      const next=[...timers].filter(([,v])=>v.at<=until).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];
      if (!next) break;
      const [id,t]=next; clock=t.at;
      if(t.repeat) t.at+=t.repeat; else timers.delete(id);
      t.fn();
    }
    clock=until;
  }
  return { response, html, messages, timers, elements, opener, emit, advance,
    ack:()=>emit({data:HELLO,origin:SITE_ORIGIN,source:opener}),
    selfCloseCalls:()=>selfCloseCalls, replacedUrl:()=>replacedUrl };
}

test('CSRF state validation remains exact and requires the state cookie',()=>{
  const state=newState(); assert.match(state,/^[a-f0-9]{64}$/);
  assert(validState(state,state)); assert(!validState(state,'a'.repeat(64)));
  assert(!validState(null,state)); assert(!validState(state,null));
  assert(!validState('short','short'));
  assert.match(stateCookie(state),/Secure; HttpOnly; SameSite=Lax/);
  assert.equal(cookieValue(new Request('https://andro.co.nz',{headers:{Cookie:'a=b; __Host-andro_oauth_state='+state}}),'__Host-andro_oauth_state'),state);
});

test('sends readiness, never a token before a matching handshake',async()=>{
  const h=await harness(); assert.deepEqual(h.messages.map(m=>m.data),[HELLO]);
  assert.equal(h.messages[0].targetOrigin,SITE_ORIGIN);
  assert.equal(h.replacedUrl(),'/api/auth/callback');
  assert(!h.elements['login-status'].textContent.includes(TOKEN));
});

test('recovers after the first readiness message is dropped',async()=>{
  const h=await harness(); // Deliberately discard the first outbound HELLO.
  h.advance(1100); assert.equal(h.messages.length,3);
  h.ack();
  const reply=h.messages.at(-1);
  assert.equal(reply.targetOrigin,SITE_ORIGIN);
  assert.equal(JSON.parse(reply.data.split('authorization:github:success:')[1]).token,TOKEN);
  assert.equal(h.timers.size,0);
});

test('recovers from a listener becoming ready later than the previous eight-second timeout',async()=>{
  const h=await harness(); h.advance(10000); h.ack();
  assert(h.messages.at(-1).data.startsWith('authorization:github:success:'));
  assert(!h.elements['login-status'].textContent.includes('did not acknowledge'));
});

test('rejects wrong origin, wrong source, non-string and wrong-provider replies',async()=>{
  const h=await harness();
  for(const e of [
    {origin:'https://untrusted.invalid',source:h.opener,data:HELLO},
    {origin:SITE_ORIGIN,source:{},data:HELLO},
    {origin:SITE_ORIGIN,source:h.opener,data:{message:HELLO}},
    {origin:SITE_ORIGIN,source:h.opener,data:'authorizing:gitlab'},
  ]) h.emit(e);
  assert.deepEqual(h.messages.map(m=>m.data),[HELLO]);
  h.ack(); assert.equal(h.messages.length,2);
});

test('delivers exactly once and leaves closing to Decap',async()=>{
  const h=await harness(); h.ack(); h.ack(); h.advance(60000);
  assert.equal(h.messages.filter(m=>m.data.startsWith('authorization:')).length,1);
  assert.equal(h.selfCloseCalls(),0);
  assert.match(h.elements['login-status'].textContent,/Login response sent/);
});

test('times out with no token release and ignores a late acknowledgment',async()=>{
  const h=await harness(); h.advance(30000); h.ack(); h.advance(60000);
  assert.equal(h.timers.size,0);
  assert(h.messages.every(m=>m.data===HELLO));
  assert.match(h.elements['login-status'].textContent,/30 seconds/);
  assert.equal(h.elements['login-help'].hidden,false);
});

test('missing or closed opener fails closed without timers',async()=>{
  for(const options of [{missing:true},{closed:true}]) {
    const h=await harness(TOKEN,undefined,options);
    assert.equal(h.messages.length,0); assert.equal(h.timers.size,0);
    assert.equal(h.elements['login-help'].hidden,false);
  }
});

test('pagehide discards response and stops all retries',async()=>{
  const h=await harness(); h.emit({},'pagehide'); h.advance(60000); h.ack();
  assert.equal(h.messages.length,1); assert.equal(h.timers.size,0);
});

test('GitHub errors use JSON accepted by Decap, with sanitized reason',async()=>{
  for(const reason of ['csrf_state_mismatch','<unsafe>']) {
    const h=await harness('',reason); h.ack();
    const prefix='authorization:github:error:';
    assert(h.messages.at(-1).data.startsWith(prefix));
    const error=JSON.parse(h.messages.at(-1).data.slice(prefix.length));
    assert.match(error.message,/GitHub login failed/);
    assert(!error.message.includes('<unsafe>'));
    assert(!h.html.includes('error:Authentication failed'));
  }
});

test('script serialization and nonce CSP prevent injected HTML execution',async()=>{
  const hostile='</script><script>globalThis.bad=1</script>\u2028\u2029';
  const h=await harness(hostile); h.ack();
  assert.equal((h.html.match(/<script /g)||[]).length,1);
  assert(!h.html.includes(hostile));
  const nonce=h.html.match(/<script nonce="([a-f0-9]+)">/)[1];
  assert(h.response.headers.get('Content-Security-Policy').includes("'nonce-"+nonce+"'"));
  assert(!h.response.headers.get('Content-Security-Policy').includes('unsafe-inline'));
  assert.equal(h.response.headers.get('Cache-Control'),'no-store');
  assert.equal(JSON.parse(h.messages.at(-1).data.slice('authorization:github:success:'.length)).token,hostile);
});

test('popup launcher isolates attempts and passes unrelated windows through unchanged',()=>{
  const calls=[];
  const window={location:{href:SITE_ORIGIN+'/admin/',origin:SITE_ORIGIN},crypto,
    open(...args){ const p={closed:false,close(){this.closed=true;}}; calls.push({args,p}); return p; }
  };
  const source=readFileSync(new URL('../public/admin/oauth-popup.js',import.meta.url),'utf8');
  const ctx=vm.createContext({window,URL,Uint32Array,Array}); vm.runInContext(source,ctx);
  const url=SITE_ORIGIN+'/api/auth?provider=github';
  const first=window.open(url,'Netlify Authorization','width=960');
  const second=window.open(url,'Netlify Authorization','width=960');
  assert.notEqual(calls[0].args[1],calls[1].args[1]);
  assert.match(calls[0].args[1],/^andro-github-login-[a-f0-9]{32}$/);
  assert.equal(calls[0].args[0],url); assert.equal(calls[0].args[2],'width=960');
  assert(first.closed); assert(!second.closed);
  for(const [url,target] of [
    [SITE_ORIGIN+'/report','Netlify Authorization'],
    ['https://other.invalid/api/auth?provider=github','Netlify Authorization'],
    [SITE_ORIGIN+'/api/auth?provider=gitlab','Netlify Authorization'],
    [SITE_ORIGIN+'/api/auth?provider=github','anything-else'],
  ]) { window.open(url,target,'height=600'); assert.deepEqual(calls.at(-1).args,[url,target,'height=600']); }
  const wrapper=window.open; vm.runInContext(source,ctx); assert.equal(window.open,wrapper,'No duplicate installation');
});

test('relay uses a nonce-bound per-login state cookie and rejects invalid IDs',()=>{
  const r1='a'.repeat(32), r2='b'.repeat(32);
  assert(validRelay(r1)); assert(!validRelay('../evil')); assert(!validRelay(''));
  const s1=oauthState(r1), s2=oauthState(r2);
  assert.equal(stateRelay(s1),r1);
  assert.equal(stateRelay(s2),r2);
  assert(validState(s1,s1)); assert(!validState(s1,s2));
  assert.equal(stateRelay(s1.slice(0,-1)+'!'),null);
  assert.equal(stateRelay(oauthState()),null);
  assert.notEqual(stateCookieName(r1),stateCookieName(r2));
  assert.match(stateCookie(s1,r1),/HttpOnly; SameSite=Lax/);
  assert(expiredStateCookie(r1).includes(stateCookieName(r1)+'=;'));
});

test('opener-free callback uses a same-origin nonce channel, never broadcasts on a wrong channel',async()=>{
  const relay='c'.repeat(32), SENTINEL='TOKEN_TEST_ONLY';
  const response=popupResponse(SENTINEL,'unknown_failure',relay);
  const html=await response.text();
  const script=html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)[1];
  const emissions=[],timeouts=new Map(),intervals=new Map();
  let seq=0;
  class BroadcastChannel {
    constructor(name){ this.name=name; }
    postMessage(data){emissions.push({name:this.name,data});}
    close(){}
  }
  const win={
    opener:null,
    BroadcastChannel,
    addEventListener(){},
    removeEventListener(){},
    close(){},
  };
  vm.runInNewContext(script,{
    window:win,document:{getElementById:id=>({textContent:'',hidden:false})},
    history:{replaceState(){}},location:{pathname:'/api/auth/callback'},
    setInterval:(fn,ms)=>{intervals.set(++seq,fn);return seq;},
    setTimeout:(fn,ms)=>{timeouts.set(++seq,fn);return seq;},
    clearInterval:id=>intervals.delete(id),clearTimeout:id=>timeouts.delete(id)
  });
  assert.equal(emissions.length,1);
  assert.equal(emissions[0].name,'andro-github-oauth-'+relay);
  assert.equal(emissions[0].data.kind,'ready');
  win.BroadcastChannel.prototype.onmessage; // Channel instance owns the handler.
  assert(!JSON.stringify(emissions).includes(SENTINEL));
});

test('popup launcher relays Decap handshake through a nonce-scoped channel',()=>{
  const messages=[],channels=[],popups=[];
  class BC {
    constructor(name){this.name=name;this.closed=false;channels.push(this);}
    postMessage(data){ messages.push({name:this.name,data}); }
    close(){ this.closed=true; }
  }
  const window={
    location:{href:SITE_ORIGIN+'/admin/',origin:SITE_ORIGIN},
    crypto, BroadcastChannel:BC,
    addEventListener(){},
    dispatchEvent(e){messages.push({kind:'editor-event',data:e.data,origin:e.origin});},
    open(url,name,features) {
      const popup={closed:false,focus(){},close(){this.closed=true;}};
      popups.push({url,name,features,popup});return popup;
    }
  };
  const src=readFileSync(new URL('../public/admin/oauth-popup.js',import.meta.url),'utf8');
  vm.runInNewContext(src,{window,URL,Uint8Array,Array,MessageEvent:class {
    constructor(type,init){Object.assign(this,init);}
  },setTimeout:()=>1,clearTimeout:()=>{}});
  const handle=window.open(SITE_ORIGIN+'/api/auth?provider=github','Netlify Authorization','width=960');
  const url=new URL(popups[0].url);
  assert.match(url.searchParams.get('andro_relay'),/^[a-f0-9]{32}$/);
  assert.equal(channels[0].name,'andro-github-oauth-'+url.searchParams.get('andro_relay'));
  channels[0].onmessage({data:{kind:'ready'}});
  assert.equal(messages.at(-1).data,'authorizing:github');
  handle.postMessage('authorizing:github',SITE_ORIGIN);
  assert.equal(messages.at(-1).data.kind,'ack');
  channels[0].onmessage({data:{kind:'result',message:'authorization:github:success:'+JSON.stringify({token:'FAKE'})}});
  assert.equal(messages.at(-1).data.startsWith('authorization:github:success:'),true);
  handle.close();
  assert.equal(popups[0].popup.closed,true);
  assert.equal(channels[0].closed,true);
});
