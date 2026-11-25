-- Snap Snack backend schema.
-- Every table is private per user (row level security). Subscription and usage columns are
-- written only by server functions (service role), never by the app.

-- ---------- accounts & subscriptions ----------
create table public.profiles (
  user_id            uuid primary key references auth.users on delete cascade,
  created_at         timestamptz not null default now(),
  trial_ends_at      timestamptz not null default (now() + interval '7 days'),  -- 7-day unlimited free trial
  plan               text not null default 'trial' check (plan in ('trial', 'monthly', 'yearly')),
  sub_status         text not null default 'trialing'
                     check (sub_status in ('trialing', 'active', 'past_due', 'canceled', 'expired')),
  current_period_end timestamptz,
  store              text check (store in ('stripe', 'apple', 'google')),
  stripe_customer_id text unique
);

-- New sign-ups get a profile (and their trial) automatically.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- True while the trial runs or a paid period is current.
create function public.has_access(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = uid
      and ( now() < p.trial_ends_at
         or (p.sub_status in ('active', 'past_due') and coalesce(p.current_period_end, now()) >= now()) )
  )
$$;

-- ---------- the user's log (mirrors the app's state) ----------
create table public.entries (
  user_id    uuid not null references auth.users on delete cascade,
  id         text not null,
  day        date not null,
  ts         bigint not null,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index entries_user_day on public.entries (user_id, day);

create table public.daily (
  user_id    uuid not null references auth.users on delete cascade,
  day        date not null,
  data       jsonb not null,           -- water, weight, activities
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

create table public.settings (
  user_id    uuid primary key references auth.users on delete cascade,
  data       jsonb not null,           -- targets, profile, plan (never API keys)
  updated_at timestamptz not null default now()
);

-- ---------- AI usage: cost tracking and the abuse cap ----------
create table public.ai_usage (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users on delete cascade,
  at            timestamptz not null default now(),
  kind          text not null check (kind in ('photo', 'command', 'estimate')),
  model         text not null,
  input_tokens  int,
  output_tokens int,
  cost_usd      numeric(10, 5),
  ok            boolean not null default true
);
create index ai_usage_user_at on public.ai_usage (user_id, at desc);

-- ---------- wearables & phone health data ----------
create table public.health_samples (
  user_id     uuid not null references auth.users on delete cascade,
  source      text not null,           -- apple_health, health_connect, garmin, fitbit, aggregator name
  kind        text not null,           -- steps, heart_rate, active_kcal, workout
  start_at    timestamptz not null,
  end_at      timestamptz,
  value       numeric not null,
  unit        text not null,
  external_id text,
  primary key (user_id, source, kind, start_at)
);

create table public.wearable_connections (
  user_id          uuid not null references auth.users on delete cascade,
  provider         text not null,      -- garmin, fitbit, or the aggregator
  provider_user_id text,
  status           text not null default 'connected',
  connected_at     timestamptz not null default now(),
  primary key (user_id, provider)
);
-- OAuth tokens live apart, readable only by server functions (no policies = no app access).
create table public.wearable_tokens (
  user_id       uuid not null references auth.users on delete cascade,
  provider      text not null,
  access_token  text not null,
  refresh_token text,
  expires_at    timestamptz,
  primary key (user_id, provider)
);

-- ---------- row level security ----------
alter table public.profiles             enable row level security;
alter table public.entries              enable row level security;
alter table public.daily                enable row level security;
alter table public.settings             enable row level security;
alter table public.ai_usage             enable row level security;
alter table public.health_samples       enable row level security;
alter table public.wearable_connections enable row level security;
alter table public.wearable_tokens      enable row level security;

create policy "read own profile" on public.profiles for select using ((select auth.uid()) = user_id);
create policy "read own usage"   on public.ai_usage for select using ((select auth.uid()) = user_id);
create policy "read own connections" on public.wearable_connections for select using ((select auth.uid()) = user_id);

create policy "own entries"  on public.entries  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own daily"    on public.daily    for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own settings" on public.settings for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own health"   on public.health_samples for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke execute on function public.has_access(uuid) from anon, authenticated, public;
