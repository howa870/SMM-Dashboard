-- ============================================================
-- Boost Iraq — QUICK FIX SQL
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- This fixes: registration errors, service sync, and order tracking
-- ============================================================

-- 1. PROFILES TABLE (required for user registration)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  balance numeric(10,2) not null default 0,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz default now()
);

-- Add missing columns if table already existed
alter table public.profiles add column if not exists name text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists balance numeric(10,2) not null default 0;
alter table public.profiles add column if not exists role text not null default 'user';
alter table public.profiles add column if not exists created_at timestamptz default now();

-- Enable RLS on profiles
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin" on public.profiles for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- 2. SERVICES TABLE (with provider_service_id for Followiz sync)
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

-- Critical migration: add provider_service_id for Followiz sync
alter table public.services add column if not exists provider_service_id text;
alter table public.services add column if not exists service_type text;
alter table public.services add column if not exists category text;
alter table public.services add column if not exists platform text;
alter table public.services add column if not exists dripfeed boolean default false;
alter table public.services add column if not exists refill boolean default false;
alter table public.services add column if not exists cancel boolean default false;

-- Unique index needed for upsert ON CONFLICT
drop index if exists services_provider_service_id_key;
create unique index if not exists services_provider_service_id_key
  on public.services (provider_service_id)
  where provider_service_id is not null;

-- Enable RLS on services
alter table public.services enable row level security;
drop policy if exists "services_public_read" on public.services;
create policy "services_public_read" on public.services for select using (true);
drop policy if exists "services_admin_all" on public.services;
create policy "services_admin_all" on public.services for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- 3. ORDERS TABLE (with provider_order_id for Followiz tracking)
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

-- Make service_id nullable (in case service gets removed)
alter table public.orders alter column service_id drop not null;

-- Add provider_order_id for tracking orders from Followiz
alter table public.orders add column if not exists provider_order_id text;
alter table public.orders add column if not exists notes text;

-- Enable RLS on orders
alter table public.orders enable row level security;
drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own" on public.orders for select using (auth.uid() = user_id);
drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_own" on public.orders for insert with check (auth.uid() = user_id);
drop policy if exists "orders_admin_all" on public.orders;
create policy "orders_admin_all" on public.orders for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- 4. PAYMENTS TABLE
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

-- Enable RLS on payments
alter table public.payments enable row level security;
drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own" on public.payments for select using (auth.uid() = user_id);
drop policy if exists "payments_insert_own" on public.payments;
create policy "payments_insert_own" on public.payments for insert with check (auth.uid() = user_id);
drop policy if exists "payments_admin_all" on public.payments;
create policy "payments_admin_all" on public.payments for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- 5. NOTIFICATIONS TABLE
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

-- Enable RLS on notifications
alter table public.notifications enable row level security;
drop policy if exists "notifs_select_own" on public.notifications;
create policy "notifs_select_own" on public.notifications for select using (auth.uid() = user_id);
drop policy if exists "notifs_update_own" on public.notifications;
create policy "notifs_update_own" on public.notifications for update using (auth.uid() = user_id);
drop policy if exists "notifs_admin_all" on public.notifications;
create policy "notifs_admin_all" on public.notifications for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- 6. AUTO-CREATE PROFILE ON SIGNUP (trigger — with safe exception handling)
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
  -- Never fail user creation even if profile insert has issues
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 7. INCREMENT BALANCE FUNCTION (for payment approvals)
create or replace function public.increment_balance(uid uuid, amount numeric)
returns void as $$
begin
  update public.profiles
  set balance = balance + amount
  where id = uid;
end;
$$ language plpgsql security definer;

-- 8. DECREMENT BALANCE FUNCTION (for order deductions)
create or replace function public.decrement_balance(uid uuid, amount numeric)
returns void as $$
begin
  update public.profiles
  set balance = greatest(0, balance - amount)
  where id = uid;
end;
$$ language plpgsql security definer;

-- ============================================================
-- DONE! All tables and functions are now ready.
-- After running this, go back to your app and try registering again.
-- ============================================================
