-- ============================================================
-- Boost Iraq — COMPLETE FIX SQL (v2)
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- Fixes: registration, infinite recursion in policies, service sync
-- ============================================================

-- ── STEP 1: Helper function to get current user role (bypasses RLS) ──────────
-- This is REQUIRED to prevent infinite recursion in admin policies
create or replace function public.get_my_role()
returns text
language sql
security definer        -- runs as the function owner, bypasses RLS
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ── STEP 2: PROFILES TABLE ────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  balance numeric(10,2) not null default 0,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz default now()
);

alter table public.profiles add column if not exists name text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists balance numeric(10,2) not null default 0;
alter table public.profiles add column if not exists role text not null default 'user';
alter table public.profiles add column if not exists created_at timestamptz default now();

alter table public.profiles enable row level security;

-- Drop all existing profiles policies (clean slate)
drop policy if exists "profiles_select_own"    on public.profiles;
drop policy if exists "profiles_insert_own"    on public.profiles;
drop policy if exists "profiles_update_own"    on public.profiles;
drop policy if exists "profiles_select_admin"  on public.profiles;
drop policy if exists "profiles_admin_all"     on public.profiles;
drop policy if exists "profiles_all"           on public.profiles;

-- Users can read/update their own profile
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Admins can do everything — using SECURITY DEFINER function (no recursion)
create policy "profiles_admin_all" on public.profiles
  for all using (public.get_my_role() = 'admin');

-- ── STEP 3: SERVICES TABLE ────────────────────────────────────────────────────
create table if not exists public.services (
  id serial primary key,
  platform_id integer,
  name text not null,
  description text default '',
  price numeric(10,2) not null,
  min_order integer not null default 100,
  max_order integer not null default 100000,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz default now()
);

-- Critical columns for Followiz sync
alter table public.services add column if not exists provider_service_id text;
alter table public.services add column if not exists service_type text;
alter table public.services add column if not exists category text;
alter table public.services add column if not exists platform text;
alter table public.services add column if not exists dripfeed boolean default false;
alter table public.services add column if not exists refill boolean default false;
alter table public.services add column if not exists cancel boolean default false;
alter table public.services add column if not exists provider text default 'followiz';

-- Unique index for ON CONFLICT upsert
drop index if exists services_provider_service_id_key;
create unique index if not exists services_provider_service_id_key
  on public.services (provider_service_id)
  where provider_service_id is not null;

alter table public.services enable row level security;

drop policy if exists "services_public_read" on public.services;
drop policy if exists "services_admin_all"   on public.services;

-- Everyone can read services
create policy "services_public_read" on public.services
  for select using (true);

-- Only admins can modify services
create policy "services_admin_all" on public.services
  for all using (public.get_my_role() = 'admin');

-- ── STEP 4: ORDERS TABLE ─────────────────────────────────────────────────────
create table if not exists public.orders (
  id serial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  service_id integer,
  link text not null,
  quantity integer not null,
  total_price numeric(10,2) not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'cancelled', 'failed')),
  created_at timestamptz default now()
);

alter table public.orders alter column service_id drop not null;
alter table public.orders add column if not exists provider_order_id text;
alter table public.orders add column if not exists notes text;

alter table public.orders enable row level security;

drop policy if exists "orders_select_own"  on public.orders;
drop policy if exists "orders_insert_own"  on public.orders;
drop policy if exists "orders_admin_all"   on public.orders;

create policy "orders_select_own" on public.orders
  for select using (auth.uid() = user_id);

create policy "orders_insert_own" on public.orders
  for insert with check (auth.uid() = user_id);

create policy "orders_admin_all" on public.orders
  for all using (public.get_my_role() = 'admin');

-- ── STEP 5: PAYMENTS TABLE ───────────────────────────────────────────────────
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  method text not null check (method in ('zaincash', 'asiacell', 'qicard', 'manual')),
  transaction_id text,
  proof_url text,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now()
);

alter table public.payments add column if not exists proof_url text;
alter table public.payments add column if not exists notes text;
alter table public.payments add column if not exists transaction_id text;

alter table public.payments enable row level security;

drop policy if exists "payments_select_own" on public.payments;
drop policy if exists "payments_insert_own" on public.payments;
drop policy if exists "payments_admin_all"  on public.payments;

create policy "payments_select_own" on public.payments
  for select using (auth.uid() = user_id);

create policy "payments_insert_own" on public.payments
  for insert with check (auth.uid() = user_id);

create policy "payments_admin_all" on public.payments
  for all using (public.get_my_role() = 'admin');

-- ── STEP 6: NOTIFICATIONS TABLE ──────────────────────────────────────────────
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  message text not null default '',
  is_read boolean not null default false,
  created_at timestamptz default now()
);

alter table public.notifications add column if not exists title text not null default '';
alter table public.notifications add column if not exists message text not null default '';
alter table public.notifications add column if not exists is_read boolean not null default false;

alter table public.notifications enable row level security;

drop policy if exists "notifs_select_own"  on public.notifications;
drop policy if exists "notifs_update_own"  on public.notifications;
drop policy if exists "notifs_admin_all"   on public.notifications;

create policy "notifs_select_own" on public.notifications
  for select using (auth.uid() = user_id);

create policy "notifs_update_own" on public.notifications
  for update using (auth.uid() = user_id);

create policy "notifs_admin_all" on public.notifications
  for all using (public.get_my_role() = 'admin');

-- ── STEP 7: PAYMENT SETTINGS TABLE ───────────────────────────────────────────
create table if not exists public.payment_settings (
  id serial primary key,
  key text unique not null,
  value text not null default '',
  label text,
  created_at timestamptz default now()
);

alter table public.payment_settings enable row level security;

drop policy if exists "settings_public_read" on public.payment_settings;
drop policy if exists "settings_admin_all"   on public.payment_settings;

create policy "settings_public_read" on public.payment_settings
  for select using (true);

create policy "settings_admin_all" on public.payment_settings
  for all using (public.get_my_role() = 'admin');

-- Default payment settings (safe insert)
insert into public.payment_settings (key, value, label) values
  ('zain',     '',  'رقم زين كاش'),
  ('asiacell', '',  'رقم آسياسيل'),
  ('qicard',   '',  'رقم QiCard')
on conflict (key) do nothing;

-- ── STEP 8: TRIGGER — AUTO-CREATE PROFILE ON SIGNUP ──────────────────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email, balance, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    0,
    'user'
  )
  on conflict (id) do nothing;
  return new;
exception when others then
  return new;  -- never fail user creation
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── STEP 9: BALANCE FUNCTIONS ────────────────────────────────────────────────
create or replace function public.increment_balance(uid uuid, amount numeric)
returns void as $$
begin
  update public.profiles set balance = balance + amount where id = uid;
end;
$$ language plpgsql security definer;

create or replace function public.decrement_balance(uid uuid, amount numeric)
returns void as $$
begin
  update public.profiles set balance = greatest(0, balance - amount) where id = uid;
end;
$$ language plpgsql security definer;

-- ── DONE ─────────────────────────────────────────────────────────────────────
-- After running this:
-- 1. Try registering a new user → should work without "Database error"
-- 2. After login → profile, orders, services should all load correctly
-- 3. To make yourself admin:
--    UPDATE public.profiles SET role = 'admin' WHERE email = 'your@email.com';
-- ─────────────────────────────────────────────────────────────────────────────
