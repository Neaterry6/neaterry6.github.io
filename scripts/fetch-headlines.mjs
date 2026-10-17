#!/usr/bin/env node
/**
 * Pull real headlines + summaries from the news feeds, so the posts that get
 * written are grounded in what the source actually said.
 *
 * This does not publish anything. It prints JSON to stdout and writes a file,
 * and the posts are written from that file. That separation is deliberate:
 * nothing on the blog should be invented, and the only way to guarantee that is
 * to have the source text in front of you when writing.
 */

import { writeFileSync } from 'node:fs';

const FEEDS = [
  { url: 'https://openai.com/news/rss.xml', tag: 'ai', name: '[OI]' },
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

function decode(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pick(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  if (!m) return '';
  return decode(m[1].replace(/<[^>]+>/g, ''));
}

// RSS <item> and Atom <entry> both need handling: The Verge publishes Atom,
// which is why a naive item-only parser silently returns zero from it.
function parse(xml) {
  const out = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  for (const b of blocks) {
    const title = pick(b, 'title');
    let link = pick(b, 'link');
    if (!link) {
      const href = b.match(/<link[^>]+href=["']([^"']+)["']/i);
      link = href ? href[1] : '';
    }
    const desc = pick(b, 'description') || pick(b, 'summary') || pick(b, 'content');
    const date = pick(b, 'pubDate') || pick(b, 'published') || pick(b, 'updated') || '';
    if (title && link) out.push({ title, link, description: desc, date });
  }
  return out;
}

const all = [];
for (const f of FEEDS) {
  try {
    const res = await fetch(f.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; brokenXoxoBlogBot/1.0)',
        Accept: 'application/rss+xml, application/xml, text/xml'
      },
      signal: AbortSignal.timeout(20000)
    });
    if (!res.ok) { console.error(`skip ${f.name}: HTTP ${res.status}`); continue; }
    const items = parse(await res.text());
    console.error(`${f.name}: ${items.length}`);
    for (const it of items) all.push({ ...it, source: f.name, tag: f.tag });
  } catch (e) {
    console.error(`skip ${f.name}: ${e.message}`);
  }
}

// Freshest first. Undated items go last rather than being dropped, since some
// feeds omit the date but are still current.
all.sort((a, b) => {
  const ta = Date.parse(a.date) || 0;
  const tb = Date.parse(b.date) || 0;
  return tb - ta;
});

const seen = new Set();
const fresh = [];
for (const s of all) {
  if (seen.has(s.link)) continue;
  seen.add(s.link);
  fresh.push(s);
}

writeFileSync('/home/Data/news-candidates.json', JSON.stringify(fresh, null, 2));
console.error(`\ntotal unique: ${fresh.length}`);
for (const s of fresh.slice(0, 22)) {
  console.log(`${s.source} | ${s.title}`);
  console.log(`   ${s.description.slice(0, 180) || '(no summary)'}`);
  console.log(`   ${s.link}`);
}
