import { setCors, supabaseAdmin, followizCall, FOLLOWIZ_KEY } from "./_utils.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    // ── Followiz balance ──────────────────────────────────────────────────────
    if (FOLLOWIZ_KEY) {
      const result = await followizCall({ action: "balance" });
      return res.json({
        ok:      true,
        balance: result.balance ?? result,
        source:  "followiz",
      });
    }

    // ── Supabase user balance ─────────────────────────────────────────────────
    const authHeader = req.headers["authorization"] || "";
    const token      = authHeader.replace("Bearer ", "").trim();

    if (!token || !supabaseAdmin) {
      return res.status(401).json({ ok: false, error: "مطلوب تسجيل الدخول" });
    }

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) return res.status(401).json({ ok: false, error: "جلسة غير صالحة" });

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("balance")
      .eq("id", user.id)
      .single();

    if (error) return res.status(500).json({ ok: false, error: error.message });

    res.json({ ok: true, balance: data?.balance ?? 0, source: "db" });

  } catch (err) {
    console.error("[balance] error:", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
}
