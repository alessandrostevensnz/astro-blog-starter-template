/* ANDRO Decap live editor preview. Uses Decap's bundled React. */
(function () {
  function register() {
    if (!window.CMS || !window.React) return false;
    var h = window.React.createElement;
    function val(entry, path, fallback) {
      var value = entry.getIn(['data'].concat(path.split('.')));
      return value == null || value === '' ? (fallback || '') : value;
    }
    function img(entry, getAsset, path, fallback) {
      var raw = val(entry, path, fallback);
      if (!raw) return '';
      try {
        var asset = getAsset(raw);
        return asset && asset.toString() ? asset.toString() : raw;
      } catch (_) { return raw; }
    }
    function section(label, heading, body, headingStyle, bodyStyle) {
      return h('section', { className: 'andro-section', key: label },
        h('div', { className: 'andro-kicker' }, label),
        h('div', { className: 'andro-columns' },
          h('h2', { style: headingStyle }, heading),
          h('p', { style: bodyStyle }, body)));
    }
    function photo(src, alt, cls) {
      return src ? h('img', { className: cls || '', src: src, alt: alt || '' }) : null;
    }
    function card(title, description, src) {
      return h('article', { className: 'andro-card' },
        photo(src, title, 'andro-card-image'),
        h('div', { className: 'andro-card-text' }, h('h3', null, title), h('p', null, description)));
    }
    function SitePreview(props) {
      var e = props.entry, a = props.getAsset, collection = props.collection;
      var filename = props.entry.get('slug') || '';
      var data = e.get('data');
      function v(path, fallback) { return val(e, path, fallback); }
      function image(path, fallback) { return img(e, a, path, fallback); }
      var home = v('home.title');
      var isSite = !!home || !!data.get('home');
      function styleFor(key, kind) {
        var g = v('typography.global') || {};
        var o = v('typography.overrides.' + key.replace('.', '__')) || {};
        if (g.toJS) g = g.toJS();
        if (o.toJS) o = o.toJS();
        var globalSize = Number(kind === 'heading' ? g.headingSize : g.bodySize) || 100;
        var overrideSize = Number(o.size) || 100;
        var color = o.color || (kind === 'heading' ? g.headingColor : g.bodyColor);
        var style = {};
        var scale = globalSize * overrideSize / 10000;
        if (scale !== 1) style.zoom = scale;
        if (color && /^#[0-9a-fA-F]{6}$/.test(color)) style.color = color;
        return style;
      }
      var body = [];
      if (isSite) {
        body.push(h('div', { className: 'andro-hero', key: 'hero' },
          photo(image('images.hero.src', '/images/andro%20caps%20copy.png'), v('images.hero.alt'), 'andro-hero-image'),
          h('div', { className: 'andro-hero-overlay' }),
          h('div', { className: 'andro-hero-copy' },
            h('div', { className: 'andro-hero-kicker' }, 'AUCKLAND · NEW ZEALAND · EST. 2020'),
            h('h1', { style: styleFor('home.title', 'heading') }, v('home.title')),
            h('p', { style: styleFor('home.subtitle', 'body') }, v('home.subtitle')))));
        body.push(section('ANDRO CONSTRUCTION + PROJECTS', v('home.introHeading'), v('home.introText'), styleFor('home.introHeading', 'heading'), styleFor('home.introText', 'body')));
        body.push(h('section', { className: 'andro-services', key: 'services' },
          h('div', { className: 'andro-kicker' }, 'WHAT WE DO'),
          h('h2', { style: styleFor('home.servicesHeading', 'heading') }, v('home.servicesHeading')),
          h('div', { className: 'andro-cards' },
            card(v('home.constructionCardTitle'), v('home.constructionCardDescription'), image('images.construction.src')),
            card(v('home.maintenanceCardTitle'), v('home.maintenanceCardDescription'), image('images.maintenance.src')))));
        body.push(h('section', { className: 'andro-image-band', key: 'feature' },
          photo(image('images.detail.src'), '', 'andro-band-image'),
          h('h2', { style: styleFor('home.featureHeading', 'heading') }, v('home.featureHeading'))));
        body.push(section('CRAFTSMANSHIP · QUALITY · SERVICE', v('home.philosophyHeading'), v('home.philosophyText'), styleFor('home.philosophyHeading', 'heading'), styleFor('home.philosophyText', 'body')));
        body.push(h('section', { className: 'andro-cta', key: 'cta' }, h('h2', { style: styleFor('home.closingHeading', 'heading') }, v('home.closingHeading'))));
        body.push(section('CONSTRUCTION + RENOVATIONS', v('construction.introHeading'), v('construction.introText'), styleFor('construction.introHeading', 'heading'), styleFor('construction.introText', 'body')));
        body.push(section('PROPERTY + ASSET MAINTENANCE', v('maintenance.introHeading'), v('maintenance.introText'), styleFor('maintenance.introHeading', 'heading'), styleFor('maintenance.introText', 'body')));
        body.push(section('ABOUT ANDRO', v('about.whoHeading'), v('about.whoText'), styleFor('about.whoHeading', 'heading'), styleFor('about.whoText', 'body')));
      } else {
        var entries = data.get('projects') || data.get('services');
        var rows = entries && entries.toJS ? entries.toJS() : [];
        body.push(h('section', { className: 'andro-services', key: 'entries' },
          h('div', { className: 'andro-kicker' }, 'ANDRO CONSTRUCTION + PROJECTS'),
          h('h2', null, data.get('projects') ? 'Construction project gallery' : 'Property maintenance services'),
          h('div', { className: 'andro-cards' }, rows.map(function (item, i) {
            var src = item.image ? img(e, a, (data.get('projects') ? 'projects.' : 'services.') + i + '.image', item.image) : '';
            // getAsset can also resolve a plain uploaded path.
            if (item.image) { try { src = a(item.image).toString(); } catch (_) { src = item.image; } }
            return h('article', { className: 'andro-card', key: i },
              photo(src, item.alt || item.imageAlt || item.title, 'andro-card-image'),
              h('div', { className: 'andro-card-text' }, h('div', { className: 'andro-kicker' }, item.category || item.number || ''),
                h('h3', null, item.title || ''), h('p', null, item.description || '')));
          }))));
      }
      return h('div', { className: 'andro-preview' },
        h('header', { className: 'andro-header' },
          h('div', { className: 'andro-logo' }, 'ANDRO', h('small', null, 'CONSTRUCTION + PROJECTS · EST. 2020')),
          h('nav', null, 'Construction　 Property maintenance　 Projects　 About　 Contact')),
        h('main', null, body),
        h('footer', { className: 'andro-footer' }, 'ANDRO CONSTRUCTION LIMITED　 ·　 EST. 2020'));
    }
    window.CMS.registerPreviewStyle('/admin/preview.css');
    window.CMS.registerPreviewTemplate('site_content', SitePreview);
    window.CMS.registerPreviewTemplate('construction_gallery', SitePreview);
    window.CMS.registerPreviewTemplate('maintenance_services', SitePreview);
    return true;
  }
  if (!register()) window.addEventListener('load', register, { once: true });
})();
