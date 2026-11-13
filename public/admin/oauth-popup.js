/* ANDRO GitHub editor login v6.
 * Receives a short-lived encrypted server receipt, even when a browser
 * disconnects window.opener or an old launcher omits its recovery ID.
 * OAuth access tokens are never stored in localStorage, cookies readable by
 * JavaScript, or URL query parameters. */
(function () {
  'use strict';
  if (window.__androOAuthPopupInstalled) return;
  window.__androOAuthPopupInstalled = true;

  var nativeOpen = window.open;
  var activePopup = null;
  var activeChannel = null;
  var activeExpiry = null;
  var activePollTimer = null;
  var fallbackTimer = null;
  var fallbackActive = false;

  var status = window.__androOAuthStatus = {
    version: '6', helperLoaded: true, lastLaunch: 'none',
    lastRecovery: 'none', lastHttpStatus: null, lastBlock: 'none',
    blockedCount: 0
  };

  function makeId() {
    var bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, function (n) {
      return n.toString(16).padStart(2, '0');
    }).join('');
  }

  var cookieName = '__Host-andro_oauth_editor_relay';
  function readEditorRelay() {
    try {
      var match = window.document && window.document.cookie.match(
        new RegExp('(?:^|;\\s*)' + cookieName + '=([a-f0-9]{32})(?:;|$)'));
      return match ? match[1] : '';
    } catch (_) { return ''; }
  }
  // A browser-scoped, non-secret fallback ID helps recover legacy logins that
  // still launch /api/auth without the modern per-attempt query parameter.
  var editorRelay = readEditorRelay() || makeId();
  try {
    if (window.document) {
      window.document.cookie = cookieName + '=' + editorRelay +
        '; Max-Age=600; Path=/; Secure; SameSite=Lax';
    }
  } catch (_) {}

  function clearTimers() {
    if (activeExpiry !== null) { clearTimeout(activeExpiry); activeExpiry = null; }
    if (activePollTimer !== null) { clearTimeout(activePollTimer); activePollTimer = null; }
    if (fallbackTimer !== null) { clearTimeout(fallbackTimer); fallbackTimer = null; }
  }

  function dispose() {
    clearTimers();
    fallbackActive = false;
    if (activeChannel) { activeChannel.close(); activeChannel = null; }
    if (activePopup) {
      try { activePopup.close(); } catch (_) {}
      activePopup = null;
    }
  }

  function deliver(data) {
    window.dispatchEvent(new MessageEvent('message', {
      data: data, origin: window.location.origin
    }));
  }

  function finishWithToken(token, popup) {
    if (typeof token !== 'string' || !token || token.length > 1024) return;
    status.lastRecovery = 'received';
    // Decap's handshake callback removes itself and adds an authorization
    // result listener. The second event reaches that listener synchronously.
    deliver('authorizing:github');
    deliver('authorization:github:success:' +
      JSON.stringify({ token: token, provider: 'github' }));
    if (popup && activePopup === popup) dispose();
    else { fallbackActive = false; clearTimers(); }
  }

  // Keep the exact OAuth receipt tied to the login's random relay.
  // When ANDRO itself rejects a poll it supplies an explicit safe reason.
  // A 403 without those headers originates outside this endpoint (for
  // example a Cloudflare firewall/challenge), not from a bad GitHub password.
  function consumeReceipt(relay) {
    return window.fetch('/api/auth/poll?relay=' + encodeURIComponent(relay), {
      method: 'GET', credentials: 'same-origin', cache: 'no-store',
      headers: { Accept: 'application/json', 'X-ANDRO-Editor': 'login-v6' }
    }).then(function (response) {
      status.lastHttpStatus = response.status;
      if (response.status === 403) {
        status.blockedCount += 1;
        status.lastBlock = response.headers.get('X-ANDRO-Poll-Block') ||
          (response.headers.get('X-ANDRO-Poll-Version') === '6' ?
            'site-other' : 'upstream-or-edge');
        if (status.blockedCount === 1 && window.console &&
            typeof window.console.warn === 'function') {
          window.console.warn('ANDRO login recovery blocked (403). Reason: ' +
            status.lastBlock + '. No login details have been logged.');
        }
        return null;
      }
      if (response.status === 409) {
        status.lastRecovery = 'multiple-pending';
        return null;
      }
      if (response.status !== 200) return null;
      status.lastBlock = 'none';
      return response.json();
    }).then(function (body) {
      if (body && body.provider === 'github' && typeof body.token === 'string' &&
          body.token.length > 0 && body.token.length <= 1024) return body.token;
      return null;
    });
  }

  // As an independent recovery path, listen for an explicit GitHub button
  // click even if Decap's own window.open invocation bypasses our wrapper.
  // The token is only delivered in the current editor after a user-initiated
  // login attempt, never on ordinary visits to /admin.
  function monitorLegacyClick() {
    if (fallbackActive || activePopup || typeof window.fetch !== 'function') return;
    fallbackActive = true;
    var started = Date.now(), attempts = 0;
    status.lastLaunch = 'legacy-click';
    function check() {
      if (!fallbackActive || activePopup) { fallbackActive = false; return; }
      var relay = ++attempts > 5 && attempts % 4 === 0 ? 'auto' : editorRelay;
      consumeReceipt(relay).then(function (token) {
        if (!fallbackActive || activePopup) return;
        if (token) { finishWithToken(token, null); return; }
      }).catch(function () {}).finally(function () {
        if (fallbackActive && !activePopup && Date.now() - started < 120000) {
          fallbackTimer = setTimeout(check, status.lastHttpStatus === 403 ? 8000 : 3500);
        } else { fallbackActive = false; }
      });
    }
    fallbackTimer = setTimeout(check, 1300);
  }

  if (window.document && window.document.addEventListener) {
    window.document.addEventListener('click', function (event) {
      var node = event.target && event.target.closest &&
        event.target.closest('button,[role="button"]');
      var label = node && (node.getAttribute('aria-label') || node.textContent || '');
      if (label && /login with github|log in with github|sign in with github/i.test(label)) {
        setTimeout(monitorLegacyClick, 150);
      }
    }, true);
  }

  if (typeof window.addEventListener === 'function') {
    window.addEventListener('pagehide', dispose);
  }

  window.open = function (url, target, features) {
    var parsed;
    try { parsed = new URL(String(url), window.location.href); }
    catch (_) { return nativeOpen.apply(window, arguments); }

    // Match the actual OAuth endpoint regardless of Decap's popup name.
    // Earlier versions required exactly "Netlify Authorization", which
    // could leave valid GitHub logins with no recovery ID.
    if (parsed.origin !== window.location.origin ||
        !/^\/api\/auth\/?$/.test(parsed.pathname) ||
        parsed.searchParams.get('provider') !== 'github') {
      return nativeOpen.apply(window, arguments);
    }

    var relay = makeId();
    parsed.searchParams.set('andro_relay', relay);
    var name = 'andro-github-login-' + makeId();
    var popup = nativeOpen.call(window, parsed.href, name, features);
    if (!popup) return popup;

    dispose();
    activePopup = popup;
    status.lastLaunch = 'recovery-enabled';
    status.lastRecovery = 'pending';
    status.lastHttpStatus = null;
    status.lastBlock = 'none';
    status.blockedCount = 0;

    var waiting = true, channel = null;
    var pollingStartedAt = Date.now();
    function finish(message) {
      if (!waiting || activePopup !== popup) return;
      waiting = false;
      deliver('authorizing:github');
      deliver(message);
      if (activePopup === popup) dispose();
    }

    if (typeof window.BroadcastChannel === 'function') {
      try {
        channel = new window.BroadcastChannel('andro-github-oauth-' + relay);
        activeChannel = channel;
        channel.onmessage = function (event) {
          if (!waiting || activeChannel !== channel || !event.data) return;
          if (event.data.kind === 'ready') deliver('authorizing:github');
          else if (event.data.kind === 'result' &&
                   typeof event.data.message === 'string' &&
                   /^authorization:github:(success|error):/.test(event.data.message)) {
            finish(event.data.message);
          }
        };
      } catch (_) { channel = null; activeChannel = null; }
    }

    function poll() {
      if (!waiting || activePopup !== popup) return;
      // The modern editor always has its exact per-attempt relay. Polling
      // "auto" as well doubles traffic and can trigger edge rate limiting.
      consumeReceipt(relay).then(function (token) {
        if (!token || !waiting || activePopup !== popup) return;
        status.lastRecovery = 'exact';
        finish('authorization:github:success:' +
          JSON.stringify({ token: token, provider: 'github' }));
      }).catch(function () {
        status.lastRecovery = 'network-retrying';
      }).finally(function () {
        if (!waiting || activePopup !== popup) return;
        if (Date.now() - pollingStartedAt > 120000) {
          status.lastRecovery = 'receipt-expired';
          dispose();
          return;
        }
        // An unsuccessful poll is not a reason to hammer Cloudflare.
        // Slow down after a real 403, rather than repeatedly causing it.
        var delay = status.lastHttpStatus === 403 ?
          Math.min(20000, 5000 + status.blockedCount * 2500) : 3500;
        activePollTimer = setTimeout(poll, delay);
      });
    }
    if (typeof window.fetch === 'function') {
      activePollTimer = setTimeout(poll, 1200);
    }

    activeExpiry = setTimeout(function () {
      if (activePopup === popup) {
        status.lastRecovery = 'expired';
        dispose();
      }
    }, 130 * 1000);

    return {
      focus: function () { try { popup.focus(); } catch (_) {} },
      close: function () { if (activePopup === popup) dispose(); },
      postMessage: function (data, targetOrigin) {
        if (data !== 'authorizing:github' ||
            targetOrigin !== window.location.origin ||
            !waiting || activePopup !== popup) return;
        if (channel && activeChannel === channel) {
          channel.postMessage({ kind: 'ack' });
        }
      },
      get closed() { return popup.closed; }
    };
  };
})();
