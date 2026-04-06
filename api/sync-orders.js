/**
 * api/sync-orders.js
 * ─────────────────────────────────────────────────────
 * Vercel Cron Job — يفحص الطلبات المعلقة كل 5 دقائق
 * ويحدّث حالتها من Followiz ويرسل إشعار للمستخدم
 *
 * Vercel يستدعي هذا الـ endpoint تلقائياً حسب الجدول
 * في vercel.json → crons
 * ─────────────────────────────────────────────────────
 */

import {
  setCors,
  sbSelect,
  sbUpdate,
  sbInsert,
  followizCall,
  SERVICE_KEY,
  FOLLOWIZ_KEY,
} from "./_utils.js";

// ─── مفتاح حماية الـ endpoint من الطلبات الخارجية ───
const CRON_SECRET = process.env.CRON_SECRET || "";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  // قبول GET (من Vercel Cron) أو POST (يدوي من الأدمن)
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  // حماية بسيطة: تحقق من secret إن كان مضبوطاً
  if (CRON_SECRET) {
    const incoming =
      req.headers["authorization"]?.replace("Bearer ", "") ||
      req.query?.secret || "";
    if (incoming !== CRON_SECRET) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
  }

  if (!SERVICE_KEY || !FOLLOWIZ_KEY) {
    return res.status(500).json({ ok: false, error: "Missing env vars" });
  }

  try {
    // ── 1. اجلب الطلبات المعلقة ───────────────────────
    const orders = await sbSelect(
      "orders",
      "status=eq.pending&provider_order_id=not.is.null&provider_order_id=neq.&select=id,user_id,provider_order_id,total_price,quantity&limit=30"
    ).catch(() => []);

    if (!orders?.length) {
      return res.json({ ok: true, message: "لا طلبات معلقة", updated: 0 });
    }

    console.log(`[sync-orders] فحص ${orders.length} طلب...`);

    let updated = 0;
    const results = [];

    for (const order of orders) {
      try {
        // ── 2. استعلم Followiz عن الحالة ──────────────
        const data = await followizCall({
          action: "status",
          order:  order.provider_order_id,
        });

        const newStatus = mapStatus(data.status);
        if (!newStatus) {
          results.push({ id: order.provider_order_id, status: data.status || "unchanged" });
          continue;
        }

        // ── 3. حدّث الحالة في Supabase ─────────────────
        await sbUpdate("orders", `id=eq.${order.id}`, { status: newStatus });
        updated++;

        results.push({ id: order.provider_order_id, new_status: newStatus });

        // ── 4. أرسل إشعار للمستخدم ──────────────────────
        if (order.user_id) {
          await handleUserNotification(order, newStatus, data.status);
        }

      } catch (e) {
        console.warn(`[sync-orders] ⚠️ طلب #${order.provider_order_id}:`, e.message);
        results.push({ id: order.provider_order_id, error: e.message });
      }
    }

    console.log(`[sync-orders] ✅ حُدِّث ${updated} طلب من أصل ${orders.length}`);
    return res.json({ ok: true, checked: orders.length, updated, results });

  } catch (err) {
    console.error("[sync-orders]", err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// ─── ترجمة حالة Followiz إلى حالتنا ─────────────────
function mapStatus(raw) {
  if (!raw) return null;
  const s = raw.toLowerCase().trim();
  if (s === "completed")                          return "completed";
  if (s === "canceled" || s === "cancelled")      return "cancelled";
  if (s === "failed"   || s === "error")          return "failed";
  if (s === "partial")                            return "partial";
  if (s === "in progress" || s === "processing")  return "in_progress";
  return null;
}

// ─── إشعار المستخدم + استرداد الرصيد إن لزم ─────────
async function handleUserNotification(order, newStatus, rawStatus) {
  try {
    if (newStatus === "completed") {
      await sbInsert("notifications", {
        user_id:  order.user_id,
        title:    "✅ اكتمل طلبك",
        message:  `تم تنفيذ طلبك #${order.provider_order_id} بنجاح — ${Number(order.quantity || 0).toLocaleString()} متابع/تفاعل`,
        is_read:  false,
      });

    } else if (newStatus === "partial") {
      await sbInsert("notifications", {
        user_id:  order.user_id,
        title:    "⚠️ طلبك اكتمل جزئياً",
        message:  `طلبك #${order.provider_order_id} اكتمل بشكل جزئي`,
        is_read:  false,
      });

    } else if (newStatus === "cancelled" || newStatus === "failed") {
      // استرداد الرصيد
      let refundNote = "";
      if (order.total_price && Number(order.total_price) > 0) {
        const rows        = await sbSelect("profiles", `id=eq.${order.user_id}&select=balance`).catch(() => []);
        const current     = Number(rows?.[0]?.balance ?? 0);
        const newBalance  = current + Number(order.total_price);
        await sbUpdate("profiles", `id=eq.${order.user_id}`, { balance: newBalance });
        refundNote = `\n💰 تم استرداد ${Number(order.total_price).toLocaleString()} IQD إلى رصيدك`;
        console.log(`[sync-orders] 🔄 رُدّ ${order.total_price} IQD → ${order.user_id}`);
      }

      await sbInsert("notifications", {
        user_id:  order.user_id,
        title:    newStatus === "cancelled" ? "❌ تم إلغاء طلبك" : "❌ فشل طلبك",
        message:  `طلبك #${order.provider_order_id} — ${rawStatus || newStatus}${refundNote}`,
        is_read:  false,
      });
    }
  } catch (e) {
    console.warn("[sync-orders] notify error:", e.message);
  }
}
