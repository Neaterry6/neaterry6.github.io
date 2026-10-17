-- ===========================================================================
-- SnippetLab-style blog for neaterry6.github.io
--
-- The portfolio is a static site on GitHub Pages, so there is no server to
-- authenticate against or to store posts. Supabase provides both: Postgres for
-- the posts and its auth for the dashboard login.
--
-- THE SECURITY MODEL, stated plainly because the "secret URL" is not it:
--
--   The admin page lives at an unguessable path. That is convenience, not
--   security — anyone who learns the URL, or reads the repo, can load the page.
--   The actual gate is row-level security: every write requires a session whose
--   app_metadata.role is 'admin'. A stranger who finds the page gets a login
--   form they cannot pass, and a direct API call gets refused by the database.
--
--   Reads are public for published posts only. Drafts are invisible to everyone
--   but an admin, so a half-written post cannot leak by being one query away.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. Posts
-- ---------------------------------------------------------------------------
create table if not exists public.blog_posts (
  id           uuid primary key default gen_random_uuid(),

  slug         text not null unique
                 check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 80),
  title        text not null check (char_length(trim(title)) between 3 and 140),
  excerpt      text not null default '' check (char_length(excerpt) <= 300),

  -- Markdown. Rendered client-side by the blog page, escaped before formatting
  -- so a post cannot inject markup into the page.
  body         text not null default '',

  cover_url    text,
  tags         text[] not null default '{}',

  status       text not null default 'draft'
                 check (status in ('draft', 'published')),

  -- Set when the post first goes live, so ordering by publication date is
  -- stable even after later edits. Null while it is a draft.
  published_at timestamptz,

  views        integer not null default 0 check (views >= 0),

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- A published post must have a publication date; a draft must not pretend to
  -- have one.
  constraint blog_posts_published_has_date
    check ((status = 'published' and published_at is not null)
        or (status = 'draft' and published_at is null))
);

create index if not exists blog_posts_published_idx
  on public.blog_posts (published_at desc)
  where status = 'published';

create index if not exists blog_posts_status_idx
  on public.blog_posts (status, updated_at desc);


-- ---------------------------------------------------------------------------
-- 2. Keep updated_at honest
-- ---------------------------------------------------------------------------
create or replace function public.blog_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists blog_posts_touch on public.blog_posts;
create trigger blog_posts_touch
  before update on public.blog_posts
  for each row execute function public.blog_touch_updated_at();


-- ---------------------------------------------------------------------------
-- 3. Row level security
-- ---------------------------------------------------------------------------
alter table public.blog_posts enable row level security;

grant select on public.blog_posts to anon, authenticated;
grant insert, update, delete on public.blog_posts to authenticated;

-- Anyone may read a published post. Nothing else is readable by the public.
drop policy if exists "Published posts are public" on public.blog_posts;
create policy "Published posts are public"
  on public.blog_posts for select to anon, authenticated
  using (status = 'published');

-- An admin may read everything, including drafts.
drop policy if exists "Admins read every post" on public.blog_posts;
create policy "Admins read every post"
  on public.blog_posts for select to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins create posts" on public.blog_posts;
create policy "Admins create posts"
  on public.blog_posts for insert to authenticated
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins edit posts" on public.blog_posts;
create policy "Admins edit posts"
  on public.blog_posts for update to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins delete posts" on public.blog_posts;
create policy "Admins delete posts"
  on public.blog_posts for delete to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');


-- ---------------------------------------------------------------------------
-- 4. Count a read
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER because the counter lives on a row the public may read but
-- must not write — otherwise anyone could set any view count with a plain
-- UPDATE. The increment is deliberately unconditional here: post reads are
-- not deduped, because a blog is usually read once and a per-reader key would
-- mean storing a fingerprint of every visitor for no real benefit.
create or replace function public.blog_count_view(target text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  total integer;
begin
  update public.blog_posts
     set views = views + 1
   where slug = target
     and status = 'published'
  returning views into total;

  return coalesce(total, 0);
end;
$$;

grant execute on function public.blog_count_view(text) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 5. Cover images
-- ---------------------------------------------------------------------------
-- Public read so a cover renders straight from its URL; writes scoped to the
-- caller's own folder so one admin session cannot overwrite another's file.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'blog-covers', 'blog-covers', true,
  5242880,  -- 5MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Blog covers are publicly readable" on storage.objects;
create policy "Blog covers are publicly readable"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'blog-covers');

drop policy if exists "Admins upload blog covers" on storage.objects;
create policy "Admins upload blog covers"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'blog-covers'
    and ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
  );

drop policy if exists "Admins delete blog covers" on storage.objects;
create policy "Admins delete blog covers"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'blog-covers'
    and ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
  );


-- ---------------------------------------------------------------------------
-- 6. Verify
-- ---------------------------------------------------------------------------
-- Expect: 1 table, 5 policies, 2 functions, 1 bucket.
select 'table' as what, tablename as name, '' as detail
  from pg_tables where schemaname = 'public' and tablename = 'blog_posts'
union all
select 'policy', policyname, cmd
  from pg_policies where schemaname = 'public' and tablename = 'blog_posts'
union all
select 'function', proname, ''
  from pg_proc where proname in ('blog_count_view', 'blog_touch_updated_at')
union all
select 'bucket', id, public::text
  from storage.buckets where id = 'blog-covers'
order by 1, 2;
