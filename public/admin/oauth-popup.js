/* Decap GitHub OAuth with resilient, encrypted server receipt polling.
 * The normal popup handshake remains compatible with Decap CMS 3.8.3.
 * A successful server-side token exchange can also finish without a window
 * opener or BroadcastChannel. Tokens are never placed in URLs or storage. */
(function () {
  'use strict';
  if (window.__androOAuthPopupInstalled) return;
  window.__androOAuthPopupInstalled = true;

  var nativeOpen = window.open;
  var activePopup = null;
  var activeChannel = null;
  var activeExpiry = null;
  var activePollTimer = null;

  function makeId() {
    var bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, function (n) {
      return n.toString(16).padStart(2, '0');
    }).join('');
  }

  function dispose() {
    if (activeExpiry !== null) { clearTimeout(activeExpiry); activeExpiry = null; }
    if (activePollTimer !== null) { clearTimeout(activePollTimer); activePollTimer = null; }
    if (activeChannel) { activeChannel.close(); activeChannel = null; }
    if (activePopup) {
      try { activePopup.close(); } catch (_) {}
      activePopup = null;
    }
  }

  if (typeof window.addEventListener === 'function') {
    window.addEventListener('pagehide', dispose);
  }

  window.open = function (url, target, features) {
    var parsed;
    try { parsed = new URL(String(url), window.location.href); }
    catch (_) { return nativeOpen.apply(window, arguments); }

    if (target !== 'Netlify Authorization' ||
        parsed.origin !== window.location.origin ||
        !/^\/api\/auth\/?$/.test(parsed.pathname) ||
        parsed.searchParams.get('provider') !== 'github') {
      return nativeOpen.apply(window, arguments);
    }

    // A fresh ID binds this popup to its independently verified OAuth state.
    // The receipt is AES-GCM encrypted in an HttpOnly cookie and expires fast.
    var relay = makeId();
    parsed.searchParams.set('andro_relay', relay);
    var name = 'andro-github-login-' + makeId();
    var popup = nativeOpen.call(window, parsed.href, name, features);
    if (!popup) return popup;

    dispose();
    activePopup = popup;
    var waiting = true;
    var channel = null;

    function deliver(data) {
      window.dispatchEvent(new MessageEvent('message', {
        data: data, origin: window.location.origin, source: popup
      }));
    }

    function finish(message) {
      if (!waiting || activePopup !== popup) return;
      waiting = false;
      // Ensure Decap has installed its authorization result listener.
      // If already installed, the extra readiness event is harmless.
      deliver('authorizing:github');
      deliver(message);
      // Decap calls authWindow.close() synchronously on a parsed response.
      if (activePopup === popup) dispose();
    }

    if (typeof window.BroadcastChannel === 'function') {
      try {
        channel = new window.BroadcastChannel('andro-github-oauth-' + relay);
        activeChannel = channel;
        channel.onmessage = function (event) {
          if (!waiting || activeChannel !== channel || !event.data) return;
          if (event.data.kind === 'ready') {
            deliver('authorizing:github');
          } else if (event.data.kind === 'result' &&
                     typeof event.data.message === 'string' &&
                     /^authorization:github:(success|error):/.test(event.data.message)) {
            finish(event.data.message);
          }
        };
      } catch (_) { channel = null; activeChannel = null; }
    }

    // Crucial fallback: once the verified OAuth callback sets its encrypted
    // cookie, the editor can consume it without any popup-to-editor messages.
    // A missing result returns 204 and is never cached.
    function poll() {
      if (!waiting || activePopup !== popup) return;
      window.fetch('/api/auth/poll?relay=' + encodeURIComponent(relay), {
        method: 'GET', credentials: 'same-origin', cache: 'no-store',
        headers: { Accept: 'application/json' }
      }).then(function (response) {
        if (response.status !== 200) return null;
        return response.json();
      }).then(function (body) {
        if (!body || !waiting || activePopup !== popup) return;
        if (body.provider !== 'github' || typeof body.token !== 'string' ||
            !body.token || body.token.length > 1024) return;
        finish('authorization:github:success:' + JSON.stringify({
          token: body.token, provider: 'github'
        }));
      }).catch(function () {
        // A temporary network error must not cancel the login attempt.
      }).finally(function () {
        if (waiting && activePopup === popup) {
          activePollTimer = setTimeout(poll, 850);
        }
      });
    }
    if (typeof window.fetch === 'function') {
      activePollTimer = setTimeout(poll, 350);
    }

    activeExpiry = setTimeout(function () {
      if (activePopup === popup) dispose();
    }, 10 * 60 * 1000);

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
