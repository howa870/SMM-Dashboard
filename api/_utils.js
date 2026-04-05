// ─── Shared helpers for all Vercel serverless functions ─────────────────────

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ANON_KEY      = process.env.VITE_SUPABASE_ANON_KEY || "";
const FOLLOWIZ_URL  = "https://followiz.com/api/v2";

export const FOLLOWIZ_KEY = process.env.FOLLOWIZ_KEY || "";
export const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";

// ─── Supabase admin client (service role) ────────────────────────────────────
export const supabaseAdmin = (SUPABASE_URL && SERVICE_KEY)
  ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

// ─── Supabase anon client (for RLS-gated queries) ────────────────────────────
export const supabase = (SUPABASE_URL && ANON_KEY)
  ? createClient(SUPABASE_URL, ANON_KEY)
  : null;

// ─── CORS headers ─────────────────────────────────────────────────────────────
export function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,apikey");
}

// ─── Followiz API ─────────────────────────────────────────────────────────────
export async function followizCall(params) {
  const body = new URLSearchParams({ key: FOLLOWIZ_KEY, ...params });
  const res  = await fetch(FOLLOWIZ_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    body.toString(),
  });
  if (!res.ok) throw new Error(`Followiz HTTP ${res.status}`);
  const text = await res.text();
  try   { return JSON.parse(text); }
  catch { throw new Error(`Followiz bad JSON: ${text.slice(0, 200)}`); }
}
