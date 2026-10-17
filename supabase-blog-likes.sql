-- ===========================================================================
-- Blog likes
--
-- One row per (post, liker). The unique constraint is the whole design: a
-- double-tap on a slow connection cannot insert twice, so a count can never
-- read 2 for one person.
--
-- A liker is either a signed-in user's id or a random per-browser key, so
-- anonymous visitors can like without an account. That is deliberate for a
-- public blog — requiring a login to press a heart loses most of the hearts —
-- and the key carries no identity beyond "this browser".
-- ===========================================================================

create table if not exists public.blog_likes (
  post_id    uuid not null references public.blog_posts(id) on delete cascade,
  liker_key  text not null check (char_length(liker_key) between 8 and 80),
  created_at timestamptz not null default now(),

  primary key (post_id, liker_key)
);

create index if not exists blog_likes_post_idx on public.blog_likes (post_id);

alter table public.blog_likes enable row level security;

-- Counts are read through the function below, never by listing rows — so no
-- select grant. Insert is open so an anonymous visitor can like.
grant insert on public.blog_likes to anon, authenticated;

drop policy if exists "Anyone can like a published post" on public.blog_likes;
create policy "Anyone can like a published post"
  on public.blog_likes for insert to anon, authenticated
  with check (
    exists (
      select 1 from public.blog_posts p
       where p.id = post_id and p.status = 'published'
    )
  );


/**
 * Toggle a like and return the new count plus whether this liker is now in.
 *
 * A function rather than an insert/delete pair so the client has one call and
 * one answer: the button flips and the number updates from the same response,
 * with no race between the two.
 */
create or replace function public.blog_toggle_like(target uuid, liker text)
returns table (liked boolean, total integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  already boolean;
  count_now integer;
begin
  if target is null or liker is null or char_length(liker) < 8 then
    raise exception 'post and liker required' using errcode = '22023';
  end if;

  select exists (
    select 1 from public.blog_likes where post_id = target and liker_key = liker
  ) into already;

  if already then
    delete from public.blog_likes where post_id = target and liker_key = liker;
  else
    insert into public.blog_likes (post_id, liker_key)
    values (target, liker)
    on conflict (post_id, liker_key) do nothing;
  end if;

  select count(*)::integer into count_now
    from public.blog_likes where post_id = target;

  return query select (not already), count_now;
end;
$$;

grant execute on function public.blog_toggle_like(uuid, text) to anon, authenticated;


/** Just the count, for rendering a list of posts. */
create or replace function public.blog_like_count(target uuid)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::integer from public.blog_likes where post_id = target;
$$;

grant execute on function public.blog_like_count(uuid) to anon, authenticated;


-- Verify: expect 1 table, 1 policy, 2 functions.
select 'table' as what, tablename as name
  from pg_tables where schemaname = 'public' and tablename = 'blog_likes'
union all
select 'policy', policyname from pg_policies where tablename = 'blog_likes'
union all
select 'function', proname from pg_proc
  where proname in ('blog_toggle_like', 'blog_like_count')
order by 1, 2;
