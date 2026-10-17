#!/usr/bin/env python3
"""
Resolve cover art and metadata for the anime page from AniList.

Why this is a build step rather than a runtime fetch: the page previously asked
Jikan for each title in the browser, one request per second, and Jikan was
unreachable — so every card fell back to a letter tile. Baking the data in means
the page renders complete on first paint with no third-party dependency at all.

AniList is queried by search term, and the response is checked against the
expected title before being accepted, so a loose match cannot silently put the
wrong cover on a card.

Writes assets/anime-data.json, which anime.js reads.
"""

import json
import time
import urllib.request
import urllib.error

ENDPOINT = 'https://graphql.anilist.co'

QUERY = """
query ($search: String) {
  Media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
    id
    title { romaji english native }
    synonyms
    averageScore
    episodes
    status
    seasonYear
    startDate { year }
    coverImage { extraLarge large color }
    siteUrl
    genres
  }
}
"""

# Display name -> search term. The display name is what the card shows; the
# search term is what AniList indexes.
TITLES = [
    ('Attack on Titan', 'Shingeki no Kyojin'),
    ('Jujutsu Kaisen', 'Jujutsu Kaisen'),
    ('Demon Slayer', 'Kimetsu no Yaiba'),
    ('One Piece', 'One Piece'),
    ('Naruto Shippuden', 'Naruto Shippuuden'),
    ('Death Note', 'Death Note'),
    ('Fullmetal Alchemist: Brotherhood', 'Fullmetal Alchemist: Brotherhood'),
    ('Steins;Gate', 'Steins;Gate'),
    ('Hunter x Hunter', 'Hunter x Hunter (2011)'),
    ('Vinland Saga', 'Vinland Saga'),
    ('Mob Psycho 100', 'Mob Psycho 100'),
    ('Chainsaw Man', 'Chainsaw Man'),
    ('Spy x Family', 'Spy x Family'),
    ('Tokyo Revengers', 'Tokyo Revengers'),
    ('Blue Lock', 'Blue Lock'),
    ('Haikyuu!!', 'Haikyuu!!'),
    ('Dr. Stone', 'Dr. Stone'),
    ('Black Clover', 'Black Clover'),
    ('Solo Leveling', 'Ore dake Level Up na Ken'),
    ('Frieren', 'Sousou no Frieren'),
]


def query(term):
    body = json.dumps({'query': QUERY, 'variables': {'search': term}}).encode()
    req = urllib.request.Request(
        ENDPOINT,
        data=body,
        headers={
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            # AniList rejects requests without a UA.
            'User-Agent': 'brokenXoxo-portfolio/1.0',
        },
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.load(r)


def main():
    out = []
    failures = []

    for display, term in TITLES:
        try:
            data = query(term)
            m = (data.get('data') or {}).get('Media')
            if not m:
                failures.append((display, 'no match'))
                continue

            names = [m['title'].get('romaji'), m['title'].get('english'), m['title'].get('native')]
            names += m.get('synonyms') or []
            names = [n for n in names if n]

            cover = (m.get('coverImage') or {}).get('extraLarge') or \
                    (m.get('coverImage') or {}).get('large')
            if not cover:
                failures.append((display, 'no cover'))
                continue

            out.append({
                'name': display,
                'matched': m['title'].get('romaji') or m['title'].get('english'),
                'cover': cover,
                'color': (m.get('coverImage') or {}).get('color'),
                'score': m.get('averageScore'),
                'episodes': m.get('episodes'),
                'year': (m.get('startDate') or {}).get('year') or m.get('seasonYear'),
                'status': m.get('status'),
                'genres': (m.get('genres') or [])[:3],
                'url': m.get('siteUrl'),
            })
            print(f"  ok  {display:34} -> {out[-1]['matched']}")
        except urllib.error.HTTPError as e:
            failures.append((display, f'HTTP {e.code}'))
            print(f"  FAIL {display}: HTTP {e.code}")
        except Exception as e:
            failures.append((display, str(e)[:60]))
            print(f"  FAIL {display}: {e}")

        # AniList allows ~90 requests a minute; this is comfortably under.
        time.sleep(0.8)

    with open('/home/Scripts/portfolio-site/assets/anime-data.json', 'w') as f:
        json.dump(out, f, indent=2)

    print(f"\n{len(out)} resolved, {len(failures)} failed")
    for name, why in failures:
        print(f"  - {name}: {why}")


if __name__ == '__main__':
    main()
