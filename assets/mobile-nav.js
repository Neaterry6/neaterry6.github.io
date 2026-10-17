/**
 * Mobile navigation.
 *
 * The desktop nav is `hidden md:flex`, so below 768px the site had no
 * navigation at all. This is the replacement.
 *
 * Icons are inline SVG on a 24x24 grid with a consistent stroke weight. Not
 * emoji, and not a mix: an arrow glyph on one row out of eleven reads as a
 * mistake rather than a distinction.
 *
 * Links and their icons are declared here as one list rather than read out of
 * the desktop bar, because the desktop bar carries no icons to inherit — the
 * only way to keep the two in sync visually is to own the list.
 */
(function () {
  'use strict';

  var ITEMS = [
    {
      href: '/', label: 'Home', note: 'Start here',
      icon: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/>'
    },
    {
      href: '/#about', label: 'About', note: 'Who I am',
      icon: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>'
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
      href: '/#contact', label: 'Contact', note: 'Get in touch',
      icon: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'
    },
    {
      href: 'https://github.com/Neaterry6', label: 'GitHub', note: 'Code and repos',
      external: true,
      icon: '<path d="M9 19c-4 1.2-4-2.2-5.5-2.8M15 21v-3.4a3 3 0 0 0-.8-2.3c2.7-.3 5.5-1.3 5.5-6a4.7 4.7 0 0 0-1.3-3.2 4.4 4.4 0 0 0-.1-3.3s-1.1-.3-3.6 1.3a12.2 12.2 0 0 0-6.4 0C5.8 2.5 4.7 2.8 4.7 2.8a4.4 4.4 0 0 0-.1 3.3A4.7 4.7 0 0 0 3.3 9.3c0 4.6 2.8 5.7 5.5 6a3 3 0 0 0-.8 2.3V21"/>'
    }
  ];

  function svg(paths, size) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('width', size);
    s.setAttribute('height', size);
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
    if (document.getElementById('mnavBtn')) return;

    // ---- find the bar that holds the brand, so the button lands in it
    var bar = null;
    var navs = document.querySelectorAll('nav > div, header > div');
    for (var i = 0; i < navs.length; i++) {
      if (navs[i].querySelector('a, img')) { bar = navs[i]; break; }
    }
    if (!bar) return;

    // ---- button
    var btn = document.createElement('button');
    btn.id = 'mnavBtn';
    btn.type = 'button';
    btn.className = 'mnav-btn';
    btn.setAttribute('aria-label', 'Open navigation');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'mnavPanel');
    btn.appendChild(svg('<path class="mnav-i-open" d="M4 7h16M4 12h16M4 17h16"/><path class="mnav-i-shut" d="M6 6l12 12M18 6L6 18" style="display:none"/>', 20));

    // ---- panel
    var panel = document.createElement('div');
    panel.id = 'mnavPanel';
    panel.className = 'mnav-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'Navigation');

    var head = document.createElement('div');
    head.className = 'mnav-head';
    var title = document.createElement('span');
    title.className = 'mnav-title';
    title.textContent = 'Navigation';
    head.appendChild(title);

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'mnav-close';
    close.setAttribute('aria-label', 'Close navigation');
    close.appendChild(svg('<path d="M6 6l12 12M18 6L6 18"/>', 18));
    head.appendChild(close);
    panel.appendChild(head);

    var list = document.createElement('nav');
    list.className = 'mnav-list';

    var here = (window.location.pathname || '/').replace(/\/index\.html$/, '/');

    ITEMS.forEach(function (item) {
      var a = document.createElement('a');
      a.href = item.href;
      a.className = 'mnav-link';
      if (item.external) { a.target = '_blank'; a.rel = 'noopener'; }

      var isHere = !item.external && item.href.split('#')[0] === here &&
                   (item.href.indexOf('#') === -1 || here === '/');
      if (isHere) a.classList.add('is-here');

      var ic = document.createElement('span');
      ic.className = 'mnav-icon';
      ic.appendChild(svg(item.icon, 17));
      a.appendChild(ic);

      var text = document.createElement('span');
      text.className = 'mnav-text';
      var lab = document.createElement('span');
      lab.className = 'mnav-label';
      lab.textContent = item.label;
      text.appendChild(lab);
      var note = document.createElement('span');
      note.className = 'mnav-note';
      note.textContent = item.note;
      text.appendChild(note);
      a.appendChild(text);

      if (item.external) {
        var ext = document.createElement('span');
        ext.className = 'mnav-ext';
        ext.appendChild(svg('<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>', 14));
        a.appendChild(ext);
      }

      list.appendChild(a);
    });

    panel.appendChild(list);

    var scrim = document.createElement('div');
    scrim.className = 'mnav-scrim';

    bar.appendChild(btn);
    document.body.appendChild(scrim);
    document.body.appendChild(panel);

    function open() {
      panel.classList.add('open');
      scrim.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
      document.documentElement.style.overflow = 'hidden';
      btn.querySelector('.mnav-i-open').style.display = 'none';
      btn.querySelector('.mnav-i-shut').style.display = '';
    }

    function shut() {
      panel.classList.remove('open');
      scrim.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      document.documentElement.style.overflow = '';
      btn.querySelector('.mnav-i-open').style.display = '';
      btn.querySelector('.mnav-i-shut').style.display = 'none';
    }

    btn.addEventListener('click', function () {
      panel.classList.contains('open') ? shut() : open();
    });
    close.addEventListener('click', shut);
    scrim.addEventListener('click', shut);
    list.addEventListener('click', function (e) {
      if (e.target.closest('a')) shut();
    });
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
