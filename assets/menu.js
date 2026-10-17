/**
 * Site menu.
 *
 * A "More" tab that sits inline with the other nav links and opens a dropdown
 * panel listing every page. Not a floating button: this is a menu bar tab, so it
 * lives in the bar, aligns with its neighbours and inherits their type.
 *
 * One script rather than markup pasted into nine pages, so adding a page is a
 * one-line change here instead of nine edits that drift apart. If a page has no
 * nav bar (the 404, the admin dashboard) it appends its own bar so the menu is
 * still reachable.
 *
 * Icons are inline SVG, not emoji: emoji render differently on every platform
 * and read as placeholders next to real iconography.
 */
(function () {
  'use strict';

  // Every page, with an icon path drawn on a 24x24 grid.
  var PAGES = [
    {
      href: '/', label: 'Home', note: 'Start here',
      icon: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/>'
    },
    {
      href: '/projects.html', label: 'Projects', note: 'Everything I have built',
      icon: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7"/>'
    },
    {
      href: '/blog.html', label: 'Blog', note: 'Writing and news',
      icon: '<path d="M5 4h11l3 3v13H5z"/><path d="M8.5 10h7M8.5 13.5h7M8.5 17h4"/>'
    },
    {
      href: '/anime.html', label: 'Anime', note: 'What I am watching',
      icon: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M2.5 10h19M7 6v4M12 6v4M17 6v4"/>'
    },
    {
      href: '/games.html', label: 'Games', note: 'What I play',
      icon: '<path d="M7.5 9.5v5M5 12h5"/><circle cx="16" cy="11" r="1"/><circle cx="18.5" cy="13.5" r="1"/><path d="M6.5 6.5h11a4 4 0 0 1 3.9 4.9l-.8 4a3 3 0 0 1-5.2 1.4l-1-1.3h-4.8l-1 1.3a3 3 0 0 1-5.2-1.4l-.8-4a4 4 0 0 1 3.9-4.9Z"/>'
    },
    {
      href: '/uses.html', label: 'Uses', note: 'My setup and stack',
      icon: '<rect x="2.5" y="4.5" width="19" height="12" rx="2"/><path d="M8 20h8M12 16.5V20"/>'
    },
    {
      href: '/now.html', label: 'Now', note: 'What I am on this week',
      icon: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 1.8"/>'
    },
    {
      href: '/guestbook.html', label: 'Guestbook', note: 'Say something',
      icon: '<path d="M20 15.5a2 2 0 0 1-2 2H8l-4 3v-15a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/>'
    },
    {
      href: '/resume.html', label: 'Resume', note: 'The formal version',
      icon: '<path d="M6 3.5h8l4 4v13H6z"/><path d="M14 3.5v4h4"/><path d="M9 13h6M9 16.5h4"/>'
    },
    {
      href: '/bhr6ojytu5baa3tfox3o.html', label: 'Admin', note: 'Dashboard, private',
      icon: '<rect x="4" y="10.5" width="16" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>'
    }
  ];

  var ICON_MORE =
    '<circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/>';

  var here = (window.location.pathname || '/').replace(/\/index\.html$/, '/');

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function svg(paths, size) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('width', size || 15);
    s.setAttribute('height', size || 15);
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '1.7');
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = paths;
    return s;
  }

  function build() {
    // ---- the tab itself
    var tab = el('button', 'bxx-tab');
    tab.type = 'button';
    tab.setAttribute('aria-haspopup', 'true');
    tab.setAttribute('aria-expanded', 'false');
    tab.appendChild(svg(ICON_MORE, 16));
    tab.appendChild(el('span', '', 'More'));
    var caret = svg('<path d="m6 9 6 6 6-6"/>', 12);
    caret.classList.add('bxx-tab-caret');
    tab.appendChild(caret);

    // ---- the panel
    var panel = el('div', 'bxx-panel');
    panel.setAttribute('role', 'menu');
    panel.setAttribute('aria-hidden', 'true');

    var head = el('div', 'bxx-panel-head');
    head.appendChild(el('span', 'bxx-panel-title', 'All pages'));
    panel.appendChild(head);

    var list = el('div', 'bxx-panel-list');

    PAGES.forEach(function (p) {
      var a = el('a', 'bxx-item');
      a.href = p.href;
      a.setAttribute('role', 'menuitem');

      var isHere = here === p.href;
      if (isHere) a.classList.add('is-here');

      var ic = el('span', 'bxx-item-icon');
      ic.appendChild(svg(p.icon, 16));
      a.appendChild(ic);

      var text = el('span', 'bxx-item-text');
      text.appendChild(el('span', 'bxx-item-label', p.label));
      text.appendChild(el('span', 'bxx-item-note', isHere ? 'You are here' : p.note));
      a.appendChild(text);

      list.appendChild(a);
    });

    panel.appendChild(list);

    // ---- placement
    // Prefer the page's own nav so the tab sits inline with the existing links.
    // Falls back to building a bar on pages that have none.
    var host = null;
    var candidates = document.querySelectorAll(
      'nav .nav-links, nav div[class*="items-center"], .nav-links, header nav'
    );
    for (var i = 0; i < candidates.length; i++) {
      if (candidates[i].querySelector('a')) { host = candidates[i]; break; }
    }

    var wrap = el('div', 'bxx-menu-wrap');
    wrap.appendChild(tab);
    wrap.appendChild(panel);

    if (host) {
      host.appendChild(wrap);
      // The panel is absolutely positioned, so it needs a positioned ancestor.
      host.classList.add('bxx-host');
    } else {
      var bar = el('div', 'bxx-fallback-bar');
      var inner = el('div', 'bxx-fallback-inner');
      var brand = el('a', 'bxx-fallback-brand', 'brokenXoxo');
      brand.href = '/';
      inner.appendChild(brand);
      inner.appendChild(wrap);
      bar.appendChild(inner);
      document.body.appendChild(bar);
      document.body.classList.add('has-bxx-bar');
    }

    var scrim = el('div', 'bxx-scrim');
    document.body.appendChild(scrim);

    function open() {
      panel.classList.add('open');
      scrim.classList.add('open');
      panel.setAttribute('aria-hidden', 'false');
      tab.setAttribute('aria-expanded', 'true');
    }
    function shut() {
      panel.classList.remove('open');
      scrim.classList.remove('open');
      panel.setAttribute('aria-hidden', 'true');
      tab.setAttribute('aria-expanded', 'false');
    }

    tab.addEventListener('click', function (e) {
      e.stopPropagation();
      panel.classList.contains('open') ? shut() : open();
    });
    scrim.addEventListener('click', shut);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') shut();
    });
    // Clicking a link should close it before the navigation paints.
    list.addEventListener('click', shut);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
