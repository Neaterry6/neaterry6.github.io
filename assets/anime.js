/**
 * Anime grid.
 *
 * Reads assets/anime-data.json, which is generated at build time by
 * scripts/fetch-anime.mjs from AniList. Baking the data in rather than calling
 * an API at runtime means:
 *
 *   - the page is complete on first paint, with no third-party request in the
 *     critical path and nothing to fall back from;
 *   - a cover that was correct when the page was built cannot disappear because
 *     an upstream API went down or rate-limited the visitor;
 *   - refreshing the list is a build step, not something that happens silently
 *     to a page someone is looking at.
 *
 * The cost is that scores and episode counts are as fresh as the last build.
 * That is the right trade for a personal list.
 */
(function () {
  'use strict';

  var grid = document.getElementById('animeGrid');
  var search = document.getElementById('animeSearch');
  var countEl = document.getElementById('animeCount');
  if (!grid) return;

  var DATA = [];
  var notes = {};   // display name -> why it is on the list

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function render() {
    var q = (search && search.value || '').trim().toLowerCase();

    var rows = DATA.filter(function (a) {
      if (!q) return true;
      var hay = [a.name, a.matched, (a.genres || []).join(' '), notes[a.name] || '']
        .join(' ').toLowerCase();
      return hay.indexOf(q) !== -1;
    });

    if (countEl) countEl.textContent = rows.length + ' of ' + DATA.length;

    if (!rows.length) {
      grid.innerHTML = '<div class="empty"><div class="glyph">&#128269;</div><p>Nothing matches "' +
        esc(q) + '".</p></div>';
      return;
    }

    grid.innerHTML = rows.map(function (a) {
      var bits = [];
      if (a.score) bits.push('&#9733; ' + (a.score / 10).toFixed(1));
      if (a.episodes) bits.push(a.episodes + ' eps');
      if (a.year) bits.push(a.year);

      var genres = (a.genres || []).slice(0, 2).map(function (g) {
        return '<span class="tag">' + esc(g) + '</span>';
      }).join('');

      // The cover sits on a tinted background taken from the artwork's own
      // dominant colour, so a slow image fades in from something related
      // instead of flashing grey.
      var tint = a.color ? ' style="background:' + esc(a.color) + '"' : '';

      return '<article class="media-card">' +
        '<div class="media-art"' + tint + '>' +
          (a.cover
            ? '<img loading="lazy" src="' + esc(a.cover) + '" alt="' + esc(a.name) + ' cover"' +
              ' onerror="this.replaceWith(Object.assign(document.createElement(\'div\'),' +
              '{className:\'media-ph\',textContent:' + JSON.stringify(a.name.charAt(0)) + '}))">'
            : '<div class="media-ph">' + esc(a.name.charAt(0)) + '</div>') +
        '</div>' +
        '<div class="media-body">' +
          '<h3>' + esc(a.name) + '</h3>' +
          (bits.length ? '<div class="media-meta">' + bits.join(' &middot; ') + '</div>' : '') +
          (genres ? '<div class="tags">' + genres + '</div>' : '') +
          (notes[a.name] ? '<p>' + esc(notes[a.name]) + '</p>' : '') +
          (a.url ? '<a class="media-link" href="' + esc(a.url) + '" target="_blank" rel="noopener">AniList &nearr;</a>' : '') +
        '</div>' +
      '</article>';
    }).join('');
  }

  if (search) {
    var t;
    search.addEventListener('input', function () {
      clearTimeout(t);
      t = setTimeout(render, 110);
    });
  }

  // Shown immediately while the JSON loads — 20 cards is small, but a blank grid
  // for even a moment reads as broken.
  grid.innerHTML = '<div class="empty"><div class="glyph">&#127916;</div><p>Loading…</p></div>';

  fetch('/assets/anime-data.json')
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (rows) {
      DATA = rows || [];

      // The reasons live with the page rather than in the generated file, so
      // regenerating the data never overwrites what was written by hand.
      notes = window.ANIME_NOTES || {};

      render();
    })
    .catch(function () {
      grid.innerHTML = '<div class="empty"><div class="glyph">&#9888;</div>' +
        '<p>Could not load the list. Refresh to try again.</p></div>';
    });
})();
