#!/usr/bin/env node
/**
 * Generates the secondary pages: projects.html, uses.html, now.html,
 * guestbook.html.
 *
 * They share a shell — nav, footer, head, meta — and only differ in the body
 * between them. Writing four near-identical HTML files by hand means four
 * places to update the nav and four chances for them to drift apart, so the
 * shell lives here once and the content is declared below.
 *
 * Run: node scripts/build-pages.mjs
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://neaterry6.github.io';

const NAV = [
  ['/', 'Home', 'home'],
  ['/projects.html', 'Projects', 'projects'],
  ['/blog.html', 'Blog', 'blog'],
  ['/uses.html', 'Uses', 'uses'],
  ['/now.html', 'Now', 'now'],
  ['/guestbook.html', 'Guestbook', 'guestbook']
];

function shell({ slug, title, description, body }) {
  const navLinks = NAV.map(([href, label, key]) =>
    `        <a href="${href}"${key === slug ? ' class="active"' : ''}>${label}</a>`
  ).join('\n');

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} — brokenXoxo</title>
    <meta name="description" content="${description}">
    <meta name="theme-color" content="#050508">
    <link rel="canonical" href="${SITE}/${slug}.html">

    <meta property="og:type" content="website">
    <meta property="og:site_name" content="brokenXoxo">
    <meta property="og:url" content="${SITE}/${slug}.html">
    <meta property="og:title" content="${title} — brokenXoxo">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${SITE}/og-image.png">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title} — brokenXoxo">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${SITE}/og-image.png">

    <link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
    <link rel="icon" href="/logo-mark.svg" type="image/svg+xml">
    <link rel="apple-touch-icon" href="/apple-touch-icon.png">

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/assets/pages.css">
</head>
<body>
    <div class="bg-grid"></div>

    <nav class="nav">
        <div class="nav-inner">
            <a href="/" class="brand">
                <img src="/logo-mark.svg" alt="">
                <span>broken<em>Xoxo</em></span>
            </a>
            <div class="nav-links">
${navLinks}
                <a href="https://github.com/Neaterry6" target="_blank" rel="noopener" class="nav-cta">GitHub</a>
            </div>
        </div>
    </nav>

    <main>
${body}
    </main>

    <footer>
        &copy; 2020&ndash;${new Date().getFullYear()} Heisbroken &middot;
        <a href="/">Home</a> &middot;
        <a href="/blog.html">Blog</a> &middot;
        <a href="https://github.com/Neaterry6" target="_blank" rel="noopener">GitHub</a>
    </footer>
</body>
</html>
`;
}

// --------------------------------------------------------------- projects

const PROJECTS = [
  ['SnippetLab', 'Full-stack', 'Community shelf for code snippets. Realtime chatroom with voice notes, replies and reactions, saved snippets, comments, per-snippet reader lists, an inbox for script requests, admin moderation, and a Cmd-K palette.', ['Supabase', 'Realtime', 'RLS'], 'https://snippetlab-neaterry6s-projects.vercel.app'],
  ['Broken-agent', 'AI', 'AI chat workspace with a code editor, live preview pane, admin dashboard and multi-model routing.', ['AI', 'Multi-model'], 'https://broken-agent.vercel.app'],
  ['whatapp-ai', 'AI', 'WhatsApp AI assistant with tool calling, media handling and conversation memory.', ['Baileys', 'Tool calling'], null],
  ['SL-FLIX-WEB', 'Streaming', 'Streaming front end and API layer for movies and series, with HLS playback.', ['TypeScript', 'HLS'], 'https://sl-flix-web.vercel.app'],
  ['StreamMe', 'Streaming', 'Streaming site with a live chatroom.', ['Realtime'], 'https://streamme-chatroom-id.vercel.app'],
  ['Jespire Stories', 'Web app', 'Writer platform on Next.js and Firebase — drafts, publishing and reader feeds.', ['Next.js 14', 'Firebase'], 'https://jespire-stories-ssl1.vercel.app/feed'],
  ['DIRE\'S Bakes & Fries', 'Client work', 'Bakery storefront — cakes, small chops and event decorations, with a catalogue and ordering flow.', ['E-commerce'], 'https://bakes-fries-and-co.vercel.app'],
  ['Glamour Africa', 'Client work', 'Fashion and beauty site built for the African market.', ['Web'], 'https://glamour.vercel.app'],
  ['Spyro Sticker Store', 'Web app', 'Sticker pack store for SpyroChat — browsable packs with a download flow.', ['Web'], 'https://stickers-delta-one.vercel.app'],
  ['Anon VZN', 'Web app', 'Anonymous messaging front end — minimal, built for quick drop-and-go notes.', ['Web'], 'https://anon-vzn.vercel.app'],
  ['neon-breakout', 'Game', 'Neon arcade breakout in a single dependency-free HTML file, with a regression test suite.', ['Canvas', 'Zero deps', 'Tested'], null],
  ['music-movie-search-API', 'API', 'Unified search API across music and film catalogues.', ['REST'], null],
  ['translator-api', 'API', 'Multi-language translation service, also shipped as the zero-dependency broken-translate package.', ['REST'], null],
  ['roast-api', 'API', 'Roast API with five tones and per-user personalisation.', ['REST'], null],
  ['blocklist-manager', 'Tool', 'Phone blocklist manager with import and export.', ['Node.js'], null]
];

const NPM = [
  ['broken-anime-api', 'Real anime data — search, characters, trending and recommendations.'],
  ['broken-anime', 'Anime images and 59 reaction GIFs. No API key needed.'],
  ['broken-anime-card', 'Renders anime character trading cards as SVG.'],
  ['broken-anime-card-api', 'Self-hosted card REST API — real data, no headless browser.'],
  ['broken-manga', 'Manga search, chapters and page images.'],
  ['broken-hentai', 'Adult image search across four keyless providers.'],
  ['broken-lyrics', 'Lyrics lookup and synced LRC parsing.'],
  ['broken-translate', 'Translation with auto-detect, batch and long-text support.'],
  ['broken-roasts', 'Roast generator, five flavours, works offline.'],
  ['broken-wa-api', 'WhatsApp API and SDK on Baileys — multi-session, buttons, webhooks.']
];

function projectCard([name, kind, desc, tags, url]) {
  const tagHtml = tags.map((t) => `<span class="tag">${t}</span>`).join('');
  const inner = `
                <div class="card-top">
                    <h3>${name}</h3>
                    <span class="badge">${kind}</span>
                </div>
                <p>${desc}</p>
                <div class="tags">${tagHtml}</div>`;

  return url
    ? `            <a class="card" href="${url}" target="_blank" rel="noopener">${inner}\n            </a>`
    : `            <div class="card">${inner}\n            </div>`;
}

const projectsBody = `        <div class="eyebrow">Everything</div>
        <h1>Projects</h1>
        <p class="lede">Platforms, APIs and client work. Most of the packages are zero-dependency by choice — fewer things to break.</p>

        <h2>Published on npm &middot; 10 packages</h2>
        <div class="grid grid-2">
${NPM.map(([name, desc]) => `            <a class="card" href="https://www.npmjs.com/package/${name}" target="_blank" rel="noopener">
                <h3>${name}</h3>
                <p>${desc}</p>
                <code class="mono">npm i ${name}</code>
            </a>`).join('\n')}
        </div>

        <h2>Platforms &amp; products</h2>
        <div class="grid grid-2">
${PROJECTS.map(projectCard).join('\n')}
        </div>`;

// ------------------------------------------------------------------- uses

const USES = [
  ['Languages', [
    ['JavaScript / Node.js', 'Where most of the work happens.'],
    ['Python', 'Scraping, scripting, anything with an awkward API.'],
    ['TypeScript', 'When a project is big enough that types pay for themselves.'],
    ['SQL', 'Postgres for anything with real state.']
  ]],
  ['Backend', [
    ['Express', 'Default for REST APIs. Boring, which is the point.'],
    ['Supabase', 'Postgres, auth, storage and realtime in one. Row-level security does the access control.'],
    ['Baileys', 'WhatsApp protocol library — powers broken-wa-api and the bots.']
  ]],
  ['Frontend', [
    ['Vanilla JS', 'Surprisingly far. Most of these sites ship no framework at all.'],
    ['Tailwind', 'Utility classes, no CSS architecture to maintain.'],
    ['Next.js', 'When a project needs routing, SSR or both.']
  ]],
  ['Scraping', [
    ['Cheerio / BeautifulSoup', 'Static HTML, fast and cheap.'],
    ['Playwright', 'Only when a page genuinely needs a browser.'],
    ['yt-dlp', 'Media extraction. Nothing else comes close.']
  ]],
  ['Tools', [
    ['GitHub Actions', 'CI and scheduled jobs.'],
    ['Vercel', 'Deploys.'],
    ['Supabase Studio', 'Schema changes and query debugging.']
  ]]
];

const usesBody = `        <div class="eyebrow">Toolkit</div>
        <h1>Uses</h1>
        <p class="lede">What I actually reach for. Not a wishlist — things that are in production.</p>

${USES.map(([group, items]) => `        <h2>${group}</h2>
        <div class="grid grid-2">
${items.map(([name, why]) => `            <div class="card">
                <h3>${name}</h3>
                <p>${why}</p>
            </div>`).join('\n')}
        </div>
`).join('\n')}`;

// -------------------------------------------------------------------- now

const nowBody = `        <div class="eyebrow">Right now</div>
        <h1>Now</h1>
        <p class="lede">What I'm building this week. Updated when it changes, not on a schedule.</p>

        <h2>Building</h2>
        <div class="grid">
            <div class="card">
                <div class="card-top"><h3>SnippetLab</h3><span class="badge">Active</span></div>
                <p>Community shelf for code snippets. The chatroom now has voice notes, threaded replies and reactions, and the site has a saved shelf, comments, per-snippet reader lists and a script-request inbox.</p>
                <div class="tags"><span class="tag">Supabase</span><span class="tag">Realtime</span><span class="tag">RLS</span></div>
            </div>
            <div class="card">
                <div class="card-top"><h3>This site</h3><span class="badge">Active</span></div>
                <p>Portfolio with a blog, a grounded AI assistant that answers from a fixed knowledge base, and a news feed that posts itself every 30 minutes.</p>
                <div class="tags"><span class="tag">Static</span><span class="tag">GitHub Actions</span></div>
            </div>
        </div>

        <h2>Recently shipped</h2>
        <div class="grid">
            <div class="card">
                <h3>broken-wa-api</h3>
                <p>WhatsApp API and SDK on Baileys — multi-session, buttons, webhooks. On npm.</p>
            </div>
            <div class="card">
                <h3>SL-FLIX-WEB</h3>
                <p>Streaming front end with HLS playback over a TypeScript API layer.</p>
            </div>
        </div>

        <h2>Open to</h2>
        <div class="grid">
            <div class="card">
                <h3>Freelance and contract work</h3>
                <p>Bots, scrapers, APIs, AI integrations. Email <a href="mailto:akewusholaabdulbakri101@gmail.com" style="color:var(--cyan)">akewusholaabdulbakri101@gmail.com</a> with what you need.</p>
            </div>
            <div class="card">
                <h3>Collaborations</h3>
                <p>If you're building something in the WhatsApp, AI or media space, I'm interested.</p>
            </div>
        </div>`;

// -------------------------------------------------------------- guestbook

const guestbookBody = `        <div class="eyebrow">Say something</div>
        <h1>Guestbook</h1>
        <p class="lede">Leave a note. No account needed — just a name and a message.</p>

        <form id="gbForm" class="card" style="margin-bottom:28px">
            <div style="margin-bottom:12px">
                <label for="gbName" style="display:block;font-size:12px;font-weight:600;color:#8d99ae;margin-bottom:6px">Your name</label>
                <input id="gbName" maxlength="40" required placeholder="Ada"
                    style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:10px;padding:10px 12px;font-size:14px;color:var(--text);outline:none;font-family:inherit">
            </div>
            <div style="margin-bottom:12px">
                <label for="gbBody" style="display:block;font-size:12px;font-weight:600;color:#8d99ae;margin-bottom:6px">Message</label>
                <textarea id="gbBody" rows="3" maxlength="500" required placeholder="Nice site. That chatroom is wild."
                    style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:10px;padding:10px 12px;font-size:14px;color:var(--text);outline:none;resize:vertical;font-family:inherit"></textarea>
            </div>
            <div style="display:flex;align-items:center;gap:12px">
                <button type="submit" id="gbSend"
                    style="padding:10px 20px;border-radius:10px;border:0;background:linear-gradient(135deg,#00f5d4,#00bbf9);color:#050508;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Sign it</button>
                <span id="gbMsg" style="font-size:12px;color:#6b7280"></span>
            </div>
        </form>

        <h2>Messages</h2>
        <div id="gbList" class="grid">
            <div class="empty"><div class="glyph">&#128172;</div><p>Loading…</p></div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
        <script src="/assets/guestbook.js?v=1"></script>`;

// -------------------------------------------------------------------- write

const PAGES = [
  ['projects', 'Projects', 'Everything Heisbroken has shipped — 10 npm packages, platforms, APIs and client work.', projectsBody],
  ['uses', 'Uses', 'The tools and stack Akewushola Heisbroken actually uses in production.', usesBody],
  ['now', 'Now', 'What Heisbroken is building this week, and what he is open to.', nowBody],
  ['guestbook', 'Guestbook', 'Leave a message for Heisbroken. No account needed.', guestbookBody]
];

for (const [slug, title, description, body] of PAGES) {
  const html = shell({ slug, title, description, body });
  writeFileSync(join(ROOT, `${slug}.html`), html);
  console.log(`wrote ${slug}.html  (${html.length.toLocaleString()} bytes)`);
}
