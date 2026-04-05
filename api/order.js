import { setCors, sbInsert, sbUpdate, sbGetUser, sbSelect, followizCall, FOLLOWIZ_KEY, SERVICE_KEY } from "./_utils.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const { service, service_id, link, quantity, provider_service_id, price_per_1000 } = req.body || {};
  const svcId = service || service_id || provider_service_id;

  if (!svcId || !link || !quantity) {
    return res.status(400).json({ ok: false, error: "service و link و quantity مطلوبة" });
  }
  if (!FOLLOWIZ_KEY) {
    return res.status(500).json({ ok: false, error: "FOLLOWIZ_KEY غير مضبوط على الخادم" });
  }

  try {
    // ── Get user from token ───────────────────────────────────────────────────
    const authHeader = req.headers["authorization"] || "";
    const token      = authHeader.replace(/^Bearer\s+/i, "").trim();
    let uid = null;

    if (token && SERVICE_KEY) {
      try {
        const u = await sbGetUser(token);
        uid = u?.id || null;
      } catch {}
    }

    // ── Calculate price ───────────────────────────────────────────────────────
    const qty   = Number(quantity);
    const ppm   = Number(price_per_1000 || 0);
    const total = ppm > 0 ? (qty / 1000) * ppm : 0;

    // ── Check & deduct balance ────────────────────────────────────────────────
    if (uid && SERVICE_KEY && total > 0) {
      try {
        const rows = await sbSelect("profiles", `id=eq.${uid}&select=balance`);
        const currentBalance = Number(rows?.[0]?.balance ?? 0);
        if (currentBalance < total) {
          return res.status(402).json({ ok: false, error: "رصيدك غير كافٍ" });
        }
        await sbUpdate("profiles", `id=eq.${uid}`, { balance: currentBalance - total });
      } catch (e) {
        console.warn("[order] balance deduct failed:", e.message);
      }
    }

    // ── Send order to Followiz ────────────────────────────────────────────────
    const result = await followizCall({
      action:   "add",
      service:  String(svcId),
      link:     String(link),
      quantity: String(qty),
    });

    console.log("[order] Followiz result:", result);

    const orderId       = result.order ? String(result.order) : null;
    const followizError = result.error || null;

    // ── Save order to Supabase (non-blocking) ─────────────────────────────────
    if (SERVICE_KEY) {
      sbInsert("orders", {
        ...(uid ? { user_id: uid } : {}),
        provider_service_id: String(svcId),
        provider_order_id:   orderId || "",
        link:                String(link),
        quantity:            qty,
        total_price:         total,
        status:              "pending",
      }).catch(err => console.warn("[order] DB save failed:", err.message));
    }

    if (followizError && !orderId) {
      return res.status(502).json({ ok: false, error: followizError });
    }

    const data = {
      order_id:          orderId,
      followiz_order_id: orderId,
      total_price:       total,
      service_id:        svcId,
      status:            "pending",
    };

    res.json({ ok: true, success: true, data, order_id: orderId, total_price: total });

  } catch (err) {
    console.error("[order]", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
}
