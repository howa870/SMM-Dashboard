-- ════════════════════════════════════════════════════════════════════
-- Boost Iraq — Supabase Setup SQL
-- انسخ هذا الكود والصقه في Supabase Dashboard → SQL Editor → Run
-- ════════════════════════════════════════════════════════════════════

-- ── 1. حذف policies القديمة من profiles ──────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles') LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON profiles;';
  END LOOP;
END $$;

-- ── 2. إنشاء جدول profiles ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text,
  name       text,
  balance    numeric DEFAULT 0,
  created_at timestamp DEFAULT now()
);

-- ── 3. تفعيل RLS ──────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ── 4. policies للمستخدم (service role يتجاوز RLS تلقائياً) ───────
CREATE POLICY "read_own_profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "insert_own_profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "update_own_profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "delete_own_profile"
  ON profiles FOR DELETE
  USING (auth.uid() = id);

-- ── 5. جدول orders ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                  serial PRIMARY KEY,
  user_id             uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  provider_service_id text,
  provider_order_id   text,
  link                text NOT NULL,
  quantity            integer NOT NULL,
  total_price         numeric DEFAULT 0,
  status              text DEFAULT 'pending',
  created_at          timestamp DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- حذف policies قديمة للـ orders
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'orders') LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON orders;';
  END LOOP;
END $$;

CREATE POLICY "read_own_orders"
  ON orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "insert_own_orders"
  ON orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ── 6. جدول services ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS services (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  category            text,
  platform            text,
  platform_id         integer,
  service_type        text,
  price               numeric DEFAULT 0,
  min_order           integer DEFAULT 10,
  max_order           integer DEFAULT 100000,
  provider            text DEFAULT 'followiz',
  provider_service_id text UNIQUE,
  status              text DEFAULT 'active',
  created_at          timestamp DEFAULT now(),
  updated_at          timestamp DEFAULT now()
);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- حذف policies قديمة للـ services
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'services') LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON services;';
  END LOOP;
END $$;

-- الخدمات قابلة للقراءة من الجميع
CREATE POLICY "services_public_read"
  ON services FOR SELECT
  USING (true);

-- ── 7. إضافة أعمدة ناقصة إن وجدت ────────────────────────────────
ALTER TABLE services ADD COLUMN IF NOT EXISTS service_type text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS platform_id integer;

-- ── 8. trigger: إنشاء profile تلقائياً عند التسجيل ──────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ════════════════════════════════════════════════════════════════════
-- تم! الآن اذهب إلى Vercel وأضف هذه env vars:
-- VITE_SUPABASE_URL       = رابط مشروعك في Supabase
-- VITE_SUPABASE_ANON_KEY  = مفتاح anon
-- SUPABASE_SERVICE_ROLE_KEY = مفتاح service role
-- FOLLOWIZ_KEY            = 7df9c35df34ad299ded4d7e2177cc6cc
-- TELEGRAM_BOT_TOKEN      = توكن البوت
-- ════════════════════════════════════════════════════════════════════
