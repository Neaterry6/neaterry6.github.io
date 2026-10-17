/* ==========================================================================
   Blog admin — create, edit, publish and delete posts.

   This file backs a page at an unguessable path, but the path is not the
   security boundary. Every write goes through Supabase with row-level security
   that requires app_metadata.role = 'admin' on the session. Somebody who finds
   this page gets a login form they cannot pass, and a hand-rolled API call gets
   refused by the database.

   The isAdmin() check here only decides whether to draw the UI. It is not a
   guard — removing it in devtools would show an empty dashboard, not a working
   one, because the writes would still fail.
   ========================================================================== */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://wfgpcsfypnzvqvivmxnq.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_wo_nSWO14-b20rx7xL_anw_2Z6PS8mg';
  var COVER_BUCKET = 'blog-covers';

  /**
   * Session persistence.
   *
   * Stated explicitly rather than left to the default, because staying signed
   * in is the requirement: the session is written to localStorage, survives a
   * refresh, a closed tab and a browser restart, and supabase-js refreshes the
   * access token in the background before it expires. The only things that end
   * it are pressing Sign out or clearing site data.
   *
   * A consequence worth knowing: on a shared machine the session outlives the
   * tab, so Sign out is the way to hand it over, not closing the window.
   */
  var db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      storage: window.localStorage,
      storageKey: 'bxx-admin-auth',
      persistSession: true,
      autoRefreshToken: true,
      // Parse the session out of the URL after a magic-link or OAuth return.
      detectSessionInUrl: true,
      // 'implicit', not 'pkce'. The magic link returns its tokens in the URL
      // fragment (#access_token=...), and the pkce flow only looks for a
      // ?code= parameter — so with pkce the session was silently dropped and
      // the page redrew the login form. The fragment tokens are the contract
      // here, so the client has to be told to read them.
      flowType: 'implicit'
    }
  });

  var $ = function (id) { return document.getElementById(id); };

  var state = {
    user: null,
    posts: [],
    editing: null,   // the post row being edited, or null for a new one
    dirty: false,
    saving: false,
    statusFilter: 'all',  // all | published | draft
    likes: {},            // post_id -> like count
    guestbook: []         // newest guestbook rows
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function toast(msg, kind) {
    var el = $('toast');
    el.textContent = msg;
    el.className = 'toast show ' + (kind === 'err' ? 'toast-err' : 'toast-ok');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.className = 'toast ' + (kind === 'err' ? 'toast-err' : 'toast-ok'); }, 3200);
  }

  function isAdmin() {
    return !!(state.user && state.user.app_metadata && state.user.app_metadata.role === 'admin');
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) { return '—'; }
  }

  // =============================================================== markdown

  /**
   * The same renderer the public blog uses, so the preview matches the page.
   * Kept in step by hand — it is small and the two files are edited together.
   */
  function markdown(src) {
    var text = String(src || '').replace(/\r\n/g, '\n');
    var blocks = [];

    text = text.replace(/```([a-z0-9+-]*)\n([\s\S]*?)```/gi, function (_m, lang, code) {
      blocks.push('<pre><code>' + esc(code.replace(/\n$/, '')) + '</code></pre>');
      return '\u0000BLOCK' + (blocks.length - 1) + '\u0000';
    });

    text = esc(text);
    text = text.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    text = text.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    text = text.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, '<img src="$2" alt="$1" class="rounded-xl my-3">');
    text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

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
        var level = Math.min(h[1].length + 1, 5);
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

  // ================================================================== views

  function show(view) {
    $('loginView').classList.toggle('hidden', view !== 'login');
    $('dashView').classList.toggle('hidden', view !== 'dash');
    $('editorView').classList.toggle('hidden', view !== 'editor');
    window.scrollTo(0, 0);
  }

  // =================================================================== auth

  // Password sign-in was removed. There is one owner, the account has no
  // password set, and a password field on a page nobody else can use is just a
  // thing to leak. The magic link below replaces it.

  /**
   * Sign in with GitHub.
   *
   * Supabase handles the whole round trip: it redirects to GitHub, GitHub
   * comes back to the project's callback, and Supabase returns here with a
   * session in the URL. onAuthStateChange picks that up on load, so there is
   * nothing to handle in this function beyond starting it.
   *
   * The admin check still applies on the way back. A GitHub sign-in from any
   * account that is not the owner's is a normal member, and gets bounced.
   */
  async function signInWithGitHub() {
    var btn = $('ghBtn');
    var msg = $('loginMsg');
    msg.classList.add('hidden');

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Redirecting to GitHub\u2026';
    }

    var res = await db.auth.signInWithOAuth({
      provider: 'github',
      options: {
        // Back to this exact page, so the session lands where the dashboard is.
        redirectTo: window.location.origin + window.location.pathname,
        scopes: 'read:user user:email'
      }
    });

    if (res.error) {
      if (btn) { btn.disabled = false; btn.textContent = 'Continue with GitHub'; }
      msg.textContent = res.error.message;
      msg.classList.remove('hidden');
    }
    // On success the browser is already navigating to GitHub; leave the button
    // disabled so a second press cannot start a second flow.
  }

  /**
   * Passwordless sign-in.
   *
   * Sends a one-time link to the owner's address. This exists because it is the
   * one route that does not depend on anything outside our control: GitHub
   * sign-in needs the OAuth app's callback URL to point at this project, and a
   * password needs a password to exist. A confirmed account plus a working mail
   * send is enough.
   *
   * The address is fixed to the owner's rather than taken from the input, so
   * the button cannot be used to spray mail at arbitrary addresses from the
   * site.
   */
  var OWNER_EMAIL = 'trusto2856@gmail.com';

  async function emailSignInLink() {
    var btn = $('otpBtn');
    var msg = $('loginMsg');
    msg.classList.add('hidden');

    if (btn) { btn.disabled = true; btn.textContent = 'Sending\u2026'; }

    var res = await db.auth.signInWithOtp({
      email: OWNER_EMAIL,
      options: {
        // Back to this exact page, which is where the dashboard lives.
        emailRedirectTo: window.location.origin + window.location.pathname,
        shouldCreateUser: false
      }
    });

    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Email me a sign-in link';
    }

    if (res.error) {
      msg.textContent = res.error.message;
      msg.classList.remove('hidden');
      return;
    }

    msg.textContent = 'Link sent to ' + OWNER_EMAIL + ' \u2014 open it on this device.';
    msg.classList.remove('hidden');
    msg.style.color = '#22d3ee';
  }

  async function signOut() {
    await db.auth.signOut();
    state.user = null;
    show('login');
  }

  // ================================================================== posts

  async function loadPosts() {
    var res = await db.from('blog_posts')
      .select('id,slug,title,excerpt,status,published_at,updated_at,views,tags,body,cover_url')
      .order('updated_at', { ascending: false })
      .limit(200);

    if (res.error) { toast(res.error.message, 'err'); return; }

    state.posts = res.data || [];
    renderStats();
    renderRows();
  }

  function renderStats() {
    var pub = state.posts.filter(function (p) { return p.status === 'published'; });
    var drafts = state.posts.filter(function (p) { return p.status === 'draft'; });
    var views = state.posts.reduce(function (n, p) { return n + (p.views || 0); }, 0);

    $('statPublished').textContent = pub.length;
    $('statDrafts').textContent = drafts.length;
    $('statViews').textContent = views.toLocaleString();

    var nav = $('navPostCount');
    if (nav) nav.textContent = state.posts.length;

    // Likes and guestbook are counted from the database rather than the loaded
    // posts, because the post list only carries what this page fetched and the
    // totals have to be real.
    loadEngagement();

    renderRecent();
    renderTopPosts();
    renderActivity();
  }

  /**
   * Engagement totals.
   *
   * Likes come from the aggregate function so the number is the true count, not
   * a sum over the page of results. The guestbook is a plain count. Both fail
   * quietly: a dashboard that throws because a count failed is worse than one
   * showing a dash.
   */
  async function loadEngagement() {
    try {
      var likesRes = await db.rpc('blog_like_counts');
      if (!likesRes.error && Array.isArray(likesRes.data)) {
        state.likes = {};
        var total = 0;
        likesRes.data.forEach(function (r) {
          state.likes[r.post_id] = r.total;
          total += r.total;
        });
        $('statLikes').textContent = total.toLocaleString();
        renderLikesByPost();
      }
    } catch (e) { /* leave the dash */ }

    try {
      var gbRes = await db.from('guestbook').select('*').order('created_at', { ascending: false }).limit(50);
      if (!gbRes.error) {
        state.guestbook = gbRes.data || [];
        $('gbCount').textContent = state.guestbook.length + ' signed';
        renderGuestbook();
      }
    } catch (e) { /* leave the dash */ }
  }

  function fmtRelative(iso) {
    if (!iso) return '';
    var then = new Date(iso).getTime();
    if (isNaN(then)) return '';
    var mins = Math.round((Date.now() - then) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    var hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    var days = Math.round(hrs / 24);
    if (days < 30) return days + 'd ago';
    return fmtDate(iso);
  }

  function renderRecent() {
    var host = $('recentRows');
    if (!host) return;

    var rows = state.posts.slice().sort(function (a, b) {
      return new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0);
    }).slice(0, 6);

    if (!rows.length) {
      host.innerHTML = '<div class="adm-empty">No posts yet.</div>';
      return;
    }

    host.innerHTML = rows.map(function (p) {
      var live = p.status === 'published';
      return '<div class="adm-recent-row" data-edit="' + esc(p.id) + '">' +
        '<span class="adm-dot ' + (live ? 'is-live' : 'is-draft') + '"></span>' +
        '<div class="adm-recent-main">' +
          '<div class="adm-recent-title">' + esc(p.title) + '</div>' +
          '<div class="adm-recent-meta">' + (live ? 'published ' + fmtRelative(p.published_at) : 'draft, edited ' + fmtRelative(p.updated_at)) + '</div>' +
        '</div>' +
        '<span class="adm-recent-views">' + (p.views || 0) + ' views</span>' +
      '</div>';
    }).join('');
  }

  function renderTopPosts() {
    var host = $('topPosts');
    if (!host) return;

    var rows = state.posts.slice()
      .filter(function (p) { return (p.views || 0) > 0; })
      .sort(function (a, b) { return (b.views || 0) - (a.views || 0); })
      .slice(0, 5);

    if (!rows.length) {
      host.innerHTML = '<div class="adm-empty">No views recorded yet.</div>';
      return;
    }

    var max = rows[0].views || 1;
    host.innerHTML = rows.map(function (p) {
      var pct = Math.max(3, Math.round(((p.views || 0) / max) * 100));
      return '<div class="adm-bar-row">' +
        '<div class="adm-bar-top">' +
          '<span class="adm-bar-name">' + esc(p.title) + '</span>' +
          '<span class="adm-bar-num">' + (p.views || 0) + '</span>' +
        '</div>' +
        '<div class="adm-bar-track"><div class="adm-bar-fill" style="width:' + pct + '%"></div></div>' +
      '</div>';
    }).join('');
  }

  function renderLikesByPost() {
    var host = $('likesByPost');
    if (!host) return;

    var rows = state.posts.map(function (p) {
      return { title: p.title, n: (state.likes && state.likes[p.id]) || 0 };
    }).filter(function (r) { return r.n > 0; })
      .sort(function (a, b) { return b.n - a.n; })
      .slice(0, 6);

    if (!rows.length) {
      host.innerHTML = '<div class="adm-empty">No likes yet.</div>';
      return;
    }

    var max = rows[0].n || 1;
    host.innerHTML = rows.map(function (r) {
      var pct = Math.max(3, Math.round((r.n / max) * 100));
      return '<div class="adm-bar-row">' +
        '<div class="adm-bar-top">' +
          '<span class="adm-bar-name">' + esc(r.title) + '</span>' +
          '<span class="adm-bar-num">' + r.n + '</span>' +
        '</div>' +
        '<div class="adm-bar-track"><div class="adm-bar-fill" style="width:' + pct + '%"></div></div>' +
      '</div>';
    }).join('');
  }

  function renderGuestbook() {
    var host = $('adminGuestbook');
    if (!host) return;

    var rows = state.guestbook || [];
    if (!rows.length) {
      host.innerHTML = '<div class="adm-empty">Nobody has signed it yet.</div>';
      return;
    }

    host.innerHTML = rows.map(function (g) {
      return '<div class="adm-gb-row">' +
        '<div class="adm-gb-top">' +
          '<span class="adm-gb-name">' + esc(g.name) + '</span>' +
          '<span class="adm-gb-time">' + fmtRelative(g.created_at) + '</span>' +
        '</div>' +
        '<div class="adm-gb-body">' + esc(g.body) + '</div>' +
      '</div>';
    }).join('');
  }

  /**
   * Activity feed.
   *
   * Built from what the data can actually support: publish and edit times, plus
   * guestbook signatures. No invented events — an activity feed that shows
   * things that did not happen is worse than no feed.
   */
  function renderActivity() {
    var host = $('activityList');
    if (!host) return;

    var events = [];

    state.posts.forEach(function (p) {
      if (p.status === 'published' && p.published_at) {
        events.push({
          when: p.published_at,
          kind: 'published',
          text: '<strong>' + esc(p.title) + '</strong> went live'
        });
      } else if (p.updated_at) {
        events.push({
          when: p.updated_at,
          kind: 'edited',
          text: '<strong>' + esc(p.title) + '</strong> was edited'
        });
      }
    });

    (state.guestbook || []).slice(0, 8).forEach(function (g) {
      events.push({
        when: g.created_at,
        kind: 'guestbook',
        text: '<strong>' + esc(g.name) + '</strong> signed the guestbook'
      });
    });

    events = events
      .filter(function (e) { return e.when; })
      .sort(function (a, b) { return new Date(b.when) - new Date(a.when); })
      .slice(0, 8);

    if (!events.length) {
      host.innerHTML = '<div class="adm-empty">Nothing yet.</div>';
      return;
    }

    var icons = {
      published: '<span class="adm-act-icon" style="background:rgba(34,197,94,.14);color:#4ade80"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>',
      edited: '<span class="adm-act-icon" style="background:rgba(245,158,11,.14);color:#fbbf24"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L20 8l-4-4L4 16z"/></svg></span>',
      guestbook: '<span class="adm-act-icon" style="background:rgba(168,85,247,.14);color:#c084fc"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 15.5a2 2 0 0 1-2 2H8l-4 3v-15a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/></svg></span>'
    };

    host.innerHTML = events.map(function (e) {
      return '<div class="adm-act-row">' + (icons[e.kind] || '') +
        '<div><div class="adm-act-text">' + e.text + '</div>' +
        '<div class="adm-act-time">' + fmtRelative(e.when) + '</div></div>' +
      '</div>';
    }).join('');
  }

  function renderRows() {
    var q = ($('searchPosts').value || '').toLowerCase();
    var rows = state.posts.filter(function (p) {
      if (q && p.title.toLowerCase().indexOf(q) === -1 && p.slug.indexOf(q) === -1) return false;
      if (state.statusFilter && state.statusFilter !== 'all' && p.status !== state.statusFilter) return false;
      return true;
    });

    var host = $('postRows');

    if (!rows.length) {
      host.innerHTML = '<div class="px-5 py-12 text-center text-sm text-gray-500">'
        + (state.posts.length ? 'No posts match that search.' : 'No posts yet. Hit "New post" to write the first one.')
        + '</div>';
      return;
    }

    host.innerHTML = rows.map(function (p) {
      var live = p.status === 'published';
      return '<div class="px-5 py-4 border-b border-white/5 last:border-0 flex items-center gap-4 hover:bg-white/[0.02] transition-colors">'
        + '<div class="min-w-0 flex-1">'
        +   '<div class="flex items-center gap-2 mb-1">'
        +     '<span class="pill ' + (live ? 'pill-live' : 'pill-draft') + '">' + (live ? 'Live' : 'Draft') + '</span>'
        +     '<span class="text-[11px] text-gray-600">' + esc(live ? fmtDate(p.published_at) : 'edited ' + fmtDate(p.updated_at)) + '</span>'
        +     (p.views ? '<span class="text-[11px] text-gray-600">&middot; ' + p.views + ' views</span>' : '')
        +   '</div>'
        +   '<h3 class="font-semibold text-white text-sm truncate">' + esc(p.title) + '</h3>'
        +   '<p class="text-xs text-gray-500 font-mono truncate">/' + esc(p.slug) + '</p>'
        + '</div>'
        + '<div class="flex items-center gap-2 shrink-0">'
        +   (live
              ? '<a href="/blog.html?post=' + encodeURIComponent(p.slug) + '" target="_blank" rel="noopener" class="btn btn-ghost text-xs">Open</a>'
              : '')
        +   '<button class="btn btn-ghost text-xs" data-edit="' + esc(p.id) + '">Edit</button>'
        +   '<button class="btn btn-danger text-xs" data-del="' + esc(p.id) + '">Delete</button>'
        + '</div></div>';
    }).join('');
  }

  // ================================================================= editor

  function slugify(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  function openEditor(post) {
    state.editing = post || null;
    state.dirty = false;

    $('editorTitle').textContent = post ? 'Edit post' : 'New post';
    $('editorState').textContent = post ? (post.status === 'published' ? 'live' : 'draft') : 'unsaved';

    $('fTitle').value = post ? post.title : '';
    $('fSlug').value = post ? post.slug : '';
    $('fExcerpt').value = post ? post.excerpt : '';
    $('fTags').value = post ? (post.tags || []).join(', ') : '';
    $('fCover').value = post ? (post.cover_url || '') : '';
    $('fBody').value = post ? (post.body || '') : '';

    // A new post has no slug yet, so the title drives it. Once a post exists
    // its slug is a live URL and must not change under it.
    $('fSlug').readOnly = !!post;

    $('publishBtn').textContent = post && post.status === 'published' ? 'Update' : 'Publish';
    updateCounts();
    renderPreview();
    show('editor');
  }

  function updateCounts() {
    var ex = $('fExcerpt').value.length;
    $('excerptCount').textContent = ex;

    var body = $('fBody').value.trim();
    var words = body ? body.split(/\s+/).length : 0;
    $('bodyCount').textContent = words.toLocaleString() + (words === 1 ? ' word' : ' words');
  }

  function renderPreview() {
    var pane = $('previewPane');
    var title = $('fTitle').value.trim();
    var excerpt = $('fExcerpt').value.trim();
    var body = $('fBody').value;

    if (!title && !body) {
      pane.innerHTML = '<p class="text-gray-600 text-sm">Start typing to see the preview.</p>';
      return;
    }

    var cover = $('fCover').value.trim();
    pane.innerHTML =
      (cover ? '<img src="' + esc(cover) + '" alt="" class="w-full rounded-xl mb-4 border border-white/5">' : '')
      + (title ? '<h1 class="text-2xl font-bold text-white mb-3 leading-tight">' + esc(title) + '</h1>' : '')
      + (excerpt ? '<p class="text-gray-400 mb-5">' + esc(excerpt) + '</p>' : '')
      + markdown(body);
  }

  function collect(status) {
    var title = $('fTitle').value.trim();
    var slug = ($('fSlug').value.trim() || slugify(title)).toLowerCase();
    var tags = $('fTags').value.split(',')
      .map(function (t) { return t.trim().toLowerCase(); })
      .filter(Boolean)
      .slice(0, 8);

    return {
      title: title,
      slug: slug,
      excerpt: $('fExcerpt').value.trim(),
      body: $('fBody').value,
      cover_url: $('fCover').value.trim() || null,
      tags: tags,
      status: status,
      // Publication date is set once, on the first publish. Re-publishing an
      // edited post must not move it to the top of the blog.
      published_at: status === 'published'
        ? ((state.editing && state.editing.published_at) || new Date().toISOString())
        : null
    };
  }

  function validate(payload) {
    if (payload.title.length < 3) return 'Give it a title of at least 3 characters.';
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(payload.slug)) return 'Slug must be lowercase letters, numbers and single hyphens.';
    if (payload.slug.length < 3) return 'Slug is too short.';
    if (payload.excerpt.length > 300) return 'Excerpt is over 300 characters.';
    if (payload.status === 'published' && payload.body.trim().length < 10) return 'Write something before publishing.';
    return null;
  }

  async function save(status) {
    if (state.saving) return;

    var payload = collect(status);
    var problem = validate(payload);
    if (problem) { toast(problem, 'err'); return; }

    state.saving = true;
    $('publishBtn').disabled = true;
    $('saveDraftBtn').disabled = true;

    try {
      var res;
      if (state.editing) {
        res = await db.from('blog_posts').update(payload).eq('id', state.editing.id).select().maybeSingle();
      } else {
        res = await db.from('blog_posts').insert(payload).select().maybeSingle();
      }

      if (res.error) {
        // A duplicate slug is the one failure worth naming precisely, because
        // the fix is obvious once you know that is what happened.
        if (/duplicate key|unique constraint/i.test(res.error.message)) {
          toast('That slug is already used by another post.', 'err');
        } else {
          toast(res.error.message, 'err');
        }
        return;
      }

      state.editing = res.data;
      state.dirty = false;
      toast(status === 'published' ? 'Published' : 'Draft saved', 'ok');
      await loadPosts();
      openEditor(res.data);
    } finally {
      state.saving = false;
      $('publishBtn').disabled = false;
      $('saveDraftBtn').disabled = false;
    }
  }

  async function remove(id) {
    var post = state.posts.filter(function (p) { return p.id === id; })[0];
    if (!post) return;
    if (!window.confirm('Delete "' + post.title + '"?\n\nThis cannot be undone.')) return;

    var res = await db.from('blog_posts').delete().eq('id', id);
    if (res.error) { toast(res.error.message, 'err'); return; }

    toast('Deleted', 'ok');
    loadPosts();
  }

  // ================================================================ uploads

  async function uploadCover(file) {
    if (!file) return;

    var ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    var path = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;

    $('uploadBtn').disabled = true;
    $('uploadBtn').textContent = '…';

    try {
      var up = await db.storage.from(COVER_BUCKET).upload(path, file, { upsert: false, contentType: file.type });
      if (up.error) { toast(up.error.message, 'err'); return; }

      var pub = db.storage.from(COVER_BUCKET).getPublicUrl(path);
      $('fCover').value = pub.data.publicUrl;
      renderPreview();
      toast('Cover uploaded', 'ok');
    } finally {
      $('uploadBtn').disabled = false;
      $('uploadBtn').textContent = 'Upload';
      $('coverFile').value = '';
    }
  }

  // ================================================================= wiring

  document.addEventListener('DOMContentLoaded', async function () {
    $('ghBtn').addEventListener('click', signInWithGitHub);
    $('otpBtn').addEventListener('click', emailSignInLink);
    $('logoutBtn').addEventListener('click', signOut);
    $('newPostBtn').addEventListener('click', function () { openEditor(null); });
    $('backBtn').addEventListener('click', function () {
      if (state.dirty && !window.confirm('Discard unsaved changes?')) return;
      show('dash');
      loadPosts();
    });
    $('saveDraftBtn').addEventListener('click', function () { save('draft'); });
    $('publishBtn').addEventListener('click', function () { save('published'); });
    $('previewBtn').addEventListener('click', function () {
      // On a narrow screen the preview column is hidden, so this scrolls to it
      // rather than doing nothing visible.
      var pane = $('previewPane');
      if (!pane) return;
      pane.closest('.hidden')?.classList.remove('hidden');
      renderPreview();
      pane.closest('div.panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    $('uploadBtn').addEventListener('click', function () { $('coverFile').click(); });
    $('coverFile').addEventListener('change', function (e) { uploadCover(e.target.files[0]); });

    $('searchPosts').addEventListener('input', renderRows);

    // ------------------------------------------------------------ sections
    // One panel visible at a time. The heading and subtitle follow, so the
    // header always says where you are rather than staying on "Overview".
    var SECTION_COPY = {
      overview: ['Overview', 'Everything at a glance.'],
      posts: ['Posts', 'Write, edit, publish and delete.'],
      engagement: ['Engagement', 'What readers are doing.']
    };

    function showSection(name) {
      var buttons = document.querySelectorAll('.adm-nav-item');
      for (var i = 0; i < buttons.length; i++) {
        buttons[i].classList.toggle('is-active', buttons[i].getAttribute('data-section') === name);
      }
      var panels = document.querySelectorAll('.adm-section');
      for (var j = 0; j < panels.length; j++) {
        panels[j].classList.toggle('hidden', panels[j].getAttribute('data-panel') !== name);
      }
      var copy = SECTION_COPY[name] || SECTION_COPY.overview;
      var t = $('admTitle');
      var sub = $('admSub');
      if (t) t.textContent = copy[0];
      if (sub) sub.textContent = copy[1];
      window.scrollTo(0, 0);
    }

    document.addEventListener('click', function (e) {
      var navBtn = e.target.closest && e.target.closest('.adm-nav-item');
      if (navBtn) { showSection(navBtn.getAttribute('data-section')); return; }

      var goto = e.target.closest && e.target.closest('[data-goto]');
      if (goto) { showSection(goto.getAttribute('data-goto')); return; }

      // A row in Recent posts opens that post's editor.
      var row = e.target.closest && e.target.closest('.adm-recent-row');
      if (row && row.getAttribute('data-edit')) {
        var id = row.getAttribute('data-edit');
        var post = state.posts.filter(function (p) { return String(p.id) === String(id); })[0];
        if (post) openEditor(post);
      }
    });

    // Status filter on the posts table.
    document.addEventListener('click', function (e) {
      var seg = e.target.closest && e.target.closest('.adm-seg-btn');
      if (!seg) return;
      var group = seg.parentNode.querySelectorAll('.adm-seg-btn');
      for (var i = 0; i < group.length; i++) group[i].classList.remove('is-active');
      seg.classList.add('is-active');
      state.statusFilter = seg.getAttribute('data-status');
      renderRows();
    });

    $('postRows').addEventListener('click', function (e) {
      var edit = e.target.closest('[data-edit]');
      if (edit) {
        var post = state.posts.filter(function (p) { return p.id === edit.getAttribute('data-edit'); })[0];
        if (post) openEditor(post);
        return;
      }
      var del = e.target.closest('[data-del]');
      if (del) remove(del.getAttribute('data-del'));
    });

    // Title drives the slug while it is still empty and the post is new.
    $('fTitle').addEventListener('input', function () {
      if (!state.editing && !$('fSlug').value.trim()) {
        $('fSlug').value = slugify(this.value);
      }
      state.dirty = true;
      renderPreview();
    });

    ['fExcerpt', 'fTags', 'fCover', 'fBody', 'fSlug'].forEach(function (id) {
      $(id).addEventListener('input', function () {
        state.dirty = true;
        updateCounts();
        renderPreview();
      });
    });

    // Warn before losing work on a reload or a closed tab.
    window.addEventListener('beforeunload', function (e) {
      if (state.dirty && state.user) {
        e.preventDefault();
        e.returnValue = '';
      }
    });

    /**
     * Decide what to show for a given user.
     *
     * Called on load and again whenever auth state changes, because an OAuth
     * return does not necessarily resolve by the time getSession() first runs:
     * supabase-js parses the session out of the URL asynchronously, so the
     * first read can come back empty even though the sign-in succeeded.
     */
    async function gate(user) {
      if (!user) { show('login'); return; }

      if (user.app_metadata && user.app_metadata.role === 'admin') {
        state.user = user;
        show('dash');
        loadPosts();
        return;
      }

      // Signed in, but not the owner. Say who they are so the owner can be
      // told which account to promote — a bare "not an admin" leaves them
      // guessing which identity GitHub actually handed over.
      var who = user.email || (user.user_metadata && user.user_metadata.user_name) || user.id;
      await db.auth.signOut();
      state.user = null;
      show('login');
      var msg = $('loginMsg');
      msg.textContent = 'Signed in as ' + who + ' — that account is not an admin.';
      msg.classList.remove('hidden');
    }

    /**
     * Sign-in on load.
     *
     * The order here is the whole fix. Two earlier attempts failed because of
     * timing, not logic:
     *
     *   1. getSession() was called before supabase-js finished parsing the URL
     *      hash, so it returned null even though the tokens were right there.
     *   2. setSession() was fired without being awaited, and onAuthStateChange
     *      was registered *after* it — so the SIGNED_IN event it emitted could
     *      fire before any listener existed to hear it.
     *
     * Either way the page fell through to the login form with a perfectly valid
     * session sitting in the URL. So: read the hash ourselves, await the result,
     * and decide from that directly. No event has to arrive for this to work.
     */
    // Captured once, before anything clears it. Both the error path and the
    // token path read from this rather than re-reading a hash we may have wiped.
    var initialHash = window.location.hash || '';

    /**
     * Surface a provider error instead of silently showing the login form.
     *
     * When a redirect back from a provider is rejected — which is exactly what
     * happens when an OAuth app's callback URL points at a different project —
     * the reason arrives in the URL fragment and there is no session. Without
     * this that is indistinguishable from "nothing happened", which is the
     * least useful thing a login page can do.
     */
    if (initialHash.indexOf('error') !== -1) {
      var errParams = new URLSearchParams(initialHash.replace(/^#/, ''));
      var why = errParams.get('error_description') || errParams.get('error');
      if (why) {
        var errMsg = $('loginMsg');
        errMsg.textContent = 'Sign-in did not complete: ' + why.replace(/\+/g, ' ');
        errMsg.classList.remove('hidden');
      }
    }

    function readHashTokens() {
      var hash = initialHash;
      if (hash.indexOf('access_token') === -1) return null;
      var p = new URLSearchParams(hash.replace(/^#/, ''));
      var accessToken = p.get('access_token');
      var refreshToken = p.get('refresh_token');
      if (!accessToken || !refreshToken) return null;
      var expiresIn = parseInt(p.get('expires_in'), 10) || 3600;
      return {
        access_token: accessToken,
        token_type: p.get('token_type') || 'bearer',
        expires_in: expiresIn,
        expires_at: parseInt(p.get('expires_at'), 10) ||
                    Math.floor(Date.now() / 1000) + expiresIn,
        refresh_token: refreshToken
      };
    }

    // Registered before anything can emit an event, so nothing is missed.
    // The callback does not await — awaiting inside it deadlocks supabase-js v2.
    db.auth.onAuthStateChange(function (_event, session) {
      if (session && session.user) setTimeout(function () { gate(session.user); }, 0);
    });

    var tokens = readHashTokens();
    var signedIn = null;

    if (tokens) {
      // Clear the hash first. If setSession throws, the tokens are not left
      // sitting in the address bar to be replayed on every refresh.
      history.replaceState(null, '', window.location.pathname);
      try {
        var set = await db.auth.setSession(tokens);
        if (set && set.data && set.data.session && set.data.session.user) {
          signedIn = set.data.session.user;
        } else if (set && set.error) {
          var msg = $('loginMsg');
          msg.textContent = 'That sign-in link could not be used: ' + set.error.message;
          msg.classList.remove('hidden');
        }
      } catch (err) {
        var m = $('loginMsg');
        m.textContent = 'That sign-in link could not be used.';
        m.classList.remove('hidden');
      }
    }

    // Only consult stored state when the URL did not carry a session.
    if (!signedIn) {
      var got = await db.auth.getSession();
      signedIn = got && got.data && got.data.session ? got.data.session.user : null;
    }

    await gate(signedIn);
  });
})();
