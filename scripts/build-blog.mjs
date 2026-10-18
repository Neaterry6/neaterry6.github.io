#!/usr/bin/env python3
"""
Build the blog: a static page per post, plus a 1200x630 share card for each.

Why static pages and not the existing ?post=<slug> query string:

  A crawler fetching /blog.html?post=something gets the same <head> as the index
  — one site-wide og:image and a generic title. Query strings are not separate
  documents to a preview scraper, so every shared post looked identical. A real
  file at /blog/<slug>.html can carry its own title, description and image.

Cards are generated from code rather than screenshotted, so the headline is set
at a size that survives a ~500px feed render. Rendered at 2x and downsampled.
"""

import json
import os
import re
import textwrap
from PIL import Image, ImageDraw, ImageFont

ROOT = '/home/Scripts/portfolio-site'
OUT_BLOG = os.path.join(ROOT, 'blog')
OUT_OG = os.path.join(ROOT, 'assets', 'og')
SITE = 'https://neaterry6.github.io'

W, H = 1200, 630
SCALE = 2                      # draw at 2x, downsample with LANCZOS
SAFE = 72                      # keep content inside this margin

# Brand colours, matching the site.
BG = (8, 8, 10)
CYAN = (34, 211, 238)
PURPLE = (168, 85, 247)
PINK = (236, 72, 153)
WHITE = (249, 250, 251)
MUTED = (156, 163, 175)
DIM = (107, 114, 128)

FONT_CANDIDATES = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
]
FONT_REG = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
]


def font(paths, size):
    for p in paths:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def make_card(post, path):
    """One share card: title, source, and the site mark on the brand field."""
    S = SCALE
    img = Image.new('RGB', (W * S, H * S), BG)
    d = ImageDraw.Draw(img, 'RGBA')

    # Soft radial bloom top-left, so the card has depth without a hard edge.
    for i in range(90, 0, -1):
        r = int(i * 5.2 * S)
        a = int(2.2 * (90 - i) / 90 * 4)
        d.ellipse([(-r + 260 * S, -r + 120 * S), (r + 260 * S, r + 120 * S)],
                  fill=(CYAN[0], CYAN[1], CYAN[2], max(0, a)))

    for i in range(70, 0, -1):
        r = int(i * 6.0 * S)
        a = int(1.8 * (70 - i) / 70 * 4)
        d.ellipse([(-r + 980 * S, -r + 560 * S), (r + 980 * S, r + 560 * S)],
                  fill=(PURPLE[0], PURPLE[1], PURPLE[2], max(0, a)))

    # Top accent rule — three brand colours, short and left-aligned.
    y = SAFE * S
    x = SAFE * S
    for col, wseg in ((CYAN, 56), (PURPLE, 34), (PINK, 20)):
        d.rectangle([x, y, x + wseg * S, y + 4 * S], fill=col)
        x += (wseg + 6) * S

    # Source line, above the headline.
    src = (post.get('source_name') or 'brokenXoxo').upper()
    f_src = font(FONT_CANDIDATES, 17 * S)
    d.text((SAFE * S, y + 26 * S), src, font=f_src, fill=CYAN)

    # Headline. Wrapped by measuring, not by character count, so it fills the
    # width properly instead of breaking early on a long word.
    title = post.get('title') or ''
    size = 62
    f_title = font(FONT_CANDIDATES, size * S)
    max_w = (W - SAFE * 2) * S

    def wrap(text, fnt, width):
        words = text.split()
        lines, cur = [], ''
        for word in words:
            trial = (cur + ' ' + word).strip()
            if d.textlength(trial, font=fnt) <= width:
                cur = trial
            else:
                if cur:
                    lines.append(cur)
                cur = word
        if cur:
            lines.append(cur)
        return lines

    lines = wrap(title, f_title, max_w)
    # Shrink until it fits in four lines, so a long title never overflows.
    while len(lines) > 4 and size > 34:
        size -= 3
        f_title = font(FONT_CANDIDATES, size * S)
        lines = wrap(title, f_title, max_w)

    ty = y + 66 * S
    for line in lines:
        d.text((SAFE * S, ty), line, font=f_title, fill=WHITE)
        ty += int(size * 1.22) * S

    # Bottom row: wordmark left, domain right. The domain is the one small piece
    # of text that must stay readable at thumbnail size, so it is sized up.
    by = H - SAFE * S - 26 * S
    f_mark = font(FONT_CANDIDATES, 26 * S)
    d.text((SAFE * S, by), 'broken', font=f_mark, fill=WHITE)
    wm = d.textlength('broken', font=f_mark)
    d.text((SAFE * S + wm, by), 'Xoxo', font=f_mark, fill=CYAN)

    dom = 'neaterry6.github.io'
    f_dom = font(FONT_REG, 20 * S)
    dw = d.textlength(dom, font=f_dom)
    d.text((W * S - SAFE * S - dw, by + 3 * S), dom, font=f_dom, fill=MUTED)

    img = img.resize((W, H), Image.LANCZOS)
    img.save(path, 'JPEG', quality=88, optimize=True)
    return path


def esc(s):
    return (str(s or '')
            .replace('&', '&amp;').replace('<', '&lt;')
            .replace('>', '&gt;').replace('"', '&quot;'))


def markdown_to_html(md):
    """Just enough Markdown for these posts. No dependencies, no surprises."""
    out = []
    in_list = False
    for raw in md.split('\n'):
        line = raw.rstrip()
        if not line.strip():
            if in_list:
                out.append('</ul>')
                in_list = False
            continue

        line = esc(line)
        line = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', line)
        line = re.sub(r'`(.+?)`', r'<code>\1</code>', line)
        line = re.sub(r'\[([^\]]+)\]\((https?://[^)]+)\)',
                      r'<a href="\2" target="_blank" rel="noopener">\1</a>', line)

        if line.startswith('## '):
            if in_list:
                out.append('</ul>')
                in_list = False
            out.append(f'<h2>{line[3:]}</h2>')
        elif line.startswith('- '):
            if not in_list:
                out.append('<ul>')
                in_list = True
            out.append(f'<li>{line[2:]}</li>')
        else:
            if in_list:
                out.append('</ul>')
                in_list = False
            out.append(f'<p>{line}</p>')

    if in_list:
        out.append('</ul>')
    return '\n'.join(out)


PAGE = """<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title} — brokenXoxo</title>
    <meta name="description" content="{desc}">
    <meta name="theme-color" content="#050508">
    <link rel="canonical" href="{canonical}">

    <meta property="og:type" content="article">
    <meta property="og:site_name" content="brokenXoxo">
    <meta property="og:url" content="{canonical}">
    <meta property="og:title" content="{title}">
    <meta property="og:description" content="{desc}">
    <meta property="og:image" content="{image}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="{title}">
    <meta property="article:published_time" content="{published}">

    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{title}">
    <meta name="twitter:description" content="{desc}">
    <meta name="twitter:image" content="{image}">

    <link rel="alternate" type="application/rss+xml" title="brokenXoxo blog" href="/rss.xml">
    <link rel="stylesheet" href="/assets/pages.css">
    <link rel="stylesheet" href="/assets/mobile-nav.css">
    <script defer src="/assets/mobile-nav.js"></script>
    <style>
      .post-wrap {{ max-width: 720px; margin: 0 auto; padding: 48px 24px 80px; }}
      .post-meta {{ font-size: 12px; color: #6b7280; margin-bottom: 28px; }}
      .post-meta .src {{ color: #00f5d4; font-weight: 600; }}
      .post-body h2 {{ font-size: 26px; margin: 34px 0 14px; line-height: 1.3; }}
      .post-body p {{ font-size: 16px; line-height: 1.75; color: #c9d1d9; margin: 0 0 16px; }}
      .post-body ul {{ margin: 0 0 18px; padding-left: 20px; }}
      .post-body li {{ font-size: 15.5px; line-height: 1.7; color: #c9d1d9; margin-bottom: 10px; }}
      .post-body strong {{ color: #f0f6fc; }}
      .post-body a {{ color: #00f5d4; }}
      .post-body code {{ background: rgba(255,255,255,.06); padding: 2px 6px; border-radius: 5px; font-size: 14px; }}
      .share {{ display: flex; flex-wrap: wrap; gap: 10px; margin: 40px 0 0; padding-top: 28px; border-top: 1px solid rgba(255,255,255,.08); }}
      .share a, .share button {{
        display: inline-flex; align-items: center; gap: 8px;
        padding: 10px 16px; border-radius: 10px; font-size: 13.5px; font-weight: 600;
        text-decoration: none; border: 1px solid rgba(255,255,255,.1);
        background: rgba(255,255,255,.04); color: #e5e7eb; cursor: pointer;
        font-family: inherit; transition: background .15s, border-color .15s;
      }}
      .share a:hover, .share button:hover {{ background: rgba(255,255,255,.09); border-color: rgba(34,211,238,.4); }}
      .share svg {{ width: 16px; height: 16px; }}
      .back {{ display: inline-block; margin-bottom: 24px; font-size: 13px; color: #8d99ae; text-decoration: none; }}
      .back:hover {{ color: #00f5d4; }}
    </style>
</head>
<body>
    <main>
      <div class="post-wrap">
        <a class="back" href="/blog.html">&larr; All posts</a>
        <h1>{h1}</h1>
        <div class="post-meta">
          <span class="src">{source}</span> &middot; {date} &middot; {views} views
        </div>
        <div class="post-body">
{body}
        </div>

        <div class="share">
          <a id="shWa" href="#" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.8 0-1.5.3-2 .9l-6-3.5c.1-.3.1-.5.1-.8s0-.5-.1-.8l6-3.5c.5.6 1.2.9 2 .9 1.5 0 2.7-1.2 2.7-2.7S18.9 2 17.5 2s-2.7 1.2-2.7 2.7c0 .3 0 .5.1.8l-6 3.5c-.5-.6-1.2-.9-2-.9C5.4 8.1 4.2 9.3 4.2 10.8s1.2 2.7 2.7 2.7c.8 0 1.5-.3 2-.9l6 3.5c-.1.3-.1.5-.1.8 0 1.5 1.2 2.7 2.7 2.7s2.7-1.2 2.7-2.7-1.2-2.5-2.7-2.5z"/></svg>
            WhatsApp
          </a>
          <a id="shX" href="#" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.2 2.3h3.3l-7.2 8.3 8.5 11.2h-6.7l-5.2-6.8-6 6.8H1.7l7.7-8.8L1.2 2.3h6.9l4.7 6.2zm-1.2 17.5h1.8L7.1 4.1H5.1z"/></svg>
            X
          </a>
          <a id="shTg" href="#" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.9 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5 7.2c.1 0 .3 0 .5.1a.5.5 0 0 1 .2.3c0 .1 0 .3 0 .5-.2 1.9-1 6.5-1.4 8.6-.2.9-.5 1.2-.8 1.2-.7.1-1.2-.5-1.9-.9-1-.7-1.7-1.1-2.7-1.8-1.2-.8-.4-1.2.3-1.9.2-.2 3.2-3 3.3-3.2 0 0 0-.1-.1-.2s-.2 0-.2 0c-.1 0-1.8 1.1-5.1 3.3-.5.3-.9.5-1.3.5-.4 0-1.3-.2-1.9-.4-.8-.2-1.3-.4-1.3-.8 0-.2.3-.4.9-.7 3.5-1.5 5.8-2.5 7-3 3.3-1.4 4-1.6 4.5-1.6z"/></svg>
            Telegram
          </a>
          <button id="shCopy" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>
            Copy link
          </button>
        </div>
      </div>
    </main>
    <script>
      (function () {{
        var url = encodeURIComponent(window.location.href);
        var title = encodeURIComponent({title_js});
        document.getElementById('shWa').href = 'https://wa.me/?text=' + title + '%20' + url;
        document.getElementById('shX').href = 'https://twitter.com/intent/tweet?text=' + title + '&url=' + url;
        document.getElementById('shTg').href = 'https://t.me/share/url?url=' + url + '&text=' + title;
        var copy = document.getElementById('shCopy');
        copy.addEventListener('click', function () {{
          var done = function () {{
            var old = copy.innerHTML;
            copy.innerHTML = 'Copied';
            setTimeout(function () {{ copy.innerHTML = old; }}, 1600);
          }};
          if (navigator.clipboard) {{
            navigator.clipboard.writeText(window.location.href).then(done).catch(done);
          }} else {{
            var t = document.createElement('textarea');
            t.value = window.location.href;
            document.body.appendChild(t); t.select();
            try {{ document.execCommand('copy'); }} catch (e) {{}}
            document.body.removeChild(t);
            done();
          }}
        }});
      }})();
    </script>
</body>
</html>
"""


def fmt_date(iso):
    if not iso:
        return ''
    return iso[:10]


def main():
    posts = json.load(open(os.path.join(ROOT, 'Data', 'posts.json')))
    os.makedirs(OUT_BLOG, exist_ok=True)
    os.makedirs(OUT_OG, exist_ok=True)

    made_cards, made_pages = 0, 0

    for p in posts:
        slug = p['slug']
        card_rel = f'/assets/og/{slug}.jpg'
        card_abs = os.path.join(OUT_OG, f'{slug}.jpg')

        # Skip regenerating an unchanged card — the title is the only input.
        if not os.path.exists(card_abs):
            make_card(p, card_abs)
            made_cards += 1

        canonical = f'{SITE}/blog/{slug}.html'
        image = f'{SITE}{card_rel}'
        desc = (p.get('excerpt') or '').strip()[:300]
        body_html = markdown_to_html(p.get('body') or '')

        # The body already opens with the headline as an H2; drop it so the
        # page does not show the same title twice in a row.
        first_h2 = re.search(r'<h2>(.*?)</h2>', body_html)
        h1 = esc(first_h2.group(1)) if first_h2 else esc(p['title'])
        if first_h2:
            body_html = body_html.replace(first_h2.group(0), '', 1).lstrip()

        html = PAGE.format(
            title=esc(p['title']),
            title_js=json.dumps(p['title']),
            desc=esc(desc),
            canonical=canonical,
            image=image,
            published=p.get('published_at') or '',
            h1=h1,
            source=esc(p.get('source_name') or 'brokenXoxo'),
            date=fmt_date(p.get('published_at')),
            views=p.get('views') or 0,
            body=body_html,
        )

        with open(os.path.join(OUT_BLOG, f'{slug}.html'), 'w') as f:
            f.write(html)
        made_pages += 1

    print(f'{made_pages} post pages, {made_cards} new share cards')


if __name__ == '__main__':
    main()
