/* ==========================================================================
   Guestbook — neaterry6.github.io/guestbook.html

   Visitors leave a name and a message. No account, because a guestbook that
   demands a signup gets no signatures.

   The trade-off that comes with that: an open, unauthenticated write endpoint
   attracts spam. Two things hold it back without adding friction:

   1. A length cap and a check constraint in the database, so a script cannot
      post a 200KB payload.
   2. A per-browser rate limit on the client. That is not a security control —
      anyone can clear localStorage — but it stops the accidental double-submit
      and the lazy loop, which is most of what actually happens.

   Anything worse than that is handled by the `hidden` flag, which the owner
   can flip in the database to pull an entry without deleting it.
   ========================================================================== */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://wfgpcsfypnzvqvivmxnq.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_wo_nSWO14-b20rx7xL_anw_2Z6PS8mg';

  var db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  var $ = function (id) { return document.getElementById(id); };

  var COOLDOWN_MS = 60 * 1000; // one signature a minute per browser

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function timeAgo(iso) {
    var then = Date.parse(iso);
    if (!then) return '';
    var secs = Math.max(0, Math.round((Date.now() - then) / 1000));
    if (secs < 60) return 'just now';
    var mins = Math.round(secs / 60);
    if (mins < 60) return mins + 'm ago';
    var hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    var days = Math.round(hrs / 24);
    if (days < 30) return days + 'd ago';
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  async function load() {
    var list = $('gbList');

    var res = await db.from('guestbook')
      .select('id,name,body,created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    if (res.error) {
      list.innerHTML = '<div class="empty"><div class="glyph">&#128683;</div>'
        + '<h3>Could not load the guestbook</h3><p>Try again in a moment.</p></div>';
      return;
    }

    var rows = res.data || [];

    if (!rows.length) {
      list.innerHTML = '<div class="empty"><div class="glyph">&#128172;</div>'
        + '<h3>Nothing here yet</h3><p>Be the first to sign it.</p></div>';
      return;
    }

    list.innerHTML = rows.map(function (r) {
      return '<div class="card">'
        + '<div class="card-top">'
        +   '<h3>' + esc(r.name) + '</h3>'
        +   '<span style="font-size:11px;color:#6b7280">' + esc(timeAgo(r.created_at)) + '</span>'
        + '</div>'
        + '<p style="white-space:pre-wrap">' + esc(r.body) + '</p>'
        + '</div>';
    }).join('');
  }

  function cooldownLeft() {
    try {
      var last = Number(localStorage.getItem('gb-last') || 0);
      return Math.max(0, COOLDOWN_MS - (Date.now() - last));
    } catch (e) { return 0; }
  }

  async function submit(e) {
    e.preventDefault();

    var btn = $('gbSend');
    var msg = $('gbMsg');
    var name = $('gbName').value.trim();
    var body = $('gbBody').value.trim();

    if (!name || body.length < 2) {
      msg.textContent = 'A name and a message, please.';
      return;
    }

    var wait = cooldownLeft();
    if (wait > 0) {
      msg.textContent = 'One signature a minute — ' + Math.ceil(wait / 1000) + 's to go.';
      return;
    }

    btn.disabled = true;
    msg.textContent = 'Signing…';

    var res = await db.from('guestbook').insert({ name: name, body: body });

    btn.disabled = false;

    if (res.error) {
      msg.textContent = 'Could not save that. Try again.';
      return;
    }

    try { localStorage.setItem('gb-last', String(Date.now())); } catch (err) { /* fine */ }

    $('gbBody').value = '';
    msg.textContent = 'Signed. Thanks.';
    setTimeout(function () { msg.textContent = ''; }, 4000);
    load();
  }

  document.addEventListener('DOMContentLoaded', function () {
    var form = $('gbForm');
    if (form) form.addEventListener('submit', submit);
    load();
  });
})();
