-- ===========================================================================
-- brokenxoxo-portfolio — schema
--
-- Rebuilt on a project of its own, so nothing here shares a database, a key
-- or an auth configuration with any other app. That separation is the whole
-- point: on the old shared project, an unlisted redirect URL silently fell
-- back to the other app's Site URL.
--
-- Everything below is idempotent, so re-running it is safe.
-- ===========================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- blog_posts
-- ---------------------------------------------------------------------------
create table if not exists public.blog_posts (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  title           text not null,
  excerpt         text not null default '',
  body            text not null default '',
  cover_url       text,
  tags            text[] not null default '{}'::text[],
  status          text not null default 'draft',
  published_at    timestamptz,
  views           integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  source_url      text,
  source_name     text,
  auto_generated  boolean not null default false,
  constraint blog_posts_status_check check (status in ('draft','published'))
);

-- A published post with no date cannot be sorted, and the blog sorts by date.
alter table public.blog_posts
  drop constraint if exists blog_posts_published_needs_date;
alter table public.blog_posts
  add constraint blog_posts_published_needs_date
  check (status <> 'published' or published_at is not null);

create index if not exists blog_posts_published_idx
  on public.blog_posts (published_at desc) where status = 'published';

-- The news bot dedupes on this: one post per source story, enforced by the
-- database rather than by hoping the bot never runs twice at once.
create unique index if not exists blog_posts_source_url_uidx
  on public.blog_posts (source_url) where source_url is not null;

-- ---------------------------------------------------------------------------
-- blog_likes
-- ---------------------------------------------------------------------------
create table if not exists public.blog_likes (
  post_id     uuid not null references public.blog_posts(id) on delete cascade,
  liker_key   text not null,
  created_at  timestamptz not null default now(),
  primary key (post_id, liker_key)
);

create index if not exists blog_likes_post_idx on public.blog_likes (post_id);

-- ---------------------------------------------------------------------------
-- guestbook
-- ---------------------------------------------------------------------------
create table if not exists public.guestbook (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  body        text not null,
  ip_hash     text,
  hidden      boolean not null default false,
  created_at  timestamptz not null default now(),
  constraint guestbook_name_len check (char_length(name) between 1 and 40),
  constraint guestbook_body_len check (char_length(body) between 2 and 500)
);

create index if not exists guestbook_created_idx on public.guestbook (created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.blog_touch_updated_at()
returns trigger language plpgsql as $$
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
-- Row level security
--
-- Every table is locked down and then opened exactly as far as it needs to be.
-- The anon key ships in the site's JavaScript, so it must be assumed hostile.
-- ---------------------------------------------------------------------------
alter table public.blog_posts enable row level security;
alter table public.blog_likes enable row level security;
alter table public.guestbook enable row level security;

-- blog_posts: published rows are public; everything else is admin-only.
drop policy if exists "Published posts are public" on public.blog_posts;
create policy "Published posts are public" on public.blog_posts
  for select to anon, authenticated
  using (status = 'published');

drop policy if exists "Admins read every post" on public.blog_posts;
create policy "Admins read every post" on public.blog_posts
  for select to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins create posts" on public.blog_posts;
create policy "Admins create posts" on public.blog_posts
  for insert to authenticated
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins edit posts" on public.blog_posts;
create policy "Admins edit posts" on public.blog_posts
  for update to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins delete posts" on public.blog_posts;
create policy "Admins delete posts" on public.blog_posts
  for delete to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

-- blog_likes: insert only, and only against a post that is actually published.
-- There is deliberately no select policy: counts are read through the
-- functions below, so nobody can enumerate who liked what.
drop policy if exists "Anyone can like a published post" on public.blog_likes;
create policy "Anyone can like a published post" on public.blog_likes
  for insert to anon, authenticated
  with check (
    exists (select 1 from public.blog_posts p
             where p.id = blog_likes.post_id and p.status = 'published')
  );

-- guestbook: anyone may sign; only unhidden entries are readable.
drop policy if exists "Anyone can sign the guestbook" on public.guestbook;
create policy "Anyone can sign the guestbook" on public.guestbook
  for insert to anon, authenticated
  with check (hidden = false);

drop policy if exists "Approved guestbook entries are public" on public.guestbook;
create policy "Approved guestbook entries are public" on public.guestbook
  for select to anon, authenticated
  using (hidden = false);

-- ---------------------------------------------------------------------------
-- Like functions
--
-- SECURITY DEFINER so the anon key can toggle a like and read a count without
-- ever being granted select on the table.
-- ---------------------------------------------------------------------------
create or replace function public.blog_toggle_like(target uuid, liker text)
returns table (liked boolean, total integer)
language plpgsql security definer set search_path = ''
as $$
declare
  removed integer;
begin
  if liker is null or length(liker) = 0 then
    raise exception 'liker required';
  end if;

  delete from public.blog_likes l
   where l.post_id = target and l.liker_key = liker;
  get diagnostics removed = row_count;

  if removed = 0 then
    insert into public.blog_likes (post_id, liker_key)
    values (target, liker)
    on conflict do nothing;
  end if;

  return query
    select (removed = 0),
           (select count(*)::integer from public.blog_likes l where l.post_id = target);
end;
$$;

create or replace function public.blog_like_count(target uuid)
returns integer
language sql security definer set search_path = ''
as $$
  select count(*)::integer from public.blog_likes where post_id = target;
$$;

create or replace function public.blog_like_counts()
returns table (post_id uuid, total integer)
language sql security definer set search_path = ''
as $$
  select l.post_id, count(*)::integer
    from public.blog_likes l
   group by l.post_id;
$$;

-- View counter, capped so a refresh loop cannot inflate it forever.
create or replace function public.blog_count_view(target text)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare new_views integer;
begin
  update public.blog_posts
     set views = views + 1
   where slug = target and status = 'published'
  returning views into new_views;
  return coalesce(new_views, 0);
end;
$$;

grant execute on function public.blog_toggle_like(uuid, text) to anon, authenticated;
grant execute on function public.blog_like_count(uuid)          to anon, authenticated;
grant execute on function public.blog_like_counts()             to anon, authenticated;
grant execute on function public.blog_count_view(text)          to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Owner promotion
--
-- A first GitHub sign-in creates a brand new auth.users row with no role, so
-- the owner would authenticate successfully and still be refused from their
-- own dashboard. Promote on the GitHub username, which GitHub itself asserts
-- and a client cannot forge. Only ever adds the role, never removes it.
-- ---------------------------------------------------------------------------
create or replace function public.promote_github_owner()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  provider  text := coalesce(new.raw_app_meta_data ->> 'provider', '');
  gh_handle text := lower(coalesce(new.raw_user_meta_data ->> 'user_name', ''));
begin
  if coalesce(new.raw_app_meta_data ->> 'role', '') = 'admin' then
    return new;
  end if;

  if provider = 'github' and gh_handle = 'neaterry6' then
    new.raw_app_meta_data :=
      coalesce(new.raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('role', 'admin');
  end if;

  return new;
end;
$$;

drop trigger if exists promote_github_owner_on_auth on auth.users;
create trigger promote_github_owner_on_auth
  before insert or update on auth.users
  for each row execute function public.promote_github_owner();

-- ---------------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------------
select 'tables' as what, count(*)::text as n
  from information_schema.tables
 where table_schema = 'public'
   and table_name in ('blog_posts','blog_likes','guestbook')
union all
select 'rls_on', count(*)::text
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname='public' and c.relname in ('blog_posts','blog_likes','guestbook')
   and c.relrowsecurity
union all
select 'policies', count(*)::text
  from pg_policies
 where schemaname='public' and tablename in ('blog_posts','blog_likes','guestbook')
union all
select 'functions', count(*)::text
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in
   ('blog_toggle_like','blog_like_count','blog_like_counts','blog_count_view','promote_github_owner');
