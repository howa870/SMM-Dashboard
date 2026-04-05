-- ════════════════════════════════════════════════════════════════════
-- Boost Iraq — Supabase Setup SQL  (v2 — حل infinite recursion)
-- انسخ هذا الكود والصقه في Supabase Dashboard → SQL Editor → Run
-- ════════════════════════════════════════════════════════════════════

-- ── حذف جميع policies القديمة دفعةً واحدة ───────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE tablename IN ('profiles','orders','services','payments','notifications','payment_settings')
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ════════════════════════════════════════════════════════════════════
-- 1. PROFILES
-- ════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text,
  name       text,
  balance    numeric DEFAULT 0,
  role       text DEFAULT 'user',
  created_at timestamp DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ⚡ (select auth.uid()) بدلاً من auth.uid() — يمنع infinite recursion
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  USING ((select auth.uid()) = id);

CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "profiles_delete_own"
  ON profiles FOR DELETE
  USING ((select auth.uid()) = id);

-- ════════════════════════════════════════════════════════════════════
-- 2. ORDERS
-- ════════════════════════════════════════════════════════════════════
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

CREATE POLICY "orders_select_own"
  ON orders FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "orders_insert_own"
  ON orders FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

-- ════════════════════════════════════════════════════════════════════
-- 3. SERVICES
-- ════════════════════════════════════════════════════════════════════
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

CREATE POLICY "services_public_read"
  ON services FOR SELECT
  USING (true);

-- ════════════════════════════════════════════════════════════════════
-- 4. PAYMENTS — يُدار بالكامل عبر service role (API serverless)
-- ════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS payments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  amount         numeric NOT NULL,
  method         text NOT NULL DEFAULT 'manual',
  transaction_id text,
  proof_url      text,
  notes          text,
  status         text NOT NULL DEFAULT 'pending',
  created_at     timestamp DEFAULT now()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- المستخدم يقرأ مدفوعاته فقط
CREATE POLICY "payments_select_own"
  ON payments FOR SELECT
  USING ((select auth.uid()) = user_id);

-- الـ INSERT والـ UPDATE عبر service role فقط — لا policy للمستخدم

-- ════════════════════════════════════════════════════════════════════
-- 5. PAYMENT_SETTINGS
-- ════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS payment_settings (
  id         serial PRIMARY KEY,
  key        text UNIQUE NOT NULL,
  value      text NOT NULL DEFAULT '',
  updated_at timestamp DEFAULT now()
);

ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_settings_public_read"
  ON payment_settings FOR SELECT
  USING (true);

INSERT INTO payment_settings (key, value) VALUES
  ('zaincash_number', '07XX XXX XXXX'),
  ('asiacell_number', '07XX XXX XXXX'),
  ('qicard_number',   '07XX XXX XXXX')
ON CONFLICT (key) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════
-- 6. NOTIFICATIONS
-- ════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title      text NOT NULL,
  message    text,
  is_read    boolean DEFAULT false,
  created_at timestamp DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_own"
  ON notifications FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE
  USING ((select auth.uid()) = user_id);

-- ════════════════════════════════════════════════════════════════════
-- 7. STORAGE — bucket لصور إثبات الدفع
-- ════════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND policyname = 'payment_proofs_upload'
  ) THEN
    CREATE POLICY "payment_proofs_upload"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'payment-proofs' AND (select auth.uid()) IS NOT NULL);

    CREATE POLICY "payment_proofs_read"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'payment-proofs');
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════
-- 8. TRIGGER — إنشاء profile تلقائياً عند التسجيل
-- ════════════════════════════════════════════════════════════════════
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
-- أعمدة إضافية (آمن للتشغيل على قاعدة موجودة)
-- ════════════════════════════════════════════════════════════════════
ALTER TABLE services  ADD COLUMN IF NOT EXISTS service_type text;
ALTER TABLE services  ADD COLUMN IF NOT EXISTS platform_id  integer;
ALTER TABLE profiles  ADD COLUMN IF NOT EXISTS role         text DEFAULT 'user';

-- ════════════════════════════════════════════════════════════════════
-- ✅ تم! أضف هذه env vars في Vercel → Settings → Environment Variables:
--
-- VITE_SUPABASE_URL         = رابط مشروعك  (https://xxx.supabase.co)
-- VITE_SUPABASE_ANON_KEY    = مفتاح anon (عام)
-- SUPABASE_SERVICE_ROLE_KEY = مفتاح service role (سري — لا تنشره)
-- FOLLOWIZ_KEY              = 7df9c35df34ad299ded4d7e2177cc6cc
-- TELEGRAM_BOT_TOKEN        = توكن البوت
-- TELEGRAM_ADMIN_ID         = 6460074022
-- ════════════════════════════════════════════════════════════════════
