import { setCors, sbGetUser, sbSelect, SUPABASE_URL, SERVICE_KEY } from "./_utils.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const authHeader = req.headers["authorization"] || "";
  const token      = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return res.status(401).json({ ok: false, error: "مطلوب تسجيل الدخول" });
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("[balance] Missing Supabase env vars");
    return res.status(500).json({ ok: false, error: "إعدادات الخادم ناقصة" });
  }

  try {
    // ── 1. تحقق من الـ JWT وجيب user_id ─────────────────────────────────────
    const user = await sbGetUser(token);
    if (!user?.id) {
      return res.status(401).json({ ok: false, error: "جلسة غير صالحة" });
    }

    // ── 2. اجلب الرصيد من profiles مباشرةً (service role — يتجاوز RLS) ─────
    const rows = await sbSelect(
      "profiles",
      `id=eq.${encodeURIComponent(user.id)}&select=balance,id`
    );

    const balance = Number(rows?.[0]?.balance ?? 0);
    console.log(`[balance] user=${user.id} balance=${balance}`);

    return res.json({ ok: true, success: true, balance, user_id: user.id });

  } catch (err) {
    console.error("[balance] error:", err.message);
    return res.status(500).json({ ok: false, error: err.message, balance: 0 });
  }
}
