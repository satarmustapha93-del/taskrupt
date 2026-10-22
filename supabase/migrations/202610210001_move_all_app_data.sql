-- Full TaskRupt data layer in Supabase Postgres. Run after 202610200001_profiles.sql.
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists role text not null default 'user' check (role in ('user', 'admin'));
alter table public.profiles add column if not exists status text not null default 'active' check (status in ('active', 'suspended'));
alter table public.profiles add column if not exists tokens_available bigint not null default 0 check (tokens_available >= 0);
alter table public.profiles add column if not exists tokens_pending bigint not null default 0 check (tokens_pending >= 0);
alter table public.profiles add column if not exists streak_days integer not null default 0 check (streak_days >= 0);
alter table public.profiles add column if not exists last_check_in_at timestamptz;
alter table public.profiles add column if not exists level integer not null default 1 check (level >= 1);
alter table public.profiles add column if not exists xp bigint not null default 0 check (xp >= 0);
alter table public.profiles add column if not exists device_fingerprint text;
alter table public.profiles add column if not exists signup_ip text;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

update public.profiles as p set email = u.email from auth.users as u where p.id = u.id and p.email is null;
alter table public.profiles alter column email set not null;

create unique index if not exists profiles_email_lower_idx on public.profiles (lower(email));
create index if not exists profiles_referred_by_idx on public.profiles (referred_by);

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, referral_code, referred_by)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    upper(substr(replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 12)),
    (select p.id from public.profiles as p where p.referral_code = upper(coalesce(new.raw_user_meta_data ->> 'referral_code', '')) limit 1)
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('video', 'social', 'daily', 'referral', 'survey', 'app', 'custom')),
  title text not null check (char_length(title) between 1 and 140),
  description text not null default '' check (char_length(description) <= 500),
  link text not null default '',
  proof_required boolean not null default false,
  reward_tokens integer not null check (reward_tokens > 0),
  cooldown_hours numeric not null default 0 check (cooldown_hours >= 0),
  active boolean not null default true,
  instant_approval boolean not null default false,
  max_completions integer check (max_completions is null or max_completions > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tasks_active_created_idx on public.tasks (active, created_at desc);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete restrict,
  proof_url text not null default '',
  proof_text text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text not null default '',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists submissions_user_task_created_idx on public.submissions (user_id, task_id, created_at desc);
create index if not exists submissions_status_created_idx on public.submissions (status, created_at desc);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('earned', 'pending', 'withdrawn', 'referral', 'streak', 'ad_reward', 'adjustment')),
  amount_tokens bigint not null,
  balance_after bigint,
  description text not null,
  reference_id uuid,
  reference_type text,
  created_at timestamptz not null default now()
);
create index if not exists wallet_transactions_user_created_idx on public.wallet_transactions (user_id, created_at desc);

create table if not exists public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_tokens bigint not null check (amount_tokens > 0),
  amount_money numeric(18, 2) not null check (amount_money > 0),
  currency text not null default 'NGN' check (currency = 'NGN'),
  method text not null check (method in ('paystack', 'bank', 'paypal')),
  destination text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'paid', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  provider_reference text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists withdrawals_user_created_idx on public.withdrawals (user_id, created_at desc);
create index if not exists withdrawals_status_created_idx on public.withdrawals (status, created_at);

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.app_settings (key, value) values ('tokensPerNaira', '1'::jsonb), ('minimumWithdrawalNgn', '5000'::jsonb)
on conflict (key) do nothing;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
do $$
declare t text;
begin
  foreach t in array array['profiles', 'tasks', 'submissions', 'withdrawals'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.submissions enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.withdrawals enable row level security;
alter table public.app_settings enable row level security;

revoke all on public.profiles, public.tasks, public.submissions, public.wallet_transactions, public.withdrawals, public.app_settings from anon, authenticated;
grant select on public.profiles to authenticated;
drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);

-- All application writes use the server-only secret key and validated API routes.
-- Wallet changes below are atomic database transactions.
create or replace function public.claim_daily_check_in(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_profile public.profiles%rowtype; v_today date; v_last date; v_balance bigint;
begin
  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found or v_profile.status <> 'active' then raise exception using message = 'Account unavailable'; end if;
  v_today := (now() at time zone 'Africa/Lagos')::date;
  v_last := (v_profile.last_check_in_at at time zone 'Africa/Lagos')::date;
  if v_last = v_today then raise exception using message = 'Daily check-in already claimed'; end if;
  update public.profiles set streak_days = case when v_last = v_today - 1 then streak_days + 1 else 1 end,
    last_check_in_at = now(), tokens_available = tokens_available + 50, xp = xp + 25
    where id = p_user_id returning tokens_available into v_balance;
  insert into public.wallet_transactions (user_id, kind, amount_tokens, balance_after, description)
    values (p_user_id, 'streak', 50, v_balance, 'Daily check-in');
  return jsonb_build_object('user', (select to_jsonb(p) from public.profiles p where p.id = p_user_id), 'rewardTokens', 50);
end;
$$;

create or replace function public.submit_task(p_user_id uuid, p_task_id uuid, p_proof_url text default '', p_proof_text text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_task public.tasks%rowtype; v_profile public.profiles%rowtype; v_prev public.submissions%rowtype; v_submission public.submissions%rowtype; v_count integer; v_balance bigint; v_bonus bigint; v_referrer_balance bigint;
begin
  select * into v_task from public.tasks where id = p_task_id and active = true;
  if not found then raise exception using message = 'Task not found'; end if;
  if v_task.proof_required and coalesce(p_proof_url, '') = '' and coalesce(p_proof_text, '') = '' then raise exception using message = 'Proof is required for this task'; end if;
  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found or v_profile.status <> 'active' then raise exception using message = 'Account unavailable'; end if;
  select * into v_prev from public.submissions where user_id = p_user_id and task_id = p_task_id order by created_at desc limit 1;
  if found and v_prev.status = 'pending' then raise exception using message = 'Your submission is waiting for review'; end if;
  if found and v_task.cooldown_hours > 0 and v_prev.created_at > now() - make_interval(secs => v_task.cooldown_hours * 3600) then raise exception using message = 'This task is still on cooldown'; end if;
  if v_task.max_completions is not null then
    select count(*) into v_count from public.submissions where task_id = p_task_id and status = 'approved';
    if v_count >= v_task.max_completions then raise exception using message = 'This task has reached its completion limit'; end if;
  end if;
  insert into public.submissions (user_id, task_id, proof_url, proof_text, status)
    values (p_user_id, p_task_id, coalesce(p_proof_url, ''), coalesce(p_proof_text, ''), case when v_task.instant_approval then 'approved' else 'pending' end)
    returning * into v_submission;
  if v_task.instant_approval then
    update public.profiles set tokens_available = tokens_available + v_task.reward_tokens, xp = xp + v_task.reward_tokens where id = p_user_id returning tokens_available into v_balance;
    insert into public.wallet_transactions (user_id, kind, amount_tokens, balance_after, description, reference_id, reference_type)
      values (p_user_id, 'earned', v_task.reward_tokens, v_balance, v_task.title, v_submission.id, 'submission');
    if v_profile.referred_by is not null then
      v_bonus := floor(v_task.reward_tokens * 0.10);
      if v_bonus > 0 then
        update public.profiles set tokens_available = tokens_available + v_bonus where id = v_profile.referred_by returning tokens_available into v_referrer_balance;
        insert into public.wallet_transactions (user_id, kind, amount_tokens, balance_after, description, reference_id, reference_type)
          values (v_profile.referred_by, 'referral', v_bonus, v_referrer_balance, 'Referral earnings: ' || v_task.title, v_submission.id, 'submission');
      end if;
    end if;
  else
    update public.profiles set tokens_pending = tokens_pending + v_task.reward_tokens where id = p_user_id;
    insert into public.wallet_transactions (user_id, kind, amount_tokens, description, reference_id, reference_type)
      values (p_user_id, 'pending', v_task.reward_tokens, 'Pending review: ' || v_task.title, v_submission.id, 'submission');
  end if;
  return jsonb_build_object('submission', to_jsonb(v_submission), 'status', v_submission.status, 'rewardTokens', case when v_task.instant_approval then v_task.reward_tokens else 0 end);
end;
$$;

create or replace function public.review_submission(p_admin_id uuid, p_submission_id uuid, p_status text, p_review_note text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_submission public.submissions%rowtype; v_task public.tasks%rowtype; v_user public.profiles%rowtype; v_balance bigint; v_pending bigint; v_bonus bigint; v_referrer_balance bigint;
begin
  if p_status not in ('approved', 'rejected') then raise exception using message = 'Status must be approved or rejected'; end if;
  select * into v_submission from public.submissions where id = p_submission_id and status = 'pending' for update;
  if not found then raise exception using message = 'Pending submission not found'; end if;
  select * into v_task from public.tasks where id = v_submission.task_id;
  select * into v_user from public.profiles where id = v_submission.user_id for update;
  update public.submissions set status = p_status, review_note = coalesce(p_review_note, ''), reviewed_by = p_admin_id, reviewed_at = now() where id = p_submission_id returning * into v_submission;
  update public.profiles set tokens_pending = greatest(0, tokens_pending - v_task.reward_tokens),
    tokens_available = tokens_available + case when p_status = 'approved' then v_task.reward_tokens else 0 end,
    xp = xp + case when p_status = 'approved' then v_task.reward_tokens else 0 end
    where id = v_user.id returning tokens_available, tokens_pending into v_balance, v_pending;
  if p_status = 'approved' then
    insert into public.wallet_transactions (user_id, kind, amount_tokens, balance_after, description, reference_id, reference_type)
      values (v_user.id, 'earned', v_task.reward_tokens, v_balance, v_task.title, v_submission.id, 'submission');
    if v_user.referred_by is not null then
      v_bonus := floor(v_task.reward_tokens * 0.10);
      if v_bonus > 0 then
        update public.profiles set tokens_available = tokens_available + v_bonus where id = v_user.referred_by returning tokens_available into v_referrer_balance;
        insert into public.wallet_transactions (user_id, kind, amount_tokens, balance_after, description, reference_id, reference_type)
          values (v_user.referred_by, 'referral', v_bonus, v_referrer_balance, 'Referral earnings: ' || v_task.title, v_submission.id, 'submission');
      end if;
    end if;
  end if;
  return jsonb_build_object('submission', to_jsonb(v_submission), 'user', jsonb_build_object('id', v_user.id, 'tokensAvailable', v_balance, 'tokensPending', v_pending));
end;
$$;

create or replace function public.request_withdrawal(p_user_id uuid, p_amount_tokens bigint, p_method text, p_destination text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_profile public.profiles%rowtype; v_withdrawal public.withdrawals%rowtype; v_rate numeric; v_minimum numeric; v_balance bigint; v_amount numeric;
begin
  if p_amount_tokens is null or p_amount_tokens <= 0 or p_method not in ('paystack', 'bank', 'paypal') or coalesce(trim(p_destination), '') = '' then raise exception using message = 'Enter a valid token amount, method, and destination'; end if;
  select trim(both '"' from value::text)::numeric into v_rate from public.app_settings where key = 'tokensPerNaira';
  select trim(both '"' from value::text)::numeric into v_minimum from public.app_settings where key = 'minimumWithdrawalNgn';
  v_rate := coalesce(v_rate, 1); v_minimum := coalesce(v_minimum, 5000); v_amount := p_amount_tokens / v_rate;
  if v_amount < v_minimum then raise exception using message = 'Minimum withdrawal is ₦' || v_minimum::text; end if;
  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found or v_profile.status <> 'active' then raise exception using message = 'Account unavailable'; end if;
  if v_profile.tokens_available < p_amount_tokens then raise exception using message = 'Insufficient available balance'; end if;
  update public.profiles set tokens_available = tokens_available - p_amount_tokens where id = p_user_id returning tokens_available into v_balance;
  insert into public.withdrawals (user_id, amount_tokens, amount_money, method, destination)
    values (p_user_id, p_amount_tokens, v_amount, p_method, trim(p_destination)) returning * into v_withdrawal;
  insert into public.wallet_transactions (user_id, kind, amount_tokens, balance_after, description, reference_id, reference_type)
    values (p_user_id, 'withdrawn', -p_amount_tokens, v_balance, 'Withdrawal request (' || p_method || ')', v_withdrawal.id, 'withdrawal');
  return jsonb_build_object('withdrawal', to_jsonb(v_withdrawal), 'balance', v_balance);
end;
$$;

create or replace function public.review_withdrawal(p_admin_id uuid, p_withdrawal_id uuid, p_status text, p_provider_reference text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_withdrawal public.withdrawals%rowtype; v_balance bigint;
begin
  if p_status not in ('approved', 'paid', 'rejected') then raise exception using message = 'Invalid withdrawal status'; end if;
  select * into v_withdrawal from public.withdrawals where id = p_withdrawal_id for update;
  if not found or v_withdrawal.status in ('paid', 'rejected') or (p_status = 'approved' and v_withdrawal.status <> 'pending') then raise exception using message = 'Withdrawal cannot be updated from its current status'; end if;
  update public.withdrawals set status = p_status, provider_reference = coalesce(p_provider_reference, ''), reviewed_by = p_admin_id, reviewed_at = now() where id = p_withdrawal_id returning * into v_withdrawal;
  if p_status = 'rejected' then
    update public.profiles set tokens_available = tokens_available + v_withdrawal.amount_tokens where id = v_withdrawal.user_id returning tokens_available into v_balance;
    insert into public.wallet_transactions (user_id, kind, amount_tokens, balance_after, description, reference_id, reference_type)
      values (v_withdrawal.user_id, 'adjustment', v_withdrawal.amount_tokens, v_balance, 'Withdrawal request refunded', v_withdrawal.id, 'withdrawal');
  end if;
  return to_jsonb(v_withdrawal);
end;
$$;

revoke all on function public.claim_daily_check_in(uuid) from public, anon, authenticated;
revoke all on function public.submit_task(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.review_submission(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.request_withdrawal(uuid, bigint, text, text) from public, anon, authenticated;
revoke all on function public.review_withdrawal(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_daily_check_in(uuid) to service_role;
grant execute on function public.submit_task(uuid, uuid, text, text) to service_role;
grant execute on function public.review_submission(uuid, uuid, text, text) to service_role;
grant execute on function public.request_withdrawal(uuid, bigint, text, text) to service_role;
grant execute on function public.review_withdrawal(uuid, uuid, text, text) to service_role;
