/* Page-aware ANDRO preview. Uses the real site iframe and no extra React renderer. */
(function () {
  'use strict';
  var root, frame, heading, note, lastPage = '', pending = false;
  var pages = {
    home: { path: '/', label: 'Home' },
    construction: { path: '/construction/', label: 'Construction' },
    maintenance: { path: '/property-maintenance/', label: 'Asset maintenance' },
    projects: { path: '/projects/', label: 'Projects' },
    about: { path: '/about/', label: 'About' },
    contact: { path: '/contact/', label: 'Contact' }
  };
  var textKeys = {
    'main headline': 'title', 'hero description': 'subtitle',
    'introduction heading': 'introHeading', 'introduction text': 'introText',
    'services heading': 'servicesHeading', 'feature section heading': 'featureHeading',
    'bottom call-to-action heading': 'closingHeading', 'philosophy heading': 'philosophyHeading',
    'philosophy text': 'philosophyText', 'who we are heading': 'whoHeading',
    'who we are description': 'whoText'
  };
  function currentPage() {
    var match = window.location.hash.match(/^#\/?collections\/pages\/entries\/([^/?]+)/);
    return match && Object.prototype.hasOwnProperty.call(pages, match[1]) ? match[1] : '';
  }
  function redirectOldEditorLink() {
    var hash = window.location.hash;
    if (/^#\/?collections\/site_content(?:\/|$)/.test(hash)) window.location.hash = '#/collections/pages/entries/home';
    else if (/^#\/?collections\/construction_gallery(?:\/|$)/.test(hash)) window.location.hash = '#/collections/pages/entries/construction';
    else if (/^#\/?collections\/maintenance_services(?:\/|$)/.test(hash)) window.location.hash = '#/collections/pages/entries/maintenance';
  }
  function reloadPreview() {
    var page = currentPage();
    if (!frame || !page) return;
    var url = new URL(pages[page].path, window.location.origin);
    url.searchParams.set('androCmsPreview', '1');
    url.searchParams.set('editorRefresh', String(Date.now()));
    frame.src = url.href;
  }
  function mount() {
    pending = false;
    redirectOldEditorLink();
    var page = currentPage();
    if (!page) { if (root) root.hidden = true; lastPage = ''; return; }
    if (!root) {
      root = document.createElement('aside');
      root.id = 'andro-real-preview';
      root.setAttribute('aria-label', 'Preview of the page being edited');
      var bar = document.createElement('div');
      bar.className = 'andro-preview-bar';
      bar.style.flexWrap = 'wrap';
      heading = document.createElement('strong');
      note = document.createElement('span');
      note.textContent = 'Photo selections appear in the form. Publish, then refresh this preview.';
      var refresh = document.createElement('button');
      refresh.type = 'button';
      refresh.textContent = 'Refresh page preview';
      refresh.style.cssText = 'border:1px solid #b49b70;background:transparent;color:white;padding:8px 10px;border-radius:4px;cursor:pointer;font:inherit;min-height:36px';
      refresh.addEventListener('click', reloadPreview);
      bar.appendChild(heading); bar.appendChild(note); bar.appendChild(refresh);
      frame = document.createElement('iframe');
      frame.title = 'Actual ANDRO page';
      frame.setAttribute('loading', 'eager');
      frame.addEventListener('load', syncText);
      root.appendChild(bar); root.appendChild(frame);
      document.body.appendChild(root);
      document.addEventListener('input', syncText, true);
      document.addEventListener('change', syncText, true);
    }
    root.hidden = false;
    if (page !== lastPage) {
      lastPage = page;
      heading.textContent = pages[page].label.toUpperCase() + ' PREVIEW';
      frame.title = pages[page].label + ' page preview';
      reloadPreview();
    }
  }
  function queueMount() {
    if (!pending) { pending = true; requestAnimationFrame(mount); }
  }
  function fieldValue(name) {
    var nodes = document.querySelectorAll('label, [class*="FieldLabel"], [class*="fieldLabel"]');
    for (var i = 0; i < nodes.length; i++) {
      var label = nodes[i];
      if (root && root.contains(label)) continue;
      var text = (label.textContent || '').trim().toLowerCase().replace(/\s*\(optional\)\s*$/, '');
      if (text !== name) continue;
      if (label.htmlFor) {
        var labelled = document.getElementById(label.htmlFor);
        if (labelled && 'value' in labelled) return labelled.value;
      }
      var parent = label.parentElement;
      for (var depth = 0; depth < 4 && parent; depth++, parent = parent.parentElement) {
        var input = parent.querySelector('textarea, input[type="text"], input:not([type]), select');
        if (input) return input.value;
      }
    }
    return null;
  }
  function syncText() {
    var page = currentPage();
    if (!frame || !frame.contentWindow || !page) return;
    var fields = {};
    Object.keys(textKeys).forEach(function (name) {
      var value = fieldValue(name);
      if (value !== null) fields[page + '.' + textKeys[name]] = value;
    });
    frame.contentWindow.postMessage({ type: 'andro-cms-preview', fields: fields }, window.location.origin);
  }
  window.addEventListener('hashchange', queueMount);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', queueMount);
  else queueMount();
  new MutationObserver(function (mutations) {
    if (mutations.some(function (m) {
      return !(root && root.contains(m.target)) && Array.prototype.some.call(m.addedNodes, function (n) { return n !== root; });
    })) queueMount();
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
