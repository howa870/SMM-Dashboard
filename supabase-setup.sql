-- ════════════════════════════════════════════════════════════════════
--  Boost Iraq — Supabase Setup SQL  (v3 — نسخة شاملة ومحسّنة)
--  انسخ هذا الكود والصقه في:
--    Supabase Dashboard → SQL Editor → New Query → Run
-- ════════════════════════════════════════════════════════════════════

-- ── 0. حذف جميع Policies القديمة لتجنب التعارض ───────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'profiles','orders','services',
        'payments','notifications','payment_settings'
      )
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
  balance    numeric NOT NULL DEFAULT 0,
  role       text NOT NULL DEFAULT 'user',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- أعمدة إضافية (آمن إن وجدت)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role       text NOT NULL DEFAULT 'user';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ⚡ (SELECT auth.uid()) يمنع infinite recursion بشكل مضمون
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING     ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "profiles_delete_own"
  ON profiles FOR DELETE
  USING ((SELECT auth.uid()) = id);

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
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_select_own"
  ON orders FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "orders_insert_own"
  ON orders FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ════════════════════════════════════════════════════════════════════
-- 3. SERVICES — قراءة عامة (لا يحتاج تسجيل دخول)
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
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

ALTER TABLE services ADD COLUMN IF NOT EXISTS service_type text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS platform_id  integer;
ALTER TABLE services ADD COLUMN IF NOT EXISTS updated_at   timestamptz DEFAULT now();

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "services_public_read"
  ON services FOR SELECT
  USING (true);

-- ════════════════════════════════════════════════════════════════════
-- 4. PAYMENTS — يُدار عبر service role فقط (API/Bot)
-- ════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS payments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  amount         numeric NOT NULL,
  method         text NOT NULL DEFAULT 'manual',
  transaction_id text,
  proof_url      text,
  notes          text,
  status         text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','approved','rejected')),
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- المستخدم يرى طلباته فقط
CREATE POLICY "payments_select_own"
  ON payments FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

-- INSERT والـ UPDATE عبر service role فقط — لا policy للمستخدم

-- ════════════════════════════════════════════════════════════════════
-- 5. PAYMENT_SETTINGS — أرقام الدفع (زين/آسياسيل/QiCard)
-- ════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS payment_settings (
  id         serial PRIMARY KEY,
  key        text UNIQUE NOT NULL,
  value      text NOT NULL DEFAULT '',
  label      text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS label      text;
ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_settings_public_read"
  ON payment_settings FOR SELECT
  USING (true);

INSERT INTO payment_settings (key, value, label) VALUES
  ('zaincash_number',  '', 'زين كاش'),
  ('asiacell_number',  '', 'آسياسيل'),
  ('qicard_number',    '', 'QiCard')
ON CONFLICT (key) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════
-- 6. NOTIFICATIONS — إشعارات داخل التطبيق
-- ════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      text NOT NULL,
  message    text,
  is_read    boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_own"
  ON notifications FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE
  USING ((SELECT auth.uid()) = user_id);

-- ════════════════════════════════════════════════════════════════════
-- 7. STORAGE — رفع صور الإثبات (payment-proofs)
-- ════════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  DROP POLICY IF EXISTS "payment_proofs_upload" ON storage.objects;
  DROP POLICY IF EXISTS "payment_proofs_read"   ON storage.objects;

  CREATE POLICY "payment_proofs_upload"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'payment-proofs'
      AND (SELECT auth.uid()) IS NOT NULL
    );

  CREATE POLICY "payment_proofs_read"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'payment-proofs');
END $$;

-- ════════════════════════════════════════════════════════════════════
-- 8. RPC: increment_balance — تحديث الرصيد ذري (Atomic)
--    يُستخدم من الخادم فقط (SECURITY DEFINER)
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.increment_balance(uid uuid, amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET    balance    = balance + amount,
         updated_at = now()
  WHERE  id = uid;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_balance(uid uuid, amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET    balance    = GREATEST(0, balance - amount),
         updated_at = now()
  WHERE  id = uid;
END;
$$;

-- ════════════════════════════════════════════════════════════════════
-- 9. TRIGGER — إنشاء Profile تلقائياً عند التسجيل
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, balance, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    0,
    'user'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ════════════════════════════════════════════════════════════════════
-- 10. TRIGGER — updated_at تلقائي
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS payments_updated_at ON payments;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ════════════════════════════════════════════════════════════════════
-- 11. Backfill — تأكيد وجود Profile لجميع المستخدمين الحاليين
-- ════════════════════════════════════════════════════════════════════
INSERT INTO public.profiles (id, email, name, balance, role)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
  0,
  'user'
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = au.id
)
ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════
-- ✅ اكتمل الإعداد!
--
-- متغيرات Vercel المطلوبة (Settings → Environment Variables):
--
--   VITE_SUPABASE_URL          https://xxxx.supabase.co
--   VITE_SUPABASE_ANON_KEY     eyJhb...  (مفتاح anon، عام)
--   SUPABASE_SERVICE_ROLE_KEY  eyJhb...  (سري — لا تنشره أبداً)
--   FOLLOWIZ_KEY               7df9c35df34ad299ded4d7e2177cc6cc
--   TELEGRAM_BOT_TOKEN         123456:ABCdef...
--   TELEGRAM_ADMIN_ID          6460074022
--
-- تسجيل Webhook للبوت (مرة واحدة بعد النشر على Vercel):
--   curl "https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://YOUR_DOMAIN/api/telegram"
-- ════════════════════════════════════════════════════════════════════
