/* ==========================================================================
   Neaterry6 Assistant — the chat widget on the portfolio

   The old widget sent the visitor's raw message to a public text endpoint and
   printed whatever came back. It had no system prompt, so it knew nothing
   about Heisbroken: ask it "what has he built?" and it would invent something
   or answer about the model itself.

   This replaces that with a grounded assistant. Every fact below is taken from
   the portfolio and the repos, and the model is told to answer only from it.
   If something is not in the knowledge base it says so and points at the
   contact details, rather than guessing — a portfolio assistant that
   hallucinates a fake project is worse than no assistant.

   Two other things the old widget got wrong:

   * It had no memory. Every message was sent alone, so "what about the
     second one?" had nothing to refer to. The conversation is now carried
     and trimmed.
   * It used the URL-path endpoint, which has a hard length limit. A system
     prompt of this size cannot go through a query string, so this posts to
     the chat-completions endpoint instead.
   ========================================================================== */
(function () {
  'use strict';

  // ---------------------------------------------------------------- knowledge

  var PROFILE = {
    name: 'Akewushola Abdulbakri Temitope',
    alias: 'Heisbroken',
    handle: 'brokenXoxo',
    github: '@neaterry6',
    role: 'Full-stack developer and AI engineer',
    location: 'Nigeria',
    email: 'akewusholaabdulbakri101@gmail.com',
    whatsapp: '+234 812 047 8393',
    instagram: '@broken_vzn',
    tiktok: '@bnlsquad_boybroken',
    site: 'https://neaterry6.github.io',
    status: 'Available for opportunities',
    bio: 'Builds WhatsApp automation, AI agents and open-source APIs. Prefers shipping something people actually use over polishing something nobody opens.',
    repos: '50+',
    npmPackages: 10
  };

  var NPM_PACKAGES = [
    ['broken-anime-api', 'Anime', 'Real anime data — search, characters, trending and recommendations.'],
    ['broken-anime', 'Anime', 'Anime images and 59 reaction GIFs. No API key needed.'],
    ['broken-anime-card', 'Anime', 'Renders anime character trading cards as SVG.'],
    ['broken-anime-card-api', 'Anime', 'Self-hosted card REST API — real data, no headless browser.'],
    ['broken-manga', 'Manga', 'Manga search, chapters and page images.'],
    ['broken-hentai', '18+', 'Adult image search across four keyless providers.'],
    ['broken-lyrics', 'Media', 'Lyrics lookup and synced LRC parsing.'],
    ['broken-translate', 'Utility', 'Translation with auto-detect, batch and long-text support.'],
    ['broken-roasts', 'Utility', 'Roast generator, five flavours, works offline.'],
    ['broken-wa-api', 'WhatsApp', 'WhatsApp API and SDK on Baileys — multi-session, buttons, webhooks.']
  ];

  var PLATFORMS = [
    ['Broken-agent', 'JavaScript · AI workspace',
      'AI chat workspace with a code editor, a live preview pane and an admin dashboard, with multi-model routing.',
      'https://broken-agent.vercel.app'],
    ['SnippetLab', 'JavaScript · Supabase',
      'A community shelf for code snippets. Real-time chatroom with voice notes, replies and reactions; saved snippets, comments, per-snippet reader lists, an inbox for script requests, admin moderation, and a Cmd-K command palette.',
      'https://snippetlab-neaterry6s-projects.vercel.app'],
    ['whatapp-ai', 'JavaScript · WhatsApp AI',
      'WhatsApp AI assistant with tool calling, media handling and conversation memory.',
      null],
    ['SL-FLIX-WEB', 'TypeScript · Streaming',
      'Streaming front end and API layer for movies and series, with HLS playback.',
      'https://sl-flix-web.vercel.app'],
    ['StreamMe', 'JavaScript · Live chat',
      'Streaming site with a live chatroom.',
      'https://streamme-chatroom-id.vercel.app'],
    ['Glamour Africa', 'JavaScript · Web app',
      'Fashion and beauty site for the African market.',
      'https://glamour.vercel.app'],
    ['neon-breakout', 'HTML · Canvas game',
      'Neon arcade breakout in a single dependency-free HTML file, with a regression test suite.',
      null],
    ['jespire-stories', 'TypeScript · Next.js 14',
      'Writer platform on Next.js and Firebase — drafts, publishing and reader feeds.',
      null],
    ['broken-anime-demo', 'HTML · Live demo',
      'Live demo of anime character cards generated as pure SVG, straight from the API.',
      null],
    ['music-movie-search-API', 'JavaScript · REST API',
      'Unified search API across music and film catalogues.',
      null],
    ['translator-api', 'JavaScript · REST API',
      'Multi-language translation service, also shipped as the zero-dependency broken-translate package.',
      null],
    ['roast-api', 'JavaScript · REST API',
      'Roast API with five tones and per-user personalisation.',
      null],
    ['blocklist-manager', 'Node.js · Tool',
      'Phone blocklist manager with import and export.',
      null]
  ];

  var SKILLS = [
    ['JavaScript / Node.js', 95],
    ['Baileys / WhatsApp API', 90],
    ['Express / REST APIs', 88],
    ['Web scraping', 87],
    ['Python', 85],
    ['AI / machine learning', 82]
  ];

  var FAQ = [
    ['hire', 'He is available for freelance and contract work, and open to collaborations. Email ' + PROFILE.email + ' or message him on WhatsApp at ' + PROFILE.whatsapp + '.'],
    ['cost', 'Rates depend on scope. Email ' + PROFILE.email + ' with what you need and he will quote it.'],
    ['stack', 'JavaScript and Node.js are his strongest, with Baileys for WhatsApp, Express for APIs, Python for scraping and AI work. He ships a lot of zero-dependency libraries.'],
    ['best', 'SnippetLab and Broken-agent are the two most complete builds — SnippetLab for full-stack product work with a real database, Broken-agent for AI tooling.']
  ];

  // ---------------------------------------------------------------- prompt

  function knowledgeText() {
    var lines = [];

    lines.push('NAME: ' + PROFILE.name + ' (goes by ' + PROFILE.alias + ', handle ' + PROFILE.handle + ')');
    lines.push('ROLE: ' + PROFILE.role);
    lines.push('LOCATION: ' + PROFILE.location);
    lines.push('STATUS: ' + PROFILE.status);
    lines.push('GITHUB: ' + PROFILE.github + ' — ' + PROFILE.repos + ' original repositories');
    lines.push('EMAIL: ' + PROFILE.email);
    lines.push('WHATSAPP: ' + PROFILE.whatsapp);
    lines.push('INSTAGRAM: ' + PROFILE.instagram);
    lines.push('TIKTOK: ' + PROFILE.tiktok);
    lines.push('PORTFOLIO: ' + PROFILE.site);
    lines.push('BIO: ' + PROFILE.bio);
    lines.push('');

    lines.push('SKILLS (self-rated proficiency):');
    SKILLS.forEach(function (s) { lines.push('- ' + s[0] + ': ' + s[1] + '%'); });
    lines.push('');

    lines.push('NPM PACKAGES (' + PROFILE.npmPackages + ' published, install with "npm i <name>"):');
    NPM_PACKAGES.forEach(function (p) {
      lines.push('- ' + p[0] + ' [' + p[1] + ']: ' + p[2]);
    });
    lines.push('');

    lines.push('PROJECTS:');
    PLATFORMS.forEach(function (p) {
      lines.push('- ' + p[0] + ' (' + p[1] + '): ' + p[2] + (p[3] ? ' Live at ' + p[3] : ''));
    });
    lines.push('');

    lines.push('COMMON QUESTIONS:');
    FAQ.forEach(function (f) { lines.push('- ' + f[0] + ': ' + f[1]); });

    return lines.join('\n');
  }

  function systemPrompt() {
    return [
      'You are the assistant on ' + PROFILE.alias + "'s portfolio site. You speak for him to visitors: recruiters, potential clients, other developers.",
      '',
      'RULES:',
      '1. Answer ONLY from the knowledge below. If something is not covered, say you do not have that detail and point them to ' + PROFILE.email + '. Never invent a project, a client, a job, a metric or a date.',
      '2. Be brief. Two or three sentences, or a short list. This is a chat widget, not an essay.',
      '3. Sound like a sharp developer, not a brochure. No "I hope this helps", no "as an AI", no exclamation-mark enthusiasm.',
      '4. Refer to him in the third person as "' + PROFILE.alias + '" or "he". You are not him.',
      '5. When asked about hiring, availability or rates, always give the real contact details.',
      '6. If asked something personal that is not below (relationships, private life, opinions on people), decline briefly and redirect to his work.',
      '7. If asked to write code, keep it under ~15 lines and make it relevant to something he actually built.',
      '8. Never claim to be a general-purpose assistant. You only know this portfolio.',
      '',
      'KNOWLEDGE:',
      knowledgeText()
    ].join('\n');
  }

  // ---------------------------------------------------------------- chat

  var ENDPOINT = 'https://text.pollinations.ai/openai';
  var MAX_TURNS = 8;         // user+assistant pairs kept, so the payload stays small
  var history = [];          // {role, content}
  var busy = false;

  function $(id) { return document.getElementById(id); }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Render a reply.
   *
   * The model returns plain text with occasional **bold** and `code`, so those
   * two are turned into markup and everything else stays escaped. Building the
   * HTML by string-concatenating the raw model output would let a reply inject
   * markup into the page.
   */
  function renderReply(text) {
    var safe = escapeHtml(text);
    safe = safe.replace(/`([^`]+)`/g, '<code class="px-1 rounded bg-black/40 text-cyan-300">$1</code>');
    safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-white">$1</strong>');
    safe = safe.replace(/\n/g, '<br>');
    return safe;
  }

  function bubble(html, mine) {
    var d = document.createElement('div');
    d.className = mine
      ? 'text-right text-sm text-gray-400 bg-white/5 rounded-lg p-3 ml-12'
      : 'bg-cyan-500/10 rounded-lg p-3 text-sm text-cyan-300 mr-12';
    d.innerHTML = html;
    return d;
  }

  function scrollDown(container) {
    container.scrollTop = container.scrollHeight;
  }

  async function send() {
    var input = $('chat-input');
    var container = $('chat-messages');
    if (!input || !container || busy) return;

    var msg = input.value.trim();
    if (!msg) return;

    container.appendChild(bubble(escapeHtml(msg), true));
    input.value = '';
    scrollDown(container);

    // Typing indicator, removed in every exit path.
    var typing = bubble('…', false);
    typing.id = 'chat-typing';
    container.appendChild(typing);
    scrollDown(container);

    busy = true;
    input.disabled = true;

    try {
      var messages = [{ role: 'system', content: systemPrompt() }]
        .concat(history)
        .concat([{ role: 'user', content: msg }]);

      var res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'openai',
          messages: messages,
          // Keeps replies widget-sized. The system prompt carries the
          // knowledge, so the model does not need room to ramble.
          max_tokens: 400
        })
      });

      // The free tier allows one reply every 30 seconds per IP. That is a
      // normal condition, not a failure, so it gets its own message and a
      // cooldown on the input instead of a generic error.
      if (res.status === 402 || res.status === 429) {
        typing.remove();
        startCooldown(30);
        container.appendChild(bubble(
          'The free assistant is rate-limited to one reply every 30 seconds. ' +
          'Give it a moment, or email <a href="mailto:' + PROFILE.email +
          '" class="underline">' + PROFILE.email + '</a> if you need an answer now.',
          false
        ));
        return;
      }

      if (!res.ok) throw new Error('chat ' + res.status);

      var data = await res.json();
      var choice = data && data.choices && data.choices[0];
      var reply = choice && choice.message && choice.message.content;
      reply = String(reply || '').trim();

      if (!reply) throw new Error('empty reply');

      history.push({ role: 'user', content: msg });
      history.push({ role: 'assistant', content: reply });

      // Trim from the front so the opening turn is what falls off first.
      while (history.length > MAX_TURNS * 2) history.splice(0, 2);

      typing.remove();
      container.appendChild(bubble(renderReply(reply), false));
    } catch (err) {
      typing.remove();
      container.appendChild(bubble(
        'Could not reach the assistant just now. Email ' +
        '<a href="mailto:' + PROFILE.email + '" class="underline">' + PROFILE.email + '</a> instead.',
        false
      ));
    } finally {
      busy = false;
      input.disabled = false;
      input.focus();
      scrollDown(container);
    }
  }

  var cooldownTimer = null;

  /**
   * Disable the composer for a while and count it down.
   *
   * Without this the visitor presses send, gets an error, presses again and
   * gets the same error — the widget looks broken when it is simply throttled.
   */
  function startCooldown(seconds) {
    var input = $('chat-input');
    var button = document.querySelector('[onclick="sendMessage()"]');
    if (!input) return;

    if (cooldownTimer) clearInterval(cooldownTimer);

    var left = seconds;
    input.disabled = true;
    if (button) button.disabled = true;

    function paint() {
      input.placeholder = 'Wait ' + left + 's…';
      if (left <= 0) {
        clearInterval(cooldownTimer);
        cooldownTimer = null;
        input.disabled = false;
        if (button) button.disabled = false;
        input.placeholder = 'Type a message...';
        return;
      }
      left -= 1;
    }

    paint();
    cooldownTimer = setInterval(paint, 1000);
  }

  // ---------------------------------------------------------------- wiring

  window.toggleChat = function () {
    var w = document.querySelector('.chat-window');
    if (!w) return;
    w.classList.toggle('hidden');
    if (!w.classList.contains('hidden')) {
      var i = $('chat-input');
      if (i) i.focus();
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    var input = $('chat-input');
    if (input) {
      input.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') send();
      });
    }
  });

  // Also expose it for the inline handler the markup already uses.
  window.sendMessage = send;
})();
