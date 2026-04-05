// ─── Shared helpers — Zero dependencies, native fetch only ──────────────────

export const SUPABASE_URL   = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
export const ANON_KEY       = process.env.VITE_SUPABASE_ANON_KEY || "";
export const SERVICE_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
export const FOLLOWIZ_KEY   = process.env.FOLLOWIZ_KEY || "";
export const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
export const FOLLOWIZ_URL   = "https://followiz.com/api/v2";

// ─── CORS ────────────────────────────────────────────────────────────────────
export function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,apikey");
}

// ─── Supabase REST helpers ────────────────────────────────────────────────────

/** GET rows from a Supabase table (service role) */
export async function sbSelect(table, params = "") {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Supabase env vars missing");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: {
      apikey:        SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Accept:        "application/json",
    },
  });
  if (!res.ok) throw new Error(`Supabase ${table} error: ${res.status}`);
  return res.json();
}

/** INSERT a row into a Supabase table (service role) */
export async function sbInsert(table, row) {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Supabase env vars missing");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method:  "POST",
    headers: {
      apikey:          SERVICE_KEY,
      Authorization:   `Bearer ${SERVICE_KEY}`,
      "Content-Type":  "application/json",
      Prefer:          "return=representation",
    },
    body: JSON.stringify(row),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase insert ${table}: ${text.slice(0,200)}`);
  try { return JSON.parse(text); } catch { return {}; }
}

/** GET the JWT user from an Authorization Bearer token */
export async function sbGetUser(token) {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Supabase env vars missing");
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey:        ANON_KEY || SERVICE_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) return null;
  return res.json();
}

/** Create a user via Supabase Auth Admin API (service role) */
export async function sbCreateUser({ email, password, name }) {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Supabase env vars missing");
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method:  "POST",
    headers: {
      apikey:          SERVICE_KEY,
      Authorization:   `Bearer ${SERVICE_KEY}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json.msg || json.error || "Supabase error"), { status: res.status, body: json });
  return json;
}

// ─── Followiz REST helper ─────────────────────────────────────────────────────
export async function followizCall(params) {
  if (!FOLLOWIZ_KEY) throw new Error("FOLLOWIZ_KEY غير مضبوط");
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

// ─── Telegram notification ───────────────────────────────────────────────────
export async function sendTelegram(chatId, text) {
  if (!TELEGRAM_TOKEN || !chatId) return;
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  }).catch(() => {});
}
