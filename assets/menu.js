/**
 * Site menu.
 *
 * A single three-dot button that opens a sheet listing every page, including
 * the ones that do not fit in the top nav. Injected from one file rather than
 * pasted into nine pages, so adding a page is a one-line change here instead of
 * nine edits that will drift apart.
 *
 * Works without a build step and without a framework: it appends its own DOM on
 * load and closes on outside click, Escape, or navigation.
 */
(function () {
  'use strict';

  var PAGES = [
    { href: '/', label: 'Home', note: 'Start here' },
    { href: '/projects.html', label: 'Projects', note: 'Everything I have built' },
    { href: '/blog.html', label: 'Blog', note: 'Writing and news' },
    { href: '/anime.html', label: 'Anime', note: 'What I am watching' },
    { href: '/games.html', label: 'Games', note: 'What I play' },
    { href: '/uses.html', label: 'Uses', note: 'My setup and stack' },
    { href: '/now.html', label: 'Now', note: 'What I am on this week' },
    { href: '/guestbook.html', label: 'Guestbook', note: 'Say something' },
    { href: '/resume.html', label: 'Resume', note: 'The formal version' },
    { href: '/bhr6ojytu5baa3tfox3o.html', label: 'Admin', note: 'Dashboard, private' }
  ];

  // Pages are served from the site root on GitHub Pages, so a leading slash
  // resolves correctly from every page without per-page path juggling.
  var here = window.location.pathname.replace(/\/index\.html$/, '/') || '/';

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function build() {
    // ---- trigger
    var btn = el('button', 'bxx-menu-btn');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'All pages');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
      '<circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>';

    // ---- sheet
    var sheet = el('div', 'bxx-menu-sheet');
    sheet.setAttribute('role', 'menu');
    sheet.setAttribute('aria-hidden', 'true');

    var head = el('div', 'bxx-menu-head');
    head.appendChild(el('span', 'bxx-menu-title', 'All pages'));
    var close = el('button', 'bxx-menu-close', '\u00d7');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close menu');
    head.appendChild(close);
    sheet.appendChild(head);

    var list = el('div', 'bxx-menu-list');
    PAGES.forEach(function (p) {
      var a = el('a', 'bxx-menu-item');
      a.href = p.href;
      a.setAttribute('role', 'menuitem');

      var isHere = here === p.href || (p.href === '/' && here === '/');
      if (isHere) a.classList.add('is-here');

      var t = el('span', 'bxx-menu-label', p.label);
      a.appendChild(t);
      if (isHere) a.appendChild(el('span', 'bxx-menu-here', 'you are here'));
      a.appendChild(el('span', 'bxx-menu-note', p.note));
      list.appendChild(a);
    });
    sheet.appendChild(list);

    var foot = el('div', 'bxx-menu-foot');
    var gh = el('a', 'bxx-menu-gh', 'GitHub \u2197');
    gh.href = 'https://github.com/Neaterry6';
    gh.target = '_blank';
    gh.rel = 'noopener';
    foot.appendChild(gh);
    sheet.appendChild(foot);

    var scrim = el('div', 'bxx-menu-scrim');

    document.body.appendChild(scrim);
    document.body.appendChild(sheet);
    document.body.appendChild(btn);

    function open() {
      sheet.classList.add('open');
      scrim.classList.add('open');
      sheet.setAttribute('aria-hidden', 'false');
      btn.setAttribute('aria-expanded', 'true');
      document.documentElement.style.overflow = 'hidden';
    }

    function shut() {
      sheet.classList.remove('open');
      scrim.classList.remove('open');
      sheet.setAttribute('aria-hidden', 'true');
      btn.setAttribute('aria-expanded', 'false');
      document.documentElement.style.overflow = '';
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      sheet.classList.contains('open') ? shut() : open();
    });
    close.addEventListener('click', shut);
    scrim.addEventListener('click', shut);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') shut();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
