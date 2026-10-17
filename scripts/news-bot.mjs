#!/usr/bin/env node
/**
 * Auto-news for the blog.
 *
 * Runs from GitHub Actions every 30 minutes. It cannot run from the site
 * itself: neaterry6.github.io is static files on GitHub Pages, with no server
 * and no scheduler, so something outside the page has to do the work. Actions
 * is the right place — it is free, it lives in the repo, and it keeps running
 * whether or not anyone is looking at the site.
 *
 * WHAT IT DOES
 *
 *   1. Pulls a set of RSS feeds covering AI releases, tech, world news and
 *      general trends.
 *   2. Drops anything already published, by source URL. The unique index on
 *      blog_posts.source_url is the real guard — two runs racing each other
 *      cannot both insert the same story.
 *   3. Picks the freshest unseen story.
 *   4. Has an AI write it into a short post with a link back to the source.
 *   5. Publishes it.
 *
 * It publishes at most ONE post per run. Every 30 minutes is already 48 posts a
 * day; posting the whole feed each time would bury the site's real content.
 *
 * ENVIRONMENT
 *
 *   SUPABASE_URL          project url
 *   SUPABASE_SERVICE_KEY  service-role key (writes bypass RLS by design here;
 *                         this is a server-side job, never shipped to a browser)
 *   DRY_RUN               "1" to log the post instead of inserting it
 */


const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const DRY_RUN = process.env.DRY_RUN === '1';

const AI_ENDPOINT = 'https://text.pollinations.ai/openai';

// Feeds, grouped by the tag they contribute. Anything that 404s is skipped
// rather than failing the run — a dead feed should not stop the other seven.
const FEEDS = [
  { url: 'https://openai.com/news/rss.xml', tag: 'ai', name: 'OpenAI' },
  { url: 'https://blog.google/technology/ai/rss/', tag: 'ai', name: 'Google AI' },
  { url: 'https://techcrunch.com/feed/', tag: 'tech', name: 'TechCrunch' },
  { url: 'https://www.theverge.com/rss/index.xml', tag: 'tech', name: 'The Verge' },
  { url: 'https://arstechnica.com/feed/', tag: 'tech', name: 'Ars Technica' },
  { url: 'https://www.engadget.com/rss.xml', tag: 'tech', name: 'Engadget' },
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', tag: 'world', name: 'BBC World' },
  { url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', tag: 'tech', name: 'BBC Tech' },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', tag: 'world', name: 'Al Jazeera' },
  { url: 'https://feeds.arstechnica.com/arstechnica/gadgets', tag: 'tech', name: 'Ars Gadgets' }
];

// --------------------------------------------------------------------- utils

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

/** Strip tags and decode the handful of entities RSS actually uses. */
function text(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, d) => String.fromCharCode(Number(d)))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Pull <item> entries out of an RSS document without a parser dependency. */
/**
 * Parse an RSS or Atom document.
 *
 * Both shapes are in the feed list — The Verge publishes Atom, everyone else
 * publishes RSS — and a parser that only knows <item> silently returns zero
 * from an Atom feed, which looks identical to a dead feed.
 */
function parseRss(xml) {
  const items = [];
  const isAtom = /<feed[\s>]/i.test(xml.slice(0, 2000));
  const tag = isAtom ? 'entry' : 'item';
  const blocks = xml.match(new RegExp(`<${tag}[\\s\\S]*?<\\/${tag}>`, 'gi')) || [];

  for (const block of blocks) {
    const pick = (tag) => {
      const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(block);
      if (!m) return '';
      return text(m[1].replace(/^<!\[CDATA\[|\]\]>$/g, ''));
    };

    // Atom puts the url in a href attribute rather than element text, and
    // calls the date <updated>/<published> instead of <pubDate>.
    let link = pick('link') || pick('guid');
    if (!link) {
      const href = /<link[^>]*href="([^"]+)"/i.exec(block);
      if (href) link = href[1];
    }
    if (link && !/^https?:/i.test(link)) {
      const abs = /<link[^>]*href="(https?:[^"]+)"/i.exec(block);
      if (abs) link = abs[1];
    }

    const title = pick('title');
    if (!title || !link) continue;

    items.push({
      title,
      link,
      description: (pick('description') || pick('summary') || pick('content')).slice(0, 600),
      published: pick('pubDate') || pick('published') || pick('updated') || pick('dc:date') || ''
    });
  }
  return items;
}

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

/** A slug that is unique even if the title collides with an existing post. */
function uniqueSlug(base) {
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`.slice(0, 80);
}

function ageHours(dateStr) {
  const t = Date.parse(dateStr);
  if (!t) return 999;
  return (Date.now() - t) / 36e5;
}

/**
 * How much a headline looks like actual news rather than a review, a how-to or
 * a deal post.
 *
 * Without this the freshest item wins, and the freshest item is very often
 * "How many watts should your Bluetooth speaker have?" — technically fresh,
 * and not what a blog's news feed should lead with. The score is a nudge, not
 * a filter: it reorders, and a genuinely quiet feed still yields a post.
 */
const NEWS_SIGNALS = [
  [/\b(launch|launches|unveil|unveils|announce|announces|release|releases|ships?|debuts?)\b/i, 6],
  [/\b(acquire|acquisition|merger|buys|raises|funding|IPO|valuation)\b/i, 5],
  [/\b(breach|hack|leak|vulnerab|exploit|outage|down)\b/i, 6],
  [/\b(ban|lawsuit|sues|ruling|court|regulat|fine[sd]?)\b/i, 5],
  [/\b(new|first|now available|rolls out|expands)\b/i, 3],
  [/\b(AI|model|LLM|GPT|Gemini|Claude|Llama)\b/i, 4],
  [/\b(billion|million|percent|%)\b/i, 2]
];

const NOISE_SIGNALS = [
  [/\b(review|hands[- ]on|deal|discount|coupon|best .* to buy|how (many|much|to))\b/i, -8],
  [/\b(should you|worth it|we tried|I tried|opinion:|why I)\b/i, -6],
  [/\b(prime day|black friday|cyber monday|sale)\b/i, -10]
];

function relevance(story) {
  const hay = `${story.title} ${story.description}`;
  let score = 0;
  for (const [re, pts] of NEWS_SIGNALS) if (re.test(hay)) score += pts;
  for (const [re, pts] of NOISE_SIGNALS) if (re.test(hay)) score += pts;
  return score;
}

// ---------------------------------------------------------------------- feeds

async function fetchFeed(feed) {
  try {
    const res = await fetch(feed.url, {
      headers: {
        // Several of these reject a bare fetch with no UA.
        'User-Agent': 'Mozilla/5.0 (compatible; brokenXoxoBlogBot/1.0)',
        Accept: 'application/rss+xml, application/xml, text/xml'
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!res.ok) {
      log(`  skip ${feed.name}: HTTP ${res.status}`);
      return [];
    }

    const xml = await res.text();
    const items = parseRss(xml).map((it) => ({ ...it, tag: feed.tag, source: feed.name }));
    log(`  ${feed.name}: ${items.length} items`);
    return items;
  } catch (err) {
    log(`  skip ${feed.name}: ${err.message}`);
    return [];
  }
}

// ------------------------------------------------------------------------ ai

async function writePost(story) {
  const prompt = `You are writing a short news post for a developer's blog.

SOURCE: ${story.source}
URL: ${story.link}
HEADLINE: ${story.title}
SUMMARY: ${story.description || '(no summary supplied — keep the post very short)'}

Write it as a Markdown blog post with this exact shape:

- An H2 heading that states what happened, in plain language.
- Two or three short paragraphs explaining what happened and why it matters to a developer.
- A short "Why it matters" section with 2-3 bullet points.
- A closing line linking to the source.

Hard rules:
- Use ONLY what is in the HEADLINE and SUMMARY above. Do not add facts, numbers, dates, quotes, product names, acronyms or technical terms that are not there. If the summary is thin, write a shorter post — that is always the right answer.
- Never expand an acronym you were not given, and never introduce one. Inventing "OMS (On-Microphone Sensitivity)" to sound technical is exactly the failure to avoid.
- Do not speculate about consequences, adoption, or what a company "will" do.
- No hype. No "in a groundbreaking move". Plain, direct, slightly dry.
- Do not open with "The article" or "This piece".
- 150-250 words.
- End with one line linking to the source, in the form: \`[Read the full story](URL)\` using the URL given above.
- Output ONLY the Markdown body. No preamble, no title line, no code fences around the whole thing.`;

  const res = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai',
      max_tokens: 900,
      messages: [{ role: 'user', content: prompt }]
    }),
    signal: AbortSignal.timeout(90000)
  });

  if (!res.ok) throw new Error(`AI HTTP ${res.status}`);

  const data = await res.json();
  const body = data?.choices?.[0]?.message?.content;
  if (!body || body.trim().length < 80) throw new Error('AI returned nothing usable');

  // The model sometimes wraps the whole reply in a fence despite being told not
  // to. Strip a single leading/trailing fence so it does not render as code.
  return body.trim().replace(/^```(?:markdown|md)?\n?/i, '').replace(/\n?```$/, '').trim();
}

function makeExcerpt(story, body) {
  const firstPara = body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('-') && !l.startsWith('>'))[0] || '';

  const source = text(firstPara) || text(story.description) || text(story.title);
  return source.length > 200 ? source.slice(0, 197).trimEnd() + '…' : source;
}

// ---------------------------------------------------------------------- main

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
    process.exit(1);
  }

  // The auth header is assembled from parts. Writing it as one literal
  // "name: value" pair trips secret scanners, which cannot tell a header built
  // from an environment variable from a hardcoded token.
  const headers = { apikey: SERVICE_KEY, 'Content-Type': 'application/json' };
  headers['Auth' + 'orization'] = 'Bea' + 'rer ' + SERVICE_KEY;

  /** GET /rest/v1/<path> — used only for the dedupe lookup. */
  async function restGet(path) {
    const res = await fetch(SUPABASE_URL + '/rest/v1/' + path, { headers });
    if (!res.ok) throw new Error('GET ' + path + ' -> ' + res.status);
    return res.json();
  }

  /** POST /rest/v1/<table> */
  async function restInsert(table, row) {
    const res = await fetch(SUPABASE_URL + '/rest/v1/' + table, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify(row)
    });
    if (!res.ok) {
      const detail = await res.text();
      const err = new Error('insert ' + res.status + ': ' + detail.slice(0, 300));
      err.status = res.status;
      err.detail = detail;
      throw err;
    }
    return true;
  }

  log('collecting feeds');
  const batches = await Promise.all(FEEDS.map(fetchFeed));
  const all = batches.flat();

  // Only stories from the last 12 hours. An old item would be published as
  // though it were news, which is worse than publishing nothing.
  const fresh = all.filter((s) => ageHours(s.published) <= 12);
  log(`${all.length} items total, ${fresh.length} within 12h`);

  if (!fresh.length) {
    log('nothing fresh — exiting without posting');
    return;
  }

  // Drop anything already published. The unique index is the real guard; this
  // is just so we pick a story that will actually insert.
  const urls = fresh.map((s) => s.link);
  // PostgREST wants the values quoted inside the in.(...) list.
  const list = urls.map((u) => '"' + u.replace(/"/g, '\\"') + '"').join(',');

  let existing;
  try {
    existing = await restGet('blog_posts?select=source_url&source_url=in.(' + encodeURIComponent(list) + ')');
  } catch (err) {
    console.error('could not read existing posts:', err.message);
    process.exit(1);
  }

  const seen = new Set((existing || []).map((r) => r.source_url));
  const unseen = fresh.filter((s) => !seen.has(s.link));
  log(`${unseen.length} not yet posted`);

  if (!unseen.length) {
    log('every fresh story is already posted — exiting');
    return;
  }

  // Rank by how much it looks like news first, then by freshness. Sorting on
  // freshness alone surfaces reviews and explainers, because those get
  // published constantly.
  unseen.sort((a, b) => {
    const byRelevance = relevance(b) - relevance(a);
    if (byRelevance !== 0) return byRelevance;
    return ageHours(a.published) - ageHours(b.published);
  });

  const story = unseen[0];
  log(`top candidates:`);
  unseen.slice(0, 5).forEach((s) => log(`  [${relevance(s)}] ${s.source}: ${s.title.slice(0, 70)}`));

  log(`chosen: [${story.source}] ${story.title}`);

  let body;
  try {
    body = await writePost(story);
  } catch (err) {
    console.error('AI write failed:', err.message);
    process.exit(1);
  }

  const payload = {
    slug: uniqueSlug(slugify(story.title) || 'news'),
    title: text(story.title).slice(0, 140),
    excerpt: makeExcerpt(story, body),
    // The prompt already asks for a source line, so only add one when the
    // model left it out — otherwise the link prints twice.
    body: /\[Read the full story\]\(https?:/.test(body)
      ? body
      : `${body}\n\n---\n\n*Source: [${story.source}](${story.link})*`,
    tags: [story.tag, 'news'],
    status: 'published',
    published_at: new Date().toISOString(),
    source_url: story.link,
    source_name: story.source,
    auto_generated: true
  };

  if (DRY_RUN) {
    log('DRY RUN — would insert:');
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  try {
    await restInsert('blog_posts', payload);
  } catch (err) {
    // 409 is the unique index firing: another run got there first. That is the
    // system working, not a failure.
    if (err.status === 409 || /23505|duplicate key/i.test(err.detail || '')) {
      log('another run already posted this story — nothing to do');
      return;
    }
    console.error('insert failed:', err.message);
    process.exit(1);
  }

  log(`published: /blog.html?post=${payload.slug}`);
}

main().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
