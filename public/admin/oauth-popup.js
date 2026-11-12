/* Reliable, per-attempt Decap GitHub popup communication.
 * Keep the normal Decap protocol, but relay it across a same-origin channel
 * when GitHub's navigation clears window.opener (Safari/Chrome isolation).
 * Never store an OAuth token in browser storage. */
(function () {
  'use strict';
  if (window.__androOAuthPopupInstalled) return;
  window.__androOAuthPopupInstalled = true;
  var nativeOpen = window.open;
  var activePopup = null;
  var activeChannel = null;
  var activeExpiry = null;

  function makeId() {
    var bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, function (n) { return n.toString(16).padStart(2, '0'); }).join('');
  }

  function dispose() {
    if (activeExpiry) { clearTimeout(activeExpiry); activeExpiry = null; }
    if (activeChannel) { activeChannel.close(); activeChannel = null; }
    if (activePopup) {
      try { if (!activePopup.closed) activePopup.close(); } catch (_) {}
      activePopup = null;
    }
  }

  if (typeof window.addEventListener === 'function') window.addEventListener('pagehide', dispose);

  window.open = function (url, target, features) {
    var parsed;
    try { parsed = new URL(String(url), window.location.href); } catch (_) {
      return nativeOpen.apply(window, arguments);
    }
    if (target !== 'Netlify Authorization' ||
        parsed.origin !== window.location.origin ||
        !/^\/api\/auth\/?$/.test(parsed.pathname) ||
        parsed.searchParams.get('provider') !== 'github') {
      return nativeOpen.apply(window, arguments);
    }

    // Older browsers without BroadcastChannel still use the original Decap
    // popup protocol. No weaker cross-origin messaging fallback is introduced.
    var canRelay = typeof window.BroadcastChannel === 'function';
    var relay = canRelay ? makeId() : '';
    if (relay) parsed.searchParams.set('andro_relay', relay);

    var name = 'andro-github-login-' + makeId();
    var popup = nativeOpen.call(window, parsed.href, name, features);
    if (!popup) return popup;

    // Close a stale attempt so it cannot later overwrite the editor state.
    dispose();
    activePopup = popup;
    if (!relay) return popup;

    var channel;
    try { channel = new window.BroadcastChannel('andro-github-oauth-' + relay); }
    catch (_) { return popup; }
    activeChannel = channel;
    var waiting = true;

    function deliver(data) {
      window.dispatchEvent(new MessageEvent('message', {
        data: data,
        origin: window.location.origin,
        source: popup
      }));
    }

    channel.onmessage = function (event) {
      if (!waiting || activeChannel !== channel || !event.data) return;
      if (event.data.kind === 'ready') {
        // Decap will respond with authWindow.postMessage('authorizing:github').
        deliver('authorizing:github');
      } else if (event.data.kind === 'result' && typeof event.data.message === 'string' &&
                 /^authorization:github:(success|error):/.test(event.data.message)) {
        waiting = false;
        deliver(event.data.message);
        // Decap's authorizeCallback calls authWindow.close() after parsing.
        // If the error was malformed or the editor unloaded, clean up anyway.
        setTimeout(function () { if (activeChannel === channel) dispose(); }, 1000);
      }
    };

    activeExpiry = setTimeout(function () {
      if (activeChannel === channel) dispose();
    }, 10 * 60 * 1000);

    // Decap expects a WindowProxy supporting focus, close, closed and
    // postMessage. This adapter preserves the API and keeps the original
    // popup reference private to this login attempt.
    return {
      focus: function () { try { popup.focus(); } catch (_) {} },
      close: function () { if (activeChannel === channel) dispose(); },
      postMessage: function (data, targetOrigin) {
        if (data !== 'authorizing:github' || targetOrigin !== window.location.origin ||
            !waiting || activeChannel !== channel) return;
        channel.postMessage({ kind: 'ack' });
      },
      get closed() { return popup.closed; }
    };
  };
})();
