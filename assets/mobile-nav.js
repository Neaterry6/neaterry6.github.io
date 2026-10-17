/**
 * Mobile navigation.
 *
 * The desktop nav is `hidden md:flex`, so below 768px the site had no
 * navigation at all — no bar, no menu, no button. A visitor on a phone could
 * not reach any page except by scrolling to the footer.
 *
 * This reads the existing desktop links out of the page rather than keeping its
 * own list, so the mobile menu can never drift out of sync with the real nav.
 * If a link is added to the desktop bar it appears here automatically.
 *
 * A hamburger, not a three-dot: three dots read as "more options for this
 * page", a hamburger reads as "navigation", which is what it is.
 */
(function () {
  'use strict';

  function build() {
    if (document.getElementById('mnavBtn')) return;

    // ---- find the desktop link list
    var desktop = null;
    var candidates = document.querySelectorAll('nav div, nav ul');
    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      var cls = el.className || '';
      // The bar holding the links: several anchors, and hidden on small screens.
      if (el.querySelectorAll('a').length >= 3 && /hidden|md:flex/.test(cls)) {
        desktop = el;
        break;
      }
    }
    if (!desktop) return;

    var links = Array.prototype.slice.call(desktop.querySelectorAll('a'));

    // ---- the button
    var btn = document.createElement('button');
    btn.id = 'mnavBtn';
    btn.type = 'button';
    btn.className = 'mnav-btn';
    btn.setAttribute('aria-label', 'Open navigation');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'mnavPanel');
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
      '<path class="mnav-open-icon" d="M4 7h16M4 12h16M4 17h16"/>' +
      '<path class="mnav-close-icon" d="M6 6l12 12M18 6L6 18" style="display:none"/>' +
      '</svg>';

    // ---- the panel
    var panel = document.createElement('div');
    panel.id = 'mnavPanel';
    panel.className = 'mnav-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'Navigation');

    var head = document.createElement('div');
    head.className = 'mnav-head';
    head.innerHTML = '<span>Menu</span>';
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'mnav-close';
    close.setAttribute('aria-label', 'Close navigation');
    close.textContent = '\u00d7';
    head.appendChild(close);
    panel.appendChild(head);

    var list = document.createElement('nav');
    list.className = 'mnav-list';

    var here = (window.location.pathname || '/').replace(/\/index\.html$/, '/');

    links.forEach(function (a) {
      var clone = document.createElement('a');
      clone.href = a.getAttribute('href');
      clone.className = 'mnav-link';
      if (a.target) { clone.target = a.target; clone.rel = 'noopener'; }

      // Mark the current page so the menu says where you already are.
      var href = a.getAttribute('href') || '';
      var isExternal = /^https?:/.test(href);
      var path = isExternal ? null : href.split('#')[0];
      var isHere = !isExternal && path && path !== '#' &&
                   (path === here || (path === '/' && here === '/'));
      if (isHere) clone.classList.add('is-here');

      clone.textContent = a.textContent.trim();
      if (isExternal) {
        clone.insertAdjacentHTML('beforeend', ' <span class="mnav-ext">&nearr;</span>');
      }
      list.appendChild(clone);
    });

    panel.appendChild(list);

    var scrim = document.createElement('div');
    scrim.className = 'mnav-scrim';

    // Insert the button into the same bar as the brand, so it sits top-right
    // where a thumb expects it rather than floating over the page.
    var bar = desktop.parentNode;
    bar.appendChild(btn);
    document.body.appendChild(scrim);
    document.body.appendChild(panel);

    function open() {
      panel.classList.add('open');
      scrim.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
      document.documentElement.style.overflow = 'hidden';
      btn.querySelector('.mnav-open-icon').style.display = 'none';
      btn.querySelector('.mnav-close-icon').style.display = '';
    }

    function shut() {
      panel.classList.remove('open');
      scrim.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      document.documentElement.style.overflow = '';
      btn.querySelector('.mnav-open-icon').style.display = '';
      btn.querySelector('.mnav-close-icon').style.display = 'none';
    }

    btn.addEventListener('click', function () {
      panel.classList.contains('open') ? shut() : open();
    });
    close.addEventListener('click', shut);
    scrim.addEventListener('click', shut);
    list.addEventListener('click', function (e) {
      // Let the navigation start, but close so a back-navigation does not land
      // on an open menu.
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
