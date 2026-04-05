import { setCors, supabaseAdmin, followizCall, FOLLOWIZ_KEY } from "./_utils.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    // ── Try Supabase DB first ─────────────────────────────────────────────────
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from("services")
        .select("*")
        .eq("status", "active")
        .order("id");

      if (!error && data?.length > 0) {
        return res.json({ ok: true, data, source: "db", count: data.length });
      }
      if (error) console.warn("[services] Supabase error:", error.message);
    }

    // ── Fallback: Followiz direct ─────────────────────────────────────────────
    if (!FOLLOWIZ_KEY) {
      return res.status(503).json({ ok: false, error: "FOLLOWIZ_KEY غير مضبوط" });
    }
    const raw = await followizCall({ action: "services" });
    res.json({ ok: true, data: raw, source: "followiz" });

  } catch (err) {
    console.error("[services] error:", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
}
