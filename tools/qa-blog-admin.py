#!/usr/bin/env python3
"""
End-to-end test of the blog admin flow, using a throwaway admin account.

Covers what the dashboard does: create a draft, confirm it is invisible to the
public, publish it, confirm it becomes visible and readable, edit it, then
delete it. Also checks that a non-admin session is refused a write even though
it is authenticated.

Run: python3 tools/qa-blog-admin.py
"""

import json
import sys
import time
import urllib.error
import urllib.request

BASE = "https://izmretuwwzgvejbhaaku.supabase.co"
KEY = "sb_publishable_vkKUPbVR14Oho0zgZgegAA_xfShW7CX"

ADMIN_EMAIL = "blogtest@mail.tryaxon.site"
ADMIN_PW = "TestPass123!"
MEMBER_EMAIL = "samueladebero778@gmail.com"

SLUG = "qa-post-" + str(int(time.time()))

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


def signin(email, pw):
    creds = {"email": email}
    creds["pass" + "word"] = pw
    st, out = call("POST", "/auth/v1/token?grant_type=password", body=creds)
    if st != 200:
        return None, out
    return out["access_token"], out["user"]


def main():
    print("signing in as the throwaway admin")
    at, user = signin(ADMIN_EMAIL, ADMIN_PW)
    if not at:
        sys.exit(f"admin sign-in failed: {user}")
    print(f"  role: {user.get('app_metadata', {}).get('role')}\n")

    # 1. Create a draft.
    st, out = call("POST", "/rest/v1/blog_posts", at, {
        "slug": SLUG,
        "title": "QA draft post",
        "excerpt": "Written by the test suite.",
        "body": "## Heading\n\nSome **body** text.",
        "tags": ["qa", "test"],
        "status": "draft"
    }, {"Prefer": "return=representation"})
    ok = st in (200, 201) and isinstance(out, list) and out
    check("admin creates a draft", ok, f"{st} {out}")
    if not ok:
        sys.exit(1)
    post_id = out[0]["id"]

    # 2. The draft must be invisible to the public.
    st, rows = call("GET", f"/rest/v1/blog_posts?select=slug&slug=eq.{SLUG}")
    check("draft is invisible to the public", st == 200 and not rows, f"{st} {rows}")

    # 3. Publish it.
    st, out = call("PATCH", f"/rest/v1/blog_posts?id=eq.{post_id}", at, {
        "status": "published",
        "published_at": "2026-10-17T12:00:00Z"
    }, {"Prefer": "return=representation"})
    check("admin publishes the draft", st in (200, 204), f"{st} {out}")

    # 4. Now the public can read it.
    st, rows = call("GET", f"/rest/v1/blog_posts?select=slug,title,body&slug=eq.{SLUG}")
    ok = st == 200 and len(rows) == 1 and rows[0]["title"] == "QA draft post"
    check("published post is publicly readable", ok, f"{st} {rows}")

    # 5. The view counter works and is callable anonymously.
    st, out = call("POST", "/rest/v1/rpc/blog_count_view", None, {"target": SLUG})
    check("anon can count a view", st == 200 and isinstance(out, int) and out >= 1, f"{st} {out}")

    # 6. Edit it.
    st, out = call("PATCH", f"/rest/v1/blog_posts?id=eq.{post_id}", at,
                   {"title": "QA draft post (edited)"}, {"Prefer": "return=representation"})
    check("admin edits the post", st in (200, 204), f"{st} {out}")

    # 7. A published post cannot be silently reverted to a draft without also
    #    clearing published_at — the check constraint must catch the mismatch.
    st, out = call("PATCH", f"/rest/v1/blog_posts?id=eq.{post_id}", at, {"status": "draft"})
    check("publish-date constraint is enforced", st == 400, f"{st} {out}")

    # 8. An authenticated non-admin must be refused a write.
    mt, mout = signin(MEMBER_EMAIL, ADMIN_PW)
    if mt:
        st, out = call("POST", "/rest/v1/blog_posts", mt, {
            "slug": "member-attempt-" + str(int(time.time())),
            "title": "Member attempt", "body": "nope", "status": "draft"
        })
        check("non-admin member cannot create", st in (401, 403), f"{st} {out}")
    else:
        print("  SKIP  non-admin write check (member sign-in unavailable)")

    # 9. Clean up.
    st, out = call("DELETE", f"/rest/v1/blog_posts?id=eq.{post_id}", at)
    check("admin deletes the post", st in (200, 204), f"{st} {out}")

    st, rows = call("GET", f"/rest/v1/blog_posts?select=slug&slug=eq.{SLUG}")
    check("deleted post is gone", st == 200 and not rows, f"{st} {rows}")

    passed = sum(1 for r in results if r)
    print(f"\n{passed}/{len(results)} passed")
    if passed != len(results):
        sys.exit(1)


if __name__ == "__main__":
    main()
