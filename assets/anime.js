/**
 * Anime grid.
 *
 * The titles and the reasons are fixed; the cover art, score, episode count and
 * year are fetched live from Jikan (the public MyAnimeList API). Doing it in the
 * browser rather than at build time means the page stays accurate without a
 * rebuild, and it means the covers are real rather than guessed.
 *
 * Jikan rate-limits to roughly one request per second, so queries are spaced and
 * the whole grid renders immediately from local data — covers fill in after.
 */
(function () {
  'use strict';

  var API = 'https://api.jikan.moe/v4/anime';

  // [display name, search title, why it is on the list]
  var LIST = [
    ['Attack on Titan', 'Shingeki no Kyojin', 'The one that got me into seasonal anime. The basement reveal still holds up.'],
    ['Jujutsu Kaisen', 'Jujutsu Kaisen', 'Fight choreography that actually reads on screen. Mappa at full stretch.'],
    ['Demon Slayer', 'Kimetsu no Yaiba', 'Ufotable animation is the whole argument. Watch it for the fights.'],
    ['One Piece', 'One Piece', 'Twenty-plus years and still the best world-building in the medium.'],
    ['Naruto Shippuden', 'Naruto: Shippuuden', 'Grew up on it. The Pain arc is still the high point.'],
    ['Death Note', 'Death Note', 'The first half is a perfect thriller.'],
    ['Fullmetal Alchemist: Brotherhood', 'Fullmetal Alchemist: Brotherhood', 'No wasted episodes. The standard everything else gets measured against.'],
    ['Steins;Gate', 'Steins;Gate', 'Slow first half, then it does not let go.'],
    ['Hunter x Hunter', 'Hunter x Hunter (2011)', 'Best power system in shonen. Chimera Ant arc is a whole genre shift.'],
    ['Vinland Saga', 'Vinland Saga', 'A revenge story that argues against revenge.'],
    ['Mob Psycho 100', 'Mob Psycho 100', 'The most expressive animation of the last decade.'],
    ['Chainsaw Man', 'Chainsaw Man', 'Loud, ugly and completely deliberate about it.'],
    ['Spy x Family', 'Spy x Family', 'Comfort watch. Anya carries it.'],
    ['Tokyo Revengers', 'Tokyo Revengers', 'Time loops and gang politics. Messy but it hooks.'],
    ['Blue Lock', 'Blue Lock', 'Football as a psychological war. Absurd and I love it.'],
    ['Haikyuu!!', 'Haikyuu!!', 'The best sports anime, and it is not close.'],
    ['Dr. Stone', 'Dr. Stone', 'Science as the power system. Genuinely educational.'],
    ['Black Clover', 'Black Clover', 'Underdog shonen with a great ensemble.'],
    ['Solo Leveling', 'Solo Leveling', 'Power fantasy executed properly.'],
    ['Frieren', 'Sousou no Frieren', 'Quiet, melancholy and better written than most of this list.']
  ];

  var grid = document.getElementById('animeGrid');
  var search = document.getElementById('animeSearch');
  var countEl = document.getElementById('animeCount');
  if (!grid) return;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  var meta = {};   // search title -> { img, score, eps, year, mal }

  function render() {
    var q = (search && search.value || '').trim().toLowerCase();

    var rows = LIST.filter(function (r) {
      return !q || r[0].toLowerCase().indexOf(q) !== -1 || r[2].toLowerCase().indexOf(q) !== -1;
    });

    if (countEl) {
      countEl.textContent = rows.length + ' of ' + LIST.length;
    }

    if (!rows.length) {
      grid.innerHTML = '<div class="empty"><div class="glyph">&#128269;</div><p>Nothing matches "' +
        esc(q) + '".</p></div>';
      return;
    }

    grid.innerHTML = rows.map(function (r) {
      var name = r[0], why = r[2];
      var m = meta[name] || {};

      var art = m.img
        ? '<img loading="lazy" src="' + esc(m.img) + '" alt="' + esc(name) + ' cover">'
        : '<div class="media-ph">' + esc(name.charAt(0)) + '</div>';

      var bits = [];
      if (m.score) bits.push('&#9733; ' + m.score);
      if (m.eps) bits.push(m.eps + ' eps');
      if (m.year) bits.push(m.year);

      return '<article class="media-card">' +
        '<div class="media-art">' + art + '</div>' +
        '<div class="media-body">' +
          '<h3>' + esc(name) + '</h3>' +
          (bits.length ? '<div class="media-meta">' + bits.join(' &middot; ') + '</div>' : '') +
          '<p>' + esc(why) + '</p>' +
          (m.mal ? '<a class="media-link" href="' + esc(m.mal) + '" target="_blank" rel="noopener">MyAnimeList &nearr;</a>' : '') +
        '</div>' +
      '</article>';
    }).join('');
  }

  // One lookup at a time, spaced out, so Jikan does not rate-limit the page.
  var queue = LIST.slice();

  function next() {
    var item = queue.shift();
    if (!item) return;

    var name = item[0], query = item[1];
    var url = API + '?q=' + encodeURIComponent(query) + '&limit=1&sfw=true';

    fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (d) {
        var a = d && d.data && d.data[0];
        if (a) {
          meta[name] = {
            img: a.images && a.images.jpg && (a.images.jpg.large_image_url || a.images.jpg.image_url),
            score: a.score || null,
            eps: a.episodes || null,
            year: a.year || (a.aired && a.aired.prop && a.aired.prop.from && a.aired.prop.from.year) || null,
            mal: a.url || null
          };
          render();
        }
      })
      .catch(function () { /* keep the fallback card; never blank the grid */ })
      .then(function () {
        setTimeout(next, 900);
      });
  }

  if (search) {
    var t;
    search.addEventListener('input', function () {
      clearTimeout(t);
      t = setTimeout(render, 120);
    });
  }

  render();
  next();
})();
