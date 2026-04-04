import { createClient } from "@supabase/supabase-js";

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string | undefined;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "[Supabase] ⚠️ Missing environment variables:\n" +
    "  VITE_SUPABASE_URL:      " + (supabaseUrl  ? "✅ set" : "❌ MISSING") + "\n" +
    "  VITE_SUPABASE_ANON_KEY: " + (supabaseKey  ? "✅ set" : "❌ MISSING") + "\n" +
    "→ For local dev: add them to .env file\n" +
    "→ For Vercel: add them in Project Settings → Environment Variables"
  );
}

export const supabase = createClient(
  supabaseUrl  ?? "",
  supabaseKey  ?? "",
  {
    auth: {
      autoRefreshToken:   true,
      persistSession:     true,
      detectSessionInUrl: true,
    },
  }
);
