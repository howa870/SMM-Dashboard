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

-- 5. PAYMENTS TABLE
create table if not exists public.payments (
  id serial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  method text not null check (method in ('zaincash', 'qicard', 'manual')),
  transaction_id text,
  proof_url text,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now()
);

-- Add proof_url if table already exists (safe migration)
alter table public.payments add column if not exists proof_url text;

-- 6. NOTIFICATIONS TABLE
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

alter table public.platforms enable row level security;
alter table public.services enable row level security;
alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.payments enable row level security;
alter table public.notifications enable row level security;

-- Platforms: anyone can read
drop policy if exists "platforms_select" on public.platforms;
create policy "platforms_select" on public.platforms for select using (true);

-- Services: anyone can read
drop policy if exists "services_select" on public.services;
create policy "services_select" on public.services for select using (true);

-- Profiles: users can read/update their own; admins can read/update all
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (
  auth.uid() = id
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (
  auth.uid() = id
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- Orders: users can read/insert their own; admins can read all
drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own" on public.orders for select using (
  auth.uid() = user_id
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_own" on public.orders for insert with check (auth.uid() = user_id);

-- Payments: users can see/insert their own; admins can see/update all
drop policy if exists "payments_select" on public.payments;
create policy "payments_select" on public.payments for select using (
  auth.uid() = user_id
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

drop policy if exists "payments_insert_own" on public.payments;
create policy "payments_insert_own" on public.payments for insert with check (auth.uid() = user_id);

drop policy if exists "payments_update_admin" on public.payments;
create policy "payments_update_admin" on public.payments for update using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- Notifications: users can see/update their own
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications for select using (auth.uid() = user_id);

drop policy if exists "notifications_insert_admin" on public.notifications;
create policy "notifications_insert_admin" on public.notifications for insert with check (
  auth.uid() = user_id
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications for update using (auth.uid() = user_id);

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

-- ============================================================
-- HOW TO CREATE AN ADMIN USER
-- After running this script:
-- 1. Register a new user via the app (or Supabase Dashboard → Authentication → Users → Invite user)
-- 2. Copy the user's UUID from the auth.users table
-- 3. Run this query (replace the UUID):
--
--    update public.profiles
--    set role = 'admin'
--    where id = 'PASTE-USER-UUID-HERE';
--
-- That user will now have admin access to /admin, /admin/payments, etc.
-- ============================================================

-- HOW TO ADD A PAYMENT (for testing):
-- insert into public.payments (user_id, amount, method, transaction_id, notes)
-- values ('USER-UUID-HERE', 5000, 'zaincash', 'TX123456', 'test payment');

-- ============================================================
-- REALTIME: Enable Realtime for tables
-- ============================================================
-- Run in Supabase Dashboard → Database → Replication:
-- Enable realtime on: payments, notifications, profiles
--
-- OR run these SQL commands:
alter publication supabase_realtime add table public.payments;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.profiles;

-- ============================================================
-- STORAGE: Create payment_proofs bucket
-- ============================================================
-- Run in Supabase Dashboard → Storage → New Bucket:
-- Name: payment_proofs
-- Public: true (or set up RLS on storage)
--
-- OR run via SQL:
insert into storage.buckets (id, name, public) values ('payment_proofs', 'payment_proofs', true)
on conflict (id) do nothing;

-- Storage policy: allow authenticated users to upload to their own folder
create policy "users_upload_proof" on storage.objects for insert
  with check (bucket_id = 'payment_proofs' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "public_view_proof" on storage.objects for select
  using (bucket_id = 'payment_proofs');

-- ============================================================
-- TELEGRAM SETUP (Optional)
-- ============================================================
-- Set these environment variables in your Replit Secrets:
--   TELEGRAM_BOT_TOKEN = your bot token from @BotFather
--   TELEGRAM_CHAT_ID = your admin group/channel chat ID
--   ADMIN_URL = https://your-app-url.replit.app/#/admin/payments

-- Done!
select 'Setup complete! Tables created, RLS configured, data seeded.' as result;
