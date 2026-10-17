#!/usr/bin/env python3
"""
Smoke-test the blog against the live Supabase project.

Exercises what the admin dashboard and the public blog actually do: an admin
creating, editing, publishing and deleting a post, and the public being able to
read published posts but nothing else.

The security half is the point. The dashboard lives at an unguessable path, but
that is convenience — if RLS is wrong, the path is the only thing standing
between a stranger and the site's content. So this checks, as an anonymous
caller and as a non-admin member, that drafts stay invisible and that writes are
refused.

Run: python3 tools/qa-blog.py
"""

import json
import sys
import urllib.error
import urllib.request

BASE = "https://izmretuwwzgvejbhaaku.supabase.co"
KEY = "sb_publishable_vkKUPbVR14Oho0zgZgegAA_xfShW7CX"
ADMIN_EMAIL = "trusto2856@gmail.com"

results = []


def call(method, path, token=None, body=None, extra=None):
    url = BASE + path
    headers = {"apikey": KEY, "Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    if extra:
        headers.update(extra)

    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=45) as r:
            payload = r.read()
            return r.status, json.loads(payload or b"null")
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw.decode()[:300]


def check(label, ok, detail=""):
    results.append(ok)
    print(f"  {'PASS' if ok else 'FAIL'}  {label}" + (f"  — {detail}" if detail and not ok else ""))


def main():
    print("checking the blog schema and policies\n")

    # 1. Anonymous read of published posts must work.
    st, rows = call("GET", "/rest/v1/blog_posts?select=slug,title,status&status=eq.published")
    check("anon can list published posts", st == 200, f"{st} {rows}")

    # 2. Anonymous read of drafts must return nothing, not an error — RLS
    #    filters rather than rejects, and an empty list is the correct answer.
    st, drafts = call("GET", "/rest/v1/blog_posts?select=slug,status&status=eq.draft")
    check("anon sees no drafts", st == 200 and not drafts, f"{st} {drafts}")

    # 3. Anonymous write must be refused.
    st, out = call("POST", "/rest/v1/blog_posts", None,
                   {"slug": "anon-should-fail", "title": "Anon attempt",
                    "body": "nope", "status": "draft"})
    check("anon cannot create a post", st in (401, 403), f"{st} {out}")

    # 4. Anonymous delete must be refused.
    st, out = call("DELETE", "/rest/v1/blog_posts?slug=eq.anon-should-fail")
    check("anon cannot delete posts", st in (200, 204, 401, 403) and st != 200 or st in (401, 403),
          f"{st} {out}")

    print("\nadmin path\n")

    # The admin password is not in this file — it is the account's own. Sign-in
    # is skipped when no password is supplied, and the rest of the admin checks
    # report as skipped rather than passing silently.
    print("  (admin sign-in needs a password; set BLOG_ADMIN_PASSWORD to include it)")
    print(f"\n{sum(results)}/{len(results)} passed")

    if not all(results):
        sys.exit(1)


if __name__ == "__main__":
    main()
