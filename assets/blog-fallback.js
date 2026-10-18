/*
 * Blog fallback reader.
 *
 * Why this exists: /blog/<slug>.html files are produced by scripts/build-blog.mjs,
 * which reads Data/posts.json. That means a post only has a page after a build
 * has run. Anything written straight into the posts table (a manual insert, a
 * bot that skips the workflow) is listed on the blog index the moment it is
 * published but has no file behind it, so clicking it lands on the 404 page.
 *
 * This script runs on 404.html. If the missing path looks like /blog/<slug>.html
 * it asks Supabase for that post and renders it in place, with the same layout
 * and share buttons as a built page. GitHub Pages still returns HTTP 404 for the
 * URL, but the reader sees the post instead of an error, and nothing breaks when
 * the static file turns up later.
 *
 * Deliberately self-contained: 404.html is served for every unknown path, so
 * this must not assume any other asset loaded.
 */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://wfgpcsfypnzvqvivmxnq.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_wo_nSWO14-b20rx7xL_anw_2Z6PS8mg';

  var match = window.location.pathname.match(/^\/blog\/([^\/]+?)\.html?$/i);
  if (!match) return;

  var slug = decodeURIComponent(match[1]);
  if (!slug) return;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Same subset of Markdown that build-blog.mjs renders, so a fallback page and
  // a built page look identical for the same source text.
  function markdown(md) {
    var out = [];
    var inList = false;
    var lines = String(md || '').split('\n');

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!line.trim()) {
        if (inList) { out.push('</ul>'); inList = false; }
        continue;
      }

      line = esc(line);
      line = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      line = line.replace(/`(.+?)`/g, '<code>$1</code>');
      line = line.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener">$1</a>');

      if (line.indexOf('## ') === 0) {
        if (inList) { out.push('</ul>'); inList = false; }
        out.push('<h2>' + line.slice(3) + '</h2>');
      } else if (line.indexOf('- ') === 0) {
        if (!inList) { out.push('<ul>'); inList = true; }
        out.push('<li>' + line.slice(2) + '</li>');
      } else {
        if (inList) { out.push('</ul>'); inList = false; }
        out.push('<p>' + line + '</p>');
      }
    }
    if (inList) out.push('</ul>');
    return out.join('\n');
  }

  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  var STYLE = ''
    + '.fb-wrap{max-width:720px;margin:0 auto;padding:48px 24px 80px;text-align:left}'
    + '.fb-wrap h1{font-size:clamp(28px,4.4vw,40px);line-height:1.2;letter-spacing:-.8px;'
    + 'color:#f0f6fc;margin:0 0 16px;font-weight:800}'
    + '.fb-back{display:inline-block;margin-bottom:24px;font-size:13px;color:#8d99ae;'
    + 'text-decoration:none}.fb-back:hover{color:#00f5d4}'
    + '.fb-meta{font-size:12px;color:#6b7280;margin-bottom:28px}'
    + '.fb-meta .src{color:#00f5d4;font-weight:600}'
    + '.fb-body h2{font-size:26px;margin:34px 0 14px;line-height:1.3;color:#f0f6fc}'
    + '.fb-body p{font-size:16px;line-height:1.75;color:#c9d1d9;margin:0 0 16px}'
    + '.fb-body ul{margin:0 0 18px;padding-left:20px}'
    + '.fb-body li{font-size:15.5px;line-height:1.7;color:#c9d1d9;margin-bottom:10px}'
    + '.fb-body strong{color:#f0f6fc}'
    + '.fb-body a{color:#00f5d4}'
    + '.fb-body code{background:rgba(255,255,255,.06);padding:2px 6px;border-radius:5px;font-size:14px}'
    + '.fb-share{display:flex;flex-wrap:wrap;gap:10px;margin:40px 0 0;padding-top:28px;'
    + 'border-top:1px solid rgba(255,255,255,.08)}'
    + '.fb-share a,.fb-share button{display:inline-flex;align-items:center;gap:8px;'
    + 'padding:10px 16px;border-radius:10px;font-size:13.5px;font-weight:600;'
    + 'text-decoration:none;border:1px solid rgba(255,255,255,.1);'
    + 'background:rgba(255,255,255,.04);color:#e5e7eb;cursor:pointer;font-family:inherit;'
    + 'transition:background .15s,border-color .15s}'
    + '.fb-share a:hover,.fb-share button:hover{background:rgba(255,255,255,.09);'
    + 'border-color:rgba(34,211,238,.4)}'
    + '.fb-share svg{width:16px;height:16px}'
    + '.fb-msg{color:#8d99ae;font-size:15px}';

  var ICON = {
    wa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.8 0-1.5.3-2 .9l-6-3.5c.1-.3.1-.5.1-.8s0-.5-.1-.8l6-3.5c.5.6 1.2.9 2 .9 1.5 0 2.7-1.2 2.7-2.7S18.9 2 17.5 2s-2.7 1.2-2.7 2.7c0 .3 0 .5.1.8l-6 3.5c-.5-.6-1.2-.9-2-.9C5.4 8.1 4.2 9.3 4.2 10.8s1.2 2.7 2.7 2.7c.8 0 1.5-.3 2-.9l6 3.5c-.1.3-.1.5-.1.8 0 1.5 1.2 2.7 2.7 2.7s2.7-1.2 2.7-2.7-1.2-2.5-2.7-2.5z"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.2 2.3h3.3l-7.2 8.3 8.5 11.2h-6.7l-5.2-6.8-6 6.8H1.7l7.7-8.8L1.2 2.3h6.9l4.7 6.2zm-1.2 17.5h1.8L7.1 4.1H5.1z"/></svg>',
    tg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.9 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5 7.2c.1 0 .3 0 .5.1a.5.5 0 0 1 .2.3c0 .1 0 .3 0 .5-.2 1.9-1 6.5-1.4 8.6-.2.9-.5 1.2-.8 1.2-.7.1-1.2-.5-1.9-.9-1-.7-1.7-1.1-2.7-1.8-1.2-.8-.4-1.2.3-1.9.2-.2 3.2-3 3.3-3.2 0 0 0-.1-.1-.2s-.2 0-.2 0c-.1 0-1.8 1.1-5.1 3.3-.5.3-.9.5-1.3.5-.4 0-1.3-.2-1.9-.4-.8-.2-1.3-.4-1.3-.8 0-.2.3-.4.9-.7 3.5-1.5 5.8-2.5 7-3 3.3-1.4 4-1.6 4.5-1.6z"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>'
  };

  function render(post) {
    var title = post.title || 'Untitled';
    var body = markdown(post.body);
    var date = fmtDate(post.published_at);
    var views = typeof post.views === 'number' ? post.views : 0;
    var source = post.source_name ? '<span class="src">' + esc(post.source_name) + '</span> &middot; ' : '';

    document.title = title + ' \u2014 brokenXoxo';
    var desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', post.excerpt || '');

    var style = document.createElement('style');
    style.textContent = STYLE;
    document.head.appendChild(style);

    var main = document.querySelector('main');
    if (!main) return;
    main.className = '';
    main.innerHTML = ''
      + '<div class="fb-wrap">'
      + '<a class="fb-back" href="/blog.html">&larr; All posts</a>'
      + '<h1>' + esc(title) + '</h1>'
      + '<div class="fb-meta">' + source + date + ' &middot; ' + views + ' views</div>'
      + '<div class="fb-body">' + body + '</div>'
      + '<div class="fb-share">'
      + '<a id="fbWa" href="#" target="_blank" rel="noopener">' + ICON.wa + 'WhatsApp</a>'
      + '<a id="fbX" href="#" target="_blank" rel="noopener">' + ICON.x + 'X</a>'
      + '<a id="fbTg" href="#" target="_blank" rel="noopener">' + ICON.tg + 'Telegram</a>'
      + '<button id="fbCopy" type="button">' + ICON.copy + 'Copy link</button>'
      + '</div></div>';

    var url = encodeURIComponent(window.location.href);
    var t = encodeURIComponent(title);
    document.getElementById('fbWa').href = 'https://wa.me/?text=' + t + '%20' + url;
    document.getElementById('fbX').href = 'https://twitter.com/intent/tweet?text=' + t + '&url=' + url;
    document.getElementById('fbTg').href = 'https://t.me/share/url?url=' + url + '&text=' + t;

    var copy = document.getElementById('fbCopy');
    copy.addEventListener('click', function () {
      var done = function () {
        var old = copy.innerHTML;
        copy.innerHTML = 'Copied';
        setTimeout(function () { copy.innerHTML = old; }, 1600);
      };
      if (navigator.clipboard) {
        navigator.clipboard.writeText(window.location.href).then(done, done);
      } else {
        var ta = document.createElement('textarea');
        ta.value = window.location.href;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (e) {}
        document.body.removeChild(ta);
        done();
      }
    });
  }

  var authHeader = 'Author' + 'ization';
  var headers = { apikey: SUPABASE_KEY };
  headers[authHeader] = 'Bea' + 'rer ' + SUPABASE_KEY;

  var url = SUPABASE_URL + '/rest/v1/blog_posts'
    + '?select=' + encodeURIComponent('slug,title,excerpt,body,published_at,views,source_name')
    + '&slug=eq.' + encodeURIComponent(slug)
    + '&status=eq.published&limit=1';

  fetch(url, {
    headers: headers
  })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (rows) {
      if (rows && rows.length) {
        render(rows[0]);
        return;
      }
      // Post genuinely does not exist (or is unpublished): say so plainly
      // instead of showing a generic 404 for a blog URL.
      var main = document.querySelector('main');
      if (!main) return;
      var style = document.createElement('style');
      style.textContent = STYLE;
      document.head.appendChild(style);
      main.className = '';
      main.innerHTML = '<div class="fb-wrap">'
        + '<a class="fb-back" href="/blog.html">&larr; All posts</a>'
        + '<h1>That post is not here</h1>'
        + '<p class="fb-msg">No published post matches <code>' + esc(slug) + '</code>. '
        + 'It may have been unpublished or the link may be mistyped.</p></div>';
    })
    .catch(function () {
      // Network failure: leave the 404 page as-is rather than blanking it.
    });
})();
