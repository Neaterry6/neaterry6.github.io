-- ===========================================================================
-- Let the owner sign in to the blog dashboard with GitHub.
--
-- The problem this solves, stated plainly:
--
--   Admin access is decided by auth.users.raw_app_meta_data -> 'role' = 'admin'.
--   Signing in with GitHub for the first time creates a BRAND NEW auth.users
--   row, with no role at all. So the owner would sign in with GitHub and be
--   turned away from their own dashboard, because the admin flag lives on
--   their old email account and not on the new one.
--
-- The fix is a trigger that promotes a new account when it is provably the
-- owner's: a GitHub identity whose username is neaterry6. That is a fact
-- GitHub itself asserts and the client cannot forge, so it is a safe thing to
-- key on — unlike an email address typed into a form.
--
-- Nothing else gets promoted. A GitHub sign-in from any other account is a
-- normal member, and the dashboard bounces them.
-- ===========================================================================

create or replace function public.promote_github_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  provider   text := coalesce(new.raw_app_meta_data ->> 'provider', '');
  gh_handle  text := lower(coalesce(new.raw_user_meta_data ->> 'user_name', ''));
  is_admin   boolean := coalesce(new.raw_app_meta_data ->> 'role', '') = 'admin';
begin
  -- Only ever ADD the role. Never remove it, or a later profile update that
  -- rewrites metadata would silently lock the owner out of their own site.
  if is_admin then
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
  for each row
  execute function public.promote_github_owner();


-- ---------------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------------
-- Expect: 1 function, 1 trigger.
select 'function' as what, proname as name
  from pg_proc where proname = 'promote_github_owner'
union all
select 'trigger', tgname
  from pg_trigger
 where tgrelid = 'auth.users'::regclass and not tgisinternal
   and tgname = 'promote_github_owner_on_auth';
