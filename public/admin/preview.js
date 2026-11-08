/* ANDRO preview: display the real Astro site, not a second React renderer. */
(function () {
  'use strict';
  var root, frame, lastPath = '';
  var labels = {
    'main headline':'home.title', 'hero description':'home.subtitle',
    'intro heading':'home.introHeading', 'intro text':'home.introText',
    'services heading':'home.servicesHeading',
    'feature section heading':'home.featureHeading',
    'bottom call-to-action heading':'home.closingHeading',
    'philosophy heading':'home.philosophyHeading', 'philosophy text':'home.philosophyText'
  };
  function page() {
    var hash = window.location.hash || '';
    if (/collections\/site_content\/entries\/site/.test(hash)) return '/';
    if (/collections\/construction_gallery/.test(hash)) return '/construction/';
    if (/collections\/maintenance_services/.test(hash)) return '/property-maintenance/';
    return '';
  }
  function mount() {
    var path = page();
    if (!path) { if (root) root.hidden = true; return; }
    if (!root) {
      root = document.createElement('aside');
      root.id = 'andro-real-preview';
      root.setAttribute('aria-label', 'ANDRO actual website preview');
      root.innerHTML = '<div class="andro-preview-bar"><strong>ANDRO WEBSITE PREVIEW</strong><span>Unsaved edits shown where supported</span></div>';
      frame = document.createElement('iframe');
      frame.title = 'Actual ANDRO Astro website';
      frame.setAttribute('loading', 'eager');
      frame.addEventListener('load', sync);
      root.appendChild(frame);
      document.body.appendChild(root);
      document.addEventListener('input', sync, true);
      document.addEventListener('change', sync, true);
    }
    root.hidden = false;
    if (path !== lastPath) {
      lastPath = path;
      frame.src = path + (path.indexOf('?') < 0 ? '?' : '&') + 'androCmsPreview=1';
    }
  }
  function fieldValue(name) {
    var nodes = document.querySelectorAll('label, [class*="FieldLabel"], [class*="fieldLabel"]');
    for (var i = 0; i < nodes.length; i++) {
      var label = nodes[i];
      if (label.closest('#andro-real-preview')) continue;
      var t = (label.textContent || '').trim().toLowerCase().replace(/\s*\(optional\)\s*$/, '');
      if (t !== name) continue;
      var parent = label.parentElement;
      for (var depth = 0; depth < 4 && parent; depth++, parent = parent.parentElement) {
        var input = parent.querySelector('textarea, input[type="text"], input:not([type]), select');
        if (input) return input.value;
      }
    }
    return null;
  }
  function sync() {
    if (!frame || !frame.contentWindow || !page()) return;
    var fields = {};
    Object.keys(labels).forEach(function (name) {
      var value = fieldValue(name);
      if (value !== null) fields[labels[name]] = value;
    });
    frame.contentWindow.postMessage({ type: 'andro-cms-preview', fields: fields }, window.location.origin);
  }
  window.addEventListener('hashchange', mount);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
  // Decap mounts the editor asynchronously; watch only for its editor fields.
  new MutationObserver(function (mutations) {
    if (mutations.some(function (m) { return Array.prototype.some.call(m.addedNodes, function (n) { return n !== root && !(root && root.contains(n)); }); })) mount();
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
