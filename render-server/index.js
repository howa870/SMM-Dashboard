import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const PORT         = process.env.PORT || 3000;
const FOLLOWIZ_URL = "https://followiz.com/api/v2";
const FOLLOWIZ_KEY = process.env.FOLLOWIZ_KEY || "";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const REPLIT_DOMAIN = process.env.REPLIT_DEV_DOMAIN || "";
const REPL_SLUG    = process.env.REPL_SLUG  || "";
const REPL_OWNER   = process.env.REPL_OWNER || "";

if (!FOLLOWIZ_KEY) console.warn("[SMM] ⚠️  FOLLOWIZ_KEY not set — orders will fail");
if (!SUPABASE_URL) console.warn("[SMM] ⚠️  SUPABASE_URL not set  — DB queries disabled");
if (!SERVICE_KEY)  console.warn("[SMM] ⚠️  SUPABASE_SERVICE_ROLE_KEY not set — admin disabled");

// ─── SUPABASE ADMIN CLIENT ───────────────────────────────────────────────────
const supabase = (SUPABASE_URL && SERVICE_KEY)
  ? createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

// ─── FOLLOWIZ HELPER ─────────────────────────────────────────────────────────
async function followizCall(params) {
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

// ─── EXPRESS ─────────────────────────────────────────────────────────────────
const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ── GET /  ───────────────────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.json({ status: "API شغال ✅", version: "1.0.0" });
});

// ── GET /api ─────────────────────────────────────────────────────────────────
app.get("/api", (_req, res) => {
  res.json({
    status:    "API شغال ✅",
    endpoints: [
      "GET  /",
      "GET  /api",
      "GET  /api/smm/services",
      "POST /order",
      "POST /api/smm/order",
      "POST /api/auth/supabase-register",
    ],
  });
});

// ── GET /api/smm/services ────────────────────────────────────────────────────
app.get("/api/smm/services", async (_req, res) => {
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("status", "active")
        .order("id");
      if (!error && data?.length > 0)
        return res.json({ ok: true, data, source: "db" });
    }

    // Fallback: fetch directly from Followiz
    if (!FOLLOWIZ_KEY)
      return res.status(503).json({ ok: false, error: "FOLLOWIZ_KEY غير مضبوط" });

    const raw = await followizCall({ action: "services" });
    res.json({ ok: true, data: raw, source: "followiz" });
  } catch (err) {
    console.error("[SMM] /api/smm/services:", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /order ───────────────────────────────────────────────────────────────
// Body: { service, link, quantity }
app.post("/order", async (req, res) => {
  const { service, link, quantity } = req.body || {};

  if (!service || !link || !quantity) {
    return res.status(400).json({ ok: false, error: "service و link و quantity مطلوبة" });
  }
  if (!FOLLOWIZ_KEY) {
    return res.status(500).json({ ok: false, error: "FOLLOWIZ_KEY غير مضبوط" });
  }

  try {
    const result = await followizCall({
      action:   "add",
      service:  String(service),
      link:     String(link),
      quantity: String(quantity),
    });
    console.log("[SMM] /order result:", result);
    res.json({ ok: true, order: result });
  } catch (err) {
    console.error("[SMM] /order error:", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/smm/order ───────────────────────────────────────────────────────
app.post("/api/smm/order", async (req, res) => {
  const { service, link, quantity, provider_service_id } = req.body || {};
  const svcId = service || provider_service_id;

  if (!svcId || !link || !quantity) {
    return res.status(400).json({ ok: false, error: "service و link و quantity مطلوبة" });
  }
  if (!FOLLOWIZ_KEY) {
    return res.status(500).json({ ok: false, error: "FOLLOWIZ_KEY غير مضبوط" });
  }

  try {
    const result = await followizCall({
      action:   "add",
      service:  String(svcId),
      link:     String(link),
      quantity: String(quantity),
    });
    console.log("[SMM] /api/smm/order result:", result);
    res.json({
      ok:               true,
      order:            result,
      followiz_order_id: String(result.order ?? ""),
    });
  } catch (err) {
    console.error("[SMM] /api/smm/order error:", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/auth/supabase-register ─────────────────────────────────────────
app.post("/api/auth/supabase-register", async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password)
    return res.status(400).json({ error: "الاسم والبريد وكلمة المرور مطلوبة" });
  if (password.length < 6)
    return res.status(400).json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" });
  if (!supabase)
    return res.status(500).json({ error: "إعدادات Supabase غير مكتملة (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)" });

  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });
    if (error) {
      console.error("[Auth] createUser error:", error.message);
      const msg = (error.message.includes("already") || error.message.includes("registered"))
        ? "هذا البريد الإلكتروني مسجّل مسبقاً"
        : error.message;
      return res.status(400).json({ error: msg });
    }
    res.status(201).json({ success: true, userId: data.user?.id });
  } catch (err) {
    console.error("[Auth] supabase-register:", err.message);
    res.status(500).json({ error: err.message ?? "خطأ في إنشاء الحساب" });
  }
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ─── START ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  const baseUrl = REPLIT_DOMAIN
    ? `https://${REPLIT_DOMAIN}`
    : REPL_SLUG && REPL_OWNER
      ? `https://${REPL_SLUG}.${REPL_OWNER}.replit.dev`
      : `http://localhost:${PORT}`;

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`🚀  Server running on port ${PORT}`);
  console.log(`📍  Base URL : ${baseUrl}`);
  console.log(`🔗  API  URL : ${baseUrl}/api`);
  console.log(`📦  Services : ${baseUrl}/api/smm/services`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
});
