import { setCors, sbGetUser, sbSelect, followizCall, FOLLOWIZ_KEY, ANON_KEY, SERVICE_KEY } from "./_utils.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const authHeader = req.headers["authorization"] || "";
    const token      = authHeader.replace(/^Bearer\s+/i, "").trim();

    // ── User wallet balance from Supabase (primary) ───────────────────────────
    if (token && SERVICE_KEY) {
      try {
        const user = await sbGetUser(token);
        if (user?.id) {
          const rows = await sbSelect("profiles", `id=eq.${user.id}&select=balance`);
          const balance = Number(rows?.[0]?.balance ?? 0);
          return res.json({ ok: true, success: true, balance });
        }
      } catch (e) {
        console.warn("[balance] user lookup failed:", e.message);
      }
    }

    // ── Followiz account balance (admin fallback) ─────────────────────────────
    if (FOLLOWIZ_KEY) {
      const result = await followizCall({ action: "balance" });
      const balance = Number(result.balance ?? 0);
      return res.json({ ok: true, success: true, balance, source: "followiz" });
    }

    return res.status(401).json({ ok: false, error: "مطلوب تسجيل الدخول" });

  } catch (err) {
    console.error("[balance]", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
}
