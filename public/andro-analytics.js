(() => {
  const pages = {'/':'Home','/construction':'Construction','/projects':'Projects','/about':'About','/contact':'Contact','/win':'Win a Day'};
  const page = pages[location.pathname.replace(/\/$/,'') || '/'];
  if (!page || window.top !== window || new URLSearchParams(location.search).has('androCmsPreview')) return;
  const optedOut = () => navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1' || localStorage.getItem('andro_analytics_optout') === '1';
  let source = 'Direct / unknown', start = true, sent = false;
  function detectSource() {
    const q = new URLSearchParams(location.search);
    const utm = (q.get('utm_source') || '').toLowerCase();
    let ref = '';
    try { ref = new URL(document.referrer).hostname.toLowerCase(); } catch {}
    if (q.has('fbclid') || /^(facebook|instagram|fb|ig|meta)$/.test(utm) || /(^|\.)(facebook\.com|instagram\.com|fb\.com|messenger\.com)$/.test(ref)) return 'Facebook / Instagram';
    if (utm === 'google' || q.has('gclid') || /(^|\.)google\.[a-z.]+$/.test(ref)) return 'Google';
    if (utm) return 'Other campaign';
    if (ref && ref !== location.hostname && ref !== 'andro.co.nz' && ref !== 'www.andro.co.nz') return 'Other website';
    return 'Direct / unknown';
  }
  const ua = navigator.userAgent;
  const device = /iPad|Tablet/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) || (/Android/i.test(ua) && !/Mobile/i.test(ua)) ? 'Tablet' : /Mobile|iPhone|Android/i.test(ua) ? 'Mobile' : 'Desktop / other';
  function send(kind) {
    try {
      if (optedOut()) return;
      fetch('/api/analytics/event', {method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,page,source,device,start:kind==='view' && start})}).catch(()=>{});
    } catch {}
  }
  function begin() {
    if (sent || document.visibilityState !== 'visible') return;
    try {
      if (optedOut()) return;
      const now = Date.now();
      const previous = JSON.parse(localStorage.getItem('andro_analytics_visit') || 'null');
      const incoming = detectSource();
      start = !previous || !Number.isFinite(previous.last) || now-previous.last > 30*60*1000 || now < previous.last;
      source = start || incoming !== 'Direct / unknown' ? incoming : previous.source;
      localStorage.setItem('andro_analytics_visit',JSON.stringify({last:now,source}));
      sent = true;
      send('view');
    } catch { /* Respect disabled browser storage. */ }
  }
  begin();
  document.addEventListener('visibilitychange',begin);
  document.addEventListener('andro:win-entry-saved',() => { if(sent) send('entry'); });
})();
