#!/usr/bin/env node
/**
 * Write news posts from real articles.
 *
 * The rule this enforces: a post may only contain facts present in the article
 * it came from. So the article text is fetched first and handed to the writer
 * as the sole source. Headlines alone are not enough — most of these feeds ship
 * no summary, and a model asked to write from a headline will invent the rest.
 *
 * Output is JSON on stdout. Nothing is published here; publishing is a separate
 * step so the posts can be checked first.
 */

import { writeFileSync } from 'node:fs';

const AI_ENDPOINT = 'https://text.pollinations.ai/openai';

const stories = JSON.parse(process.argv[2] || '[]');
const outPath = process.argv[3] || '/home/Data/news-posts.json';

function strip(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#8217;/g, "'")
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function articleText(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; brokenXoxoBlogBot/1.0)',
      Accept: 'text/html'
    },
    signal: AbortSignal.timeout(25000)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  // Prefer the article body if the page marks one up; otherwise take the whole
  // document and let the paragraph filter below sort it out.
  const bodyMatch =
    html.match(/<article[\s\S]*?<\/article>/i) ||
    html.match(/<main[\s\S]*?<\/main>/i);

  const scope = bodyMatch ? bodyMatch[0] : html;
  const paras = [...scope.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => strip(m[1]))
    .filter((p) => p.length > 60);

  return paras.slice(0, 14).join('\n\n').slice(0, 7000);
}

function slugify(title) {
  return title.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 70);
}

async function write(story, text) {
  const prompt = `You are writing a short news post for a developer's blog.

You have the real article text below. It is your ONLY source.

TITLE: ${story.title}
SOURCE: ${story.source}
URL: ${story.link}

ARTICLE TEXT:
"""
${text}
"""

Write a Markdown blog post with exactly this shape:

## <a heading stating what happened, in plain language>

Two or three short paragraphs on what happened.

**Why it matters**

- 2 to 3 bullets on why a developer should care.

[Read the full story](${story.link})

Hard rules — breaking any of these makes the post worthless:
- Use ONLY facts stated in the article text above. If the article does not say a number, a date, a version, a price or a name, you do not know it. Omit it.
- Never invent an acronym or expand one the article did not expand.
- No speculation about what a company "will" do, no predictions, no adoption guesses.
- No hype phrasing: no "in a groundbreaking move", no "game-changer", no "revolutionary".
- Plain and slightly dry. Short sentences.
- 150-250 words total.
- Output ONLY the Markdown body. No preamble, no title line above the H2, no code fences.`;

  const res = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai',
      max_tokens: 900,
      messages: [{ role: 'user', content: prompt }]
    }),
    signal: AbortSignal.timeout(120000)
  });

  if (!res.ok) {
    const err = new Error(`AI HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  let body = data?.choices?.[0]?.message?.content;
  if (!body || body.trim().length < 120) throw new Error('AI returned nothing usable');

  body = body.trim()
    .replace(/^```(?:markdown|md)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  // Guarantee the source link is present exactly once, even if the model
  // dropped it or rewrote the URL.
  body = body.replace(/\[Read the full story\]\([^)]*\)/gi, '').trim();
  body += `\n\n[Read the full story](${story.link})`;

  return body;
}

const results = [];

for (const story of stories) {
  try {
    console.error(`\n-> ${story.source}: ${story.title.slice(0, 70)}`);
    const text = await articleText(story.link);
    if (text.length < 400) {
      console.error(`   SKIP: only ${text.length} chars of article text`);
      continue;
    }
    console.error(`   ${text.length} chars of source text`);

    let body;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        body = await write(story, text);
        break;
      } catch (e) {
        // 402 is the free tier's rolling window, not a permanent failure.
        if (e.status === 402 && attempt < 4) {
          console.error(`   retry ${attempt} after rate limit`);
          await new Promise((r) => setTimeout(r, 20000));
          continue;
        }
        throw e;
      }
    }

    // The first line of body should be the H2; the title is that heading with
    // the markdown stripped, so the card and the page agree.
    const h2 = (body.match(/^##\s+(.+)$/m) || [])[1] || story.title;

    results.push({
      slug: slugify(h2) || slugify(story.title),
      title: h2.replace(/\*\*/g, '').trim().slice(0, 100),
      body,
      source_url: story.link,
      source_name: story.source,
      tags: [story.tag, 'news', 'auto']
    });
    console.error(`   ok: ${h2.slice(0, 60)}`);
  } catch (e) {
    console.error(`   FAIL: ${e.message}`);
  }
}

writeFileSync(outPath, JSON.stringify(results, null, 2));
console.error(`\nwrote ${results.length} posts to ${outPath}`);
