import { setCors, sbInsert, followizCall, FOLLOWIZ_KEY, SERVICE_KEY } from "./_utils.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const { service, link, quantity, provider_service_id, price_per_1000 } = req.body || {};
  const svcId = service || provider_service_id;

  if (!svcId || !link || !quantity) {
    return res.status(400).json({ ok: false, error: "service و link و quantity مطلوبة" });
  }
  if (!FOLLOWIZ_KEY) {
    return res.status(500).json({ ok: false, error: "FOLLOWIZ_KEY غير مضبوط على الخادم" });
  }

  try {
    // ── Send order to Followiz ────────────────────────────────────────────────
    const result = await followizCall({
      action:   "add",
      service:  String(svcId),
      link:     String(link),
      quantity: String(quantity),
    });

    console.log("[order] Followiz result:", result);

    // ── Save to Supabase (non-blocking) ───────────────────────────────────────
    if (SERVICE_KEY && result.order) {
      const qty   = Number(quantity);
      const ppm   = Number(price_per_1000 || 0);
      const total = ppm > 0 ? (qty / 1000) * ppm : 0;

      sbInsert("orders", {
        provider_service_id: String(svcId),
        provider_order_id:   String(result.order),
        link:                String(link),
        quantity:            qty,
        total_price:         total,
        status:              "pending",
      }).catch(err => console.warn("[order] DB save failed:", err.message));
    }

    res.json({
      ok:                true,
      order:             result,
      followiz_order_id: String(result.order ?? ""),
    });

  } catch (err) {
    console.error("[order]", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
}
