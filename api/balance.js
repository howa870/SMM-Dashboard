import { setCors, sbGetUser, sbSelect, followizCall, FOLLOWIZ_KEY } from "./_utils.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    // ── Followiz account balance ──────────────────────────────────────────────
    if (FOLLOWIZ_KEY) {
      const result = await followizCall({ action: "balance" });
      return res.json({ ok: true, balance: result.balance ?? result, source: "followiz" });
    }

    // ── User wallet balance from Supabase ─────────────────────────────────────
    const authHeader = req.headers["authorization"] || "";
    const token      = authHeader.replace("Bearer ", "").trim();

    if (!token) return res.status(401).json({ ok: false, error: "مطلوب تسجيل الدخول" });

    const user = await sbGetUser(token);
    if (!user?.id) return res.status(401).json({ ok: false, error: "جلسة غير صالحة" });

    const rows = await sbSelect("profiles", `id=eq.${user.id}&select=balance`);
    const balance = rows?.[0]?.balance ?? 0;

    res.json({ ok: true, balance, source: "db" });

  } catch (err) {
    console.error("[balance]", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
}
