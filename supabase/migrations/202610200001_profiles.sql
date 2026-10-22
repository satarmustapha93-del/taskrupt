-- Run this migration in the Supabase SQL Editor or with the Supabase CLI.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  referral_code text not null unique,
  referred_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, referral_code, referred_by)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    upper(substr(replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 12)),
    (
      select p.id
      from public.profiles as p
      where p.referral_code = upper(coalesce(new.raw_user_meta_data ->> 'referral_code', ''))
      limit 1
    )
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_profile_for_auth_user();
