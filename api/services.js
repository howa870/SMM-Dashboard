import { setCors, sbSelect, followizCall, FOLLOWIZ_KEY, SERVICE_KEY } from "./_utils.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    // ── Try Supabase DB first ─────────────────────────────────────────────────
    if (SERVICE_KEY) {
      try {
        const data = await sbSelect("services", "status=eq.active&order=id");
        if (Array.isArray(data) && data.length > 0) {
          return res.json({ ok: true, success: true, services: data, data, count: data.length });
        }
      } catch (dbErr) {
        console.warn("[services] Supabase fallback:", dbErr.message);
      }
    }

    // ── Fallback: Followiz direct ─────────────────────────────────────────────
    if (!FOLLOWIZ_KEY) {
      return res.status(503).json({ ok: false, error: "FOLLOWIZ_KEY غير مضبوط" });
    }
    const raw = await followizCall({ action: "services" });
    const services = Array.isArray(raw) ? raw : [];
    res.json({ ok: true, success: true, services, data: services, count: services.length, source: "followiz" });

  } catch (err) {
    console.error("[services]", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
}
