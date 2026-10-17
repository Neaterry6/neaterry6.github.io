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
  ['/anime.html', 'Anime', 'anime'],
  ['/games.html', 'Games', 'games'],
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
    <link rel="stylesheet" href="/assets/mobile-nav.css">
    <script defer src="/assets/mobile-nav.js"></script>
</body>
</html>
`;
}

// --------------------------------------------------------------- projects

const PROJECTS = [
  ['Hi Photos', 'AI · Image Discovery', 'Pinterest-inspired image platform with AI-powered search and chat. Built with React, Node.js, Express and Supabase.', ['React', 'Node.js', 'Supabase', 'AI'], 'https://hi-photos-production.up.railway.app/'],
  ['BROKEN Movies', 'Streaming', 'Netflix-style platform with real playable movies, TV series, anime, Nollywood, BL and K-Dramas. My List, watch history, quality selector.', ['JavaScript', 'HLS.js', 'REST API'], 'https://neaterry6.github.io/BROKEN-Movies/'],
  ['flixmovies', 'Streaming', 'Modern movie discovery platform with a clean responsive interface. TMDB-backed with direct stream links.', ['React', 'TMDB API'], 'https://flixmovies-production.up.railway.app/'],
  ['Brokenvzn AI', 'AI Assistant', 'Intelligent conversational AI with memory, tool calling and grounded knowledge base. Answers from facts, never invents.', ['React', 'Node.js', 'LLM'], 'https://brokenvzn-ai.vercel.app'],
  ['Codex Agent', 'AI Coding', 'AI coding assistant that helps developers write, understand and improve code. Gemini-powered.', ['React', 'Node.js', 'Gemini'], 'https://codexagent-production.up.railway.app/'],
  ['Phoenix Learn Code', 'Education', 'Interactive coding education platform for learning programming with modern UI and hands-on exercises.', ['React', 'Node.js'], 'https://phoenix-learn-code.vercel.app/'],
  ['Story Writer AI', 'Creative Writing', 'Generate stories and creative writing with Artificial Intelligence. Multi-genre support.', ['React', 'AI'], 'https://my-story-writer-ai.vercel.app/'],
  ['Glamour', 'Fashion & Beauty', 'Elegant beauty and fashion website built with a modern design system.', ['React', 'Tailwind CSS'], 'https://glamour-net.vercel.app/'],
  ['BROKEN API', 'Backend', 'Massive multi-purpose REST API: movie/anime streaming, social video, AI, trading, temp mail, GIFs, analytics, 600+ endpoints.', ['Node.js', 'Express', 'Docker'], 'https://api.brokenvzn.de5.net/'],
  ['Trading Bot', 'Finance', 'Multi-strategy trading bot with real market data, RSI/MA/MACD strategies, backtesting, paper trading and Telegram alerts.', ['Node.js', 'Binance', 'Yahoo Finance'], 'https://github.com/Neaterry6/trading-bot'],
  ['Amazing Bot', 'WhatsApp', 'Powerful multi-device WhatsApp bot with 600+ commands: AI chat, image reactions, downloads, sports, games.', ['WhatsApp', 'Baileys', 'Node.js'], 'https://github.com/Neaterry6/Amazing-Botv2'],
  ['Trust Lab API', 'Backend', 'Movie + live sports API platform with 80+ endpoints, React docs playground frontend and admin panel.', ['Express', 'React', 'Vite'], 'https://github.com/Neaterry6'],
  ['Anon', 'Social', 'Anonymous social platform focused on anonymous messages, social posting and community-style interactions.', ['React', 'Next.js', 'TypeScript'], 'https://anon-v2-indol.vercel.app/'],
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
                <h3>FlixMovies</h3>
                <p>Modern movie discovery platform with a clean responsive interface.</p>
            </div>
            <div class="card">
                <h3>Hi Photos</h3>
                <p>Pinterest-inspired image discovery platform with AI-powered search.</p>
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

// ------------------------------------------------------------------- anime
//
// The list below is the owner's favourites. Metadata — cover art, score,
// episodes, year — is fetched live from Jikan (the public MyAnimeList API) in
// the visitor's browser rather than baked in here. That keeps the page honest:
// covers and scores are current, and nothing is invented. If Jikan is down the
// cards still render with the title and the reason it is on the list.

const FAVOURITE_ANIME = [
  ['Attack on Titan', 'Shingeki no Kyojin', 'The one that got me into seasonal anime. The basement reveal still holds up.'],
  ['Jujutsu Kaisen', 'Jujutsu Kaisen', 'Fight choreography that actually reads on screen. Mappa at full stretch.'],
  ['Demon Slayer', 'Kimetsu no Yaiba', 'Ufotable animation is the whole argument. Watch it for the fights.'],
  ['One Piece', 'One Piece', 'Twenty-plus years and still the best world-building in the medium.'],
  ['Naruto Shippuden', 'Naruto: Shippuuden', 'Grew up on it. The Pain arc is still the high point.'],
  ['Death Note', 'Death Note', 'The first half is a perfect thriller.'],
  ['Fullmetal Alchemist: Brotherhood', 'Hagane no Renkinjutsushi: Fullmetal Alchemist', 'No wasted episodes. The standard everything else gets measured against.'],
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
  ['Solo Leveling', 'Ore dake Level Up na Ken', 'Power fantasy executed properly.'],
  ['Frieren', 'Sousou no Frieren', 'Quiet, melancholy and better written than most of this list.']
];

const ANIME_NOTES = {
  'Attack on Titan': 'The one that got me into seasonal anime. The basement reveal still holds up.',
  'Jujutsu Kaisen': 'Fight choreography that actually reads on screen. Mappa at full stretch.',
  'Demon Slayer': 'Ufotable animation is the whole argument. Watch it for the fights.',
  'One Piece': 'Twenty-plus years and still the best world-building in the medium.',
  'Naruto Shippuden': 'Grew up on it. The Pain arc is still the high point.',
  'Death Note': 'The first half is a perfect thriller.',
  'Fullmetal Alchemist: Brotherhood': 'No wasted episodes. The standard everything else gets measured against.',
  'Steins;Gate': 'Slow first half, then it does not let go.',
  'Hunter x Hunter': 'Best power system in shonen. Chimera Ant arc is a whole genre shift.',
  'Vinland Saga': 'A revenge story that argues against revenge.',
  'Mob Psycho 100': 'The most expressive animation of the last decade.',
  'Chainsaw Man': 'Loud, ugly and completely deliberate about it.',
  'Spy x Family': 'Comfort watch. Anya carries it.',
  'Tokyo Revengers': 'Time loops and gang politics. Messy but it hooks.',
  'Blue Lock': 'Football as a psychological war. Absurd and I love it.',
  'Haikyuu!!': 'The best sports anime, and it is not close.',
  'Dr. Stone': 'Science as the power system. Genuinely educational.',
  'Black Clover': 'Underdog shonen with a great ensemble.',
  'Solo Leveling': 'Power fantasy executed properly.',
  'Frieren': 'Quiet, melancholy and better written than most of this list.'
};

const animeBody = `        <div class="eyebrow">Watchlist</div>
        <h1>Anime</h1>
        <p class="lede">Everything I have actually finished or am keeping up with. Cover art, scores and episode counts come from AniList.</p>

        <div class="filter-row" id="animeFilters">
            <input id="animeSearch" type="search" placeholder="Filter by title..." autocomplete="off">
            <span id="animeCount" class="count"></span>
        </div>

        <div id="animeGrid" class="media-grid">
            <div class="empty"><div class="glyph">&#127916;</div><p>Loading covers…</p></div>
        </div>

        <script>window.ANIME_NOTES = ${JSON.stringify(ANIME_NOTES)};</script>\n        <script src="/assets/anime.js?v=2"></script>`;

// ------------------------------------------------------------------- games
//
// Same approach as the anime page: the list of games is fixed, and the cover
// art comes from the free Steam CDN endpoints. No key, no scraping.

const FAVOURITE_GAMES = [
  ['Minecraft', 'Sandbox', 'The game I always come back to. Building something from nothing, then wiring it with redstone.'],
  ['Call of Duty: Mobile', 'Shooter', 'CODM is the daily one — ranked grind, quick scopes, and the movement ceiling is higher than people give it credit for.'],
  ['Free Fire', 'Battle Royale', 'Fast matches, low device requirements, and the squad play is what keeps it installed.'],
  ['eFootball', 'Football', 'The football game I actually play. Manual defending once you learn it is genuinely rewarding.'],
  ['EA Sports FC', 'Football', 'Career mode and Ultimate Team. The yearly ritual.'],
  ['Valorant', 'Tactical shooter', 'Aim duels and utility. The most punishing game on this list.'],
  ['GTA V', 'Open world', 'Still the benchmark for a city you can just exist in.'],
  ['Among Us', 'Social deduction', 'Only good with the right group, and then it is very good.'],
  ['Clash of Clans', 'Strategy', 'Years in. The base is the save file.'],
  ['Subway Surfers', 'Endless runner', 'The classic time-killer.']
];

const STEAM_IDS = {
  'Minecraft': null,          // not on Steam
  'Call of Duty: Mobile': null,
  'Free Fire': null,
  'eFootball': null,
  'EA Sports FC': null,
  'Valorant': null,
  'GTA V': 271590,
  'Among Us': 945360,
  'Clash of Clans': null,
  'Subway Surfers': null
};

const gamesBody = `        <div class="eyebrow">What I play</div>
        <h1>Games</h1>
        <p class="lede">The rotation. Mostly mobile and football, with a few PC staples that never get uninstalled.</p>

        <h2>Daily</h2>
        <div class="media-grid">
${FAVOURITE_GAMES.slice(0, 5).map(([name, kind, why]) => {
  const id = STEAM_IDS[name];
  const cover = id
    ? `<img loading="lazy" src="https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/header.jpg" alt="${name}" onerror="this.remove()">`
    : `<div class="media-ph">${name.charAt(0)}</div>`;
  return `            <article class="media-card">
                <div class="media-art">${cover}</div>
                <div class="media-body">
                    <span class="tag">${kind}</span>
                    <h3>${name}</h3>
                    <p>${why}</p>
                </div>
            </article>`;
}).join('\n')}
        </div>

        <h2>Also in the rotation</h2>
        <div class="media-grid">
${FAVOURITE_GAMES.slice(5).map(([name, kind, why]) => {
  const id = STEAM_IDS[name];
  const cover = id
    ? `<img loading="lazy" src="https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/header.jpg" alt="${name}" onerror="this.remove()">`
    : `<div class="media-ph">${name.charAt(0)}</div>`;
  return `            <article class="media-card">
                <div class="media-art">${cover}</div>
                <div class="media-body">
                    <span class="tag">${kind}</span>
                    <h3>${name}</h3>
                    <p>${why}</p>
                </div>
            </article>`;
}).join('\n')}
        </div>`;

// -------------------------------------------------------------------- write


const PAGES = [
  ['projects', 'Projects', 'Everything Heisbroken has shipped — 10 npm packages, platforms, APIs and client work.', projectsBody],
  ['uses', 'Uses', 'The tools and stack Akewushola Heisbroken actually uses in production.', usesBody],
  ['now', 'Now', 'What Heisbroken is building this week, and what he is open to.', nowBody],
  ['guestbook', 'Guestbook', 'Leave a message for Heisbroken. No account needed.', guestbookBody],
  ['anime', 'Anime', 'Anime Heisbroken has watched and is keeping up with, with live cover art and scores.', animeBody],
  ['games', 'Games', 'The games Heisbroken actually plays — Minecraft, CODM, Free Fire, eFootball and more.', gamesBody]
];

for (const [slug, title, description, body] of PAGES) {
  const html = shell({ slug, title, description, body });
  writeFileSync(join(ROOT, `${slug}.html`), html);
  console.log(`wrote ${slug}.html  (${html.length.toLocaleString()} bytes)`);
}
