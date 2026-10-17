/* ==========================================================================
   Blog reader — neaterry6.github.io/blog.html

   Reads published posts from Supabase and renders them. The whole page is
   driven by the URL: /blog.html is the index, /blog.html?post=<slug> is a
   single article. That keeps it working on GitHub Pages, which serves static
   files and cannot rewrite paths.
   ========================================================================== */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://izmretuwwzgvejbhaaku.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_vkKUPbVR14Oho0zgZgegAA_xfShW7CX';

  var db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  var $ = function (id) { return document.getElementById(id); };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmtDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric'
      });
    } catch (e) { return ''; }
  }

  // ================================================================ markdown

  /**
   * A small Markdown renderer, escape-first.
   *
   * The post body is written by the site owner, but it is still data from a
   * database that any XSS in the admin session could rewrite — so everything
   * is escaped before any formatting is applied. Raw HTML in a post renders as
   * text, never as markup.
   *
   * Supports what a blog actually uses: headings, bold, italic, inline code,
   * fenced code blocks, links, images, lists, blockquotes and rules. It is not
   * a complete CommonMark implementation and does not try to be.
   */
  function markdown(src) {
    var text = String(src || '').replace(/\r\n/g, '\n');

    // Fenced code blocks are pulled out first so their contents are never
    // touched by the inline passes below.
    var blocks = [];
    text = text.replace(/```([a-z0-9+-]*)\n([\s\S]*?)```/gi, function (_m, lang, code) {
      blocks.push('<pre><code data-lang="' + esc(lang) + '">' + esc(code.replace(/\n$/, '')) + '</code></pre>');
      return '\u0000BLOCK' + (blocks.length - 1) + '\u0000';
    });

    text = esc(text);

    // Inline: code, bold, italic, links, images.
    text = text.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    text = text.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    text = text.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g,
      '<img src="$2" alt="$1" loading="lazy">');
    text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Block level, line by line.
    var out = [];
    var listType = null;

    function closeList() {
      if (listType) { out.push('</' + listType + '>'); listType = null; }
    }

    text.split('\n').forEach(function (line) {
      var t = line.trim();

      if (!t) { closeList(); return; }

      var blockRef = /^\u0000BLOCK(\d+)\u0000$/.exec(t);
      if (blockRef) { closeList(); out.push(blocks[Number(blockRef[1])]); return; }

      var h = /^(#{1,4})\s+(.*)$/.exec(t);
      if (h) {
        closeList();
        var level = Math.min(h[1].length + 1, 5); // never emit an h1 inside a post
        out.push('<h' + level + '>' + h[2] + '</h' + level + '>');
        return;
      }

      if (/^(-{3,}|\*{3,})$/.test(t)) { closeList(); out.push('<hr>'); return; }

      var q = /^&gt;\s?(.*)$/.exec(t);
      if (q) { closeList(); out.push('<blockquote>' + q[1] + '</blockquote>'); return; }

      var ul = /^[-*]\s+(.*)$/.exec(t);
      if (ul) {
        if (listType !== 'ul') { closeList(); out.push('<ul>'); listType = 'ul'; }
        out.push('<li>' + ul[1] + '</li>');
        return;
      }

      var ol = /^\d+\.\s+(.*)$/.exec(t);
      if (ol) {
        if (listType !== 'ol') { closeList(); out.push('<ol>'); listType = 'ol'; }
        out.push('<li>' + ol[1] + '</li>');
        return;
      }

      closeList();
      out.push('<p>' + t + '</p>');
    });

    closeList();
    return out.join('');
  }

  // ================================================================== index

  async function loadIndex() {
    var list = $('postList');
    var empty = $('blogEmpty');

    var res = await db.from('blog_posts')
      .select('slug,title,excerpt,cover_url,tags,published_at,views')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(100);

    if (res.error) {
      list.innerHTML = '<p class="text-gray-400">Could not load posts just now.</p>';
      return;
    }

    var posts = res.data || [];

    if (!posts.length) {
      list.innerHTML = '';
      empty.classList.remove('hidden');
      $('emptyTitle').textContent = 'No posts yet';
      $('emptyBody').textContent = 'The first one is being written. Check back soon.';
      return;
    }

    // Tag filter, only when there is more than one tag in play.
    var tags = {};
    posts.forEach(function (p) {
      (p.tags || []).forEach(function (t) { tags[t] = (tags[t] || 0) + 1; });
    });
    var tagNames = Object.keys(tags).sort();
    var filter = $('tagFilter');

    if (tagNames.length > 1) {
      filter.classList.remove('hidden');
      filter.innerHTML = '<button class="tag-btn px-3 py-1.5 rounded-full text-xs border border-cyan-400/40 text-cyan-400" data-tag="">All</button>'
        + tagNames.map(function (t) {
            return '<button class="tag-btn px-3 py-1.5 rounded-full text-xs border border-white/10 text-gray-400 hover:border-cyan-400/40 hover:text-cyan-400 transition-colors" data-tag="' + esc(t) + '">' + esc(t) + '</button>';
          }).join('');
    }

    var activeTag = '';

    function render() {
      var shown = activeTag
        ? posts.filter(function (p) { return (p.tags || []).indexOf(activeTag) !== -1; })
        : posts;

      list.innerHTML = shown.map(function (p) {
        var cover = p.cover_url
          ? '<div class="mb-4 rounded-xl overflow-hidden"><img src="' + esc(p.cover_url) + '" alt="" loading="lazy" class="w-full h-44 object-cover"></div>'
          : '';
        var tagRow = (p.tags || []).length
          ? '<div class="flex flex-wrap gap-2 mt-3">' + p.tags.map(function (t) {
              return '<span class="text-xs px-2.5 py-1 rounded-full border border-white/10 text-gray-500">' + esc(t) + '</span>';
            }).join('') + '</div>'
          : '';

        return '<a href="?post=' + encodeURIComponent(p.slug) + '" class="post-card rounded-2xl p-6 block">'
          + cover
          + '<div class="flex items-center gap-3 text-xs text-gray-500 mb-2">'
          +   '<time datetime="' + esc(p.published_at) + '">' + esc(fmtDate(p.published_at)) + '</time>'
          +   (p.views ? '<span>&middot;</span><span>' + esc(String(p.views)) + ' views</span>' : '')
          + '</div>'
          + '<h2 class="text-xl font-bold text-white mb-2 leading-snug">' + esc(p.title) + '</h2>'
          + (p.excerpt ? '<p class="text-gray-400 text-sm leading-relaxed">' + esc(p.excerpt) + '</p>' : '')
          + tagRow
          + '</a>';
      }).join('');
    }

    filter.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-tag]');
      if (!btn) return;
      activeTag = btn.getAttribute('data-tag');
      Array.prototype.forEach.call(filter.querySelectorAll('[data-tag]'), function (b) {
        var on = b.getAttribute('data-tag') === activeTag;
        b.className = 'tag-btn px-3 py-1.5 rounded-full text-xs border transition-colors '
          + (on ? 'border-cyan-400/40 text-cyan-400' : 'border-white/10 text-gray-400 hover:border-cyan-400/40 hover:text-cyan-400');
      });
      render();
    });

    render();
  }

  // =================================================================== post

  async function loadPost(slug) {
    var res = await db.from('blog_posts')
      .select('slug,title,excerpt,body,cover_url,tags,published_at,views')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle();

    if (res.error || !res.data) {
      $('blogIndex').classList.add('hidden');
      $('blogPost').classList.add('hidden');
      $('blogEmpty').classList.remove('hidden');
      $('emptyTitle').textContent = 'Post not found';
      $('emptyBody').textContent = 'That link may be old, or the post was unpublished.';
      return;
    }

    var p = res.data;

    $('blogIndex').classList.add('hidden');
    $('blogPost').classList.remove('hidden');

    document.title = p.title + ' — brokenXoxo';

    $('postHead').innerHTML =
      '<div class="flex items-center gap-3 text-xs text-gray-500 mb-3">'
      + '<time datetime="' + esc(p.published_at) + '">' + esc(fmtDate(p.published_at)) + '</time>'
      + (p.views ? '<span>&middot;</span><span>' + esc(String(p.views)) + ' views</span>' : '')
      + '</div>'
      + '<h1 class="text-3xl md:text-4xl font-bold text-white leading-tight mb-4">' + esc(p.title) + '</h1>'
      + (p.excerpt ? '<p class="text-lg text-gray-400 leading-relaxed mb-6">' + esc(p.excerpt) + '</p>' : '')
      + ((p.tags || []).length
          ? '<div class="flex flex-wrap gap-2 mb-8">' + p.tags.map(function (t) {
              return '<span class="text-xs px-2.5 py-1 rounded-full border border-white/10 text-gray-500">' + esc(t) + '</span>';
            }).join('') + '</div>'
          : '');

    if (p.cover_url) {
      $('postCover').innerHTML = '<img src="' + esc(p.cover_url) + '" alt="" class="w-full rounded-2xl border border-white/5">';
    }

    $('postBody').innerHTML = markdown(p.body);

    // Count the read. Fire-and-forget: a failed counter must never stop the
    // article from rendering.
    db.rpc('blog_count_view', { target: p.slug }).then(function (r) {
      if (r.error) return;
      var meta = $('postHead').querySelector('span:last-child');
      // Nothing to update in place — the number is decorative. Leave it.
    });
  }

  // ================================================================= wiring

  document.addEventListener('DOMContentLoaded', function () {
    var year = $('year');
    if (year) year.textContent = new Date().getFullYear();

    var slug = new URLSearchParams(window.location.search).get('post');
    if (slug) loadPost(slug);
    else loadIndex();
  });
})();
