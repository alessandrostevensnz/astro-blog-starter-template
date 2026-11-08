/* Isolate Decap's GitHub login windows. No token handling or storage here. */
(function () {
  'use strict';
  if (window.__androOAuthPopupInstalled) return;
  window.__androOAuthPopupInstalled = true;
  var nativeOpen = window.open;
  var activePopup = null;

  window.open = function (url, target, features) {
    var isEditorLogin = false;
    try {
      var parsed = new URL(String(url), window.location.href);
      isEditorLogin = target === 'Netlify Authorization' &&
        parsed.origin === window.location.origin &&
        /^\/api\/auth\/?$/.test(parsed.pathname) &&
        parsed.searchParams.get('provider') === 'github';
    } catch (_) {}
    if (!isEditorLogin) return nativeOpen.apply(window, arguments);

    // A different window per attempt prevents other editor tabs or an old
    // named popup from being reused. Keep native window.open's return value
    // so Decap can validate the handshake and close the popup itself.
    var bytes = new Uint32Array(4);
    window.crypto.getRandomValues(bytes);
    var name = 'andro-github-login-' + Array.from(bytes, function (n) {
      return n.toString(16).padStart(8, '0');
    }).join('');
    var popup = nativeOpen.call(window, url, name, features);
    if (popup) {
      try { if (activePopup && !activePopup.closed) activePopup.close(); } catch (_) {}
      activePopup = popup;
    }
    return popup;
  };
})();
