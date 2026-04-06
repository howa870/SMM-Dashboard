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

  let uid            = null;
  let balanceDeducted = false;
  let deductedAmount  = 0;

  try {
    // ── Get user from token ───────────────────────────────────────────────────
    const authHeader = req.headers["authorization"] || "";
    const token      = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (token && SERVICE_KEY) {
      try {
        const u = await sbGetUser(token);
        uid = u?.id || null;
      } catch {}
    }

    // ── Calculate price ───────────────────────────────────────────────────────
    const qty   = Number(quantity);
    const ppm   = Number(price_per_1000 || 0);
    const total = ppm > 0 ? Math.ceil((qty / 1000) * ppm) : 0;

    // ── Check & deduct balance ────────────────────────────────────────────────
    if (uid && SERVICE_KEY && total > 0) {
      const rows           = await sbSelect("profiles", `id=eq.${uid}&select=balance`);
      const currentBalance = Number(rows?.[0]?.balance ?? 0);

      if (currentBalance < total) {
        return res.status(402).json({ ok: false, error: "رصيدك غير كافٍ" });
      }

      const newBalance = Math.max(0, currentBalance - total);
      await sbUpdate("profiles", `id=eq.${uid}`, { balance: newBalance });

      balanceDeducted = true;
      deductedAmount  = total;
      console.log(`[order] ✅ خصم ${total} IQD من ${uid} — الرصيد الجديد: ${newBalance}`);
    }

    // ── Send order to Followiz ────────────────────────────────────────────────
    let result;
    try {
      result = await followizCall({
        action:   "add",
        service:  String(svcId),
        link:     String(link),
        quantity: String(qty),
      });
    } catch (followizErr) {
      // Followiz call itself threw an error — refund immediately
      if (balanceDeducted && uid) await refundBalance(uid, deductedAmount);
      console.error("[order] Followiz call error:", followizErr.message);
      return res.status(502).json({ ok: false, error: "تعذّر الاتصال بمزوّد الخدمة — تم استرداد رصيدك" });
    }

    console.log("[order] Followiz result:", result);

    const orderId       = result.order ? String(result.order) : null;
    const followizError = result.error || null;

    // ── Followiz rejected — refund balance ────────────────────────────────────
    if (followizError && !orderId) {
      if (balanceDeducted && uid) {
        await refundBalance(uid, deductedAmount);
        console.log(`[order] 🔄 رُدّ ${deductedAmount} IQD إلى ${uid} — سبب: ${followizError}`);
      }
      return res.status(502).json({
        ok:    false,
        error: followizError,
        note:  "تم استرداد رصيدك تلقائياً",
      });
    }

    // ── Save order to Supabase (non-blocking) ─────────────────────────────────
    if (SERVICE_KEY) {
      sbInsert("orders", {
        ...(uid ? { user_id: uid } : {}),
        provider_service_id: String(svcId),
        provider_order_id:   orderId || "",
        link:                String(link),
        quantity:            qty,
        total_price:         deductedAmount || 0,
        status:              "pending",
      }).catch(err => console.warn("[order] DB save failed:", err.message));
    }

    res.json({
      ok:         true,
      success:    true,
      order_id:   orderId,
      total_price: deductedAmount,
      data: {
        order_id:          orderId,
        followiz_order_id: orderId,
        total_price:       deductedAmount,
        service_id:        svcId,
        status:            "pending",
      },
    });

  } catch (err) {
    // If anything unexpected throws after balance deduction → refund
    if (balanceDeducted && uid) {
      await refundBalance(uid, deductedAmount).catch(() => {});
      console.error(`[order] ❌ خطأ غير متوقع — رُدّ ${deductedAmount} IQD إلى ${uid}`);
    }
    console.error("[order]", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
}

// ── Refund helper ─────────────────────────────────────────────────────────────
async function refundBalance(uid, amount) {
  if (!uid || !amount || amount <= 0) return;
  try {
    const rows       = await sbSelect("profiles", `id=eq.${uid}&select=balance`);
    const current    = Number(rows?.[0]?.balance ?? 0);
    const newBalance = current + amount;
    await sbUpdate("profiles", `id=eq.${uid}`, { balance: newBalance });
    console.log(`[order] ✅ استرداد ${amount} IQD → رصيد ${uid} الجديد: ${newBalance}`);
  } catch (e) {
    console.error(`[order] ❌ فشل الاسترداد لـ ${uid}:`, e.message);
  }
}
