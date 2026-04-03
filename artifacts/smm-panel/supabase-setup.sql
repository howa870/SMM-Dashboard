-- ============================================================
-- Perfect Follow - Supabase Database Setup
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. PLATFORMS TABLE
create table if not exists public.platforms (
  id serial primary key,
  name text not null,
  icon text default '⭐',
  color text default '#7c3aed',
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz default now()
);

-- 2. SERVICES TABLE
create table if not exists public.services (
  id serial primary key,
  platform_id integer not null references public.platforms(id) on delete cascade,
  name text not null,
  description text default '',
  price numeric(10,2) not null,
  min_order integer not null default 100,
  max_order integer not null default 100000,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz default now()
);

-- 3. PROFILES TABLE (linked to Supabase Auth users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  balance numeric(10,2) not null default 0,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz default now()
);

-- 4. ORDERS TABLE
create table if not exists public.orders (
  id serial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  service_id integer not null references public.services(id),
  link text not null,
  quantity integer not null,
  total_price numeric(10,2) not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'cancelled', 'failed')),
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

alter table public.platforms enable row level security;
alter table public.services enable row level security;
alter table public.profiles enable row level security;
alter table public.orders enable row level security;

-- Platforms: anyone can read
drop policy if exists "platforms_select" on public.platforms;
create policy "platforms_select" on public.platforms for select using (true);

-- Services: anyone can read
drop policy if exists "services_select" on public.services;
create policy "services_select" on public.services for select using (true);

-- Profiles: users can read/update their own profile
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Orders: users can read/insert their own orders
drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own" on public.orders for select using (auth.uid() = user_id);

drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_own" on public.orders for insert with check (auth.uid() = user_id);

-- ============================================================
-- SEED: PLATFORMS
-- ============================================================
insert into public.platforms (name, icon, color) values
  ('Instagram', '📸', '#e1306c'),
  ('TikTok', '🎵', '#010101'),
  ('Telegram', '✈️', '#2ca5e0'),
  ('Facebook', '👍', '#1877f2'),
  ('YouTube', '▶️', '#ff0000'),
  ('Twitter / X', '🐦', '#14171a'),
  ('Snapchat', '👻', '#fffc00'),
  ('Twitch', '🎮', '#9146ff'),
  ('Spotify', '🎧', '#1db954'),
  ('SoundCloud', '🔊', '#ff5500')
on conflict do nothing;

-- ============================================================
-- SEED: SERVICES (examples - adjust prices as needed)
-- ============================================================
insert into public.services (platform_id, name, description, price, min_order, max_order) values
  -- Instagram (id=1)
  (1, 'متابعين إنستقرام - عرب', 'متابعين عرب حقيقيون', 2500, 100, 50000),
  (1, 'متابعين إنستقرام - عالمي', 'متابعين عالميون', 1500, 100, 100000),
  (1, 'إعجابات إنستقرام', 'لايكات على المنشور', 800, 50, 50000),
  -- TikTok (id=2)
  (2, 'متابعين تيك توك', 'متابعين تيك توك حقيقيون', 2000, 100, 50000),
  (2, 'مشاهدات تيك توك', 'مشاهدات فيديو تيك توك', 300, 1000, 1000000),
  -- Telegram (id=3)
  (3, 'أعضاء قناة تيليقرام', 'أعضاء نشطون في القناة', 3000, 100, 50000),
  -- Facebook (id=4)
  (4, 'متابعين فيسبوك', 'متابعين صفحة فيسبوك', 2000, 100, 50000),
  (4, 'إعجابات فيسبوك', 'لايكات على الصفحة', 1000, 100, 50000),
  -- YouTube (id=5)
  (5, 'مشتركين يوتيوب', 'مشتركين قناة يوتيوب', 5000, 50, 10000),
  (5, 'مشاهدات يوتيوب', 'مشاهدات على الفيديو', 500, 1000, 1000000),
  -- Twitter (id=6)
  (6, 'متابعين تويتر', 'متابعين حقيقيون', 2500, 100, 50000),
  -- Snapchat (id=7)
  (7, 'متابعين سناب شات', 'متابعين سناب', 3000, 100, 30000),
  -- Twitch (id=8)
  (8, 'متابعين تويتش', 'متابعين قناة تويتش', 4000, 50, 20000),
  -- Spotify (id=9)
  (9, 'متابعين سبوتيفاي', 'متابعين سبوتيفاي', 2000, 100, 50000),
  -- SoundCloud (id=10)
  (10, 'متابعين ساوند كلاود', 'متابعين ساوند كلاود', 1500, 100, 50000)
on conflict do nothing;

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP (trigger)
-- ============================================================
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
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Done!
select 'Setup complete! Tables created, RLS configured, data seeded.' as result;
