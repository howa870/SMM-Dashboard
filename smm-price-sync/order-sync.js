/**
 * order-sync.js
 * ─────────────────────────────────────────────────────
 * يفحص حالة الطلبات المعلقة عند Followiz كل دورة
 * ويحدّث قاعدة البيانات ويرسل إشعار للمستخدم
 * ─────────────────────────────────────────────────────
 */

const { createClient } = require("@supabase/supabase-js");

let _sb = null;

function getSb() {
  if (_sb) return _sb;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _sb = createClient(url, key);
  return _sb;
}

// ─── ترجمة حالة Followiz إلى حالتنا ──────────────────
function mapStatus(raw) {
  if (!raw) return null;
  const s = raw.toLowerCase().trim();
  if (s === "completed")                              return "completed";
  if (s === "canceled" || s === "cancelled")         return "cancelled";
  if (s === "failed"   || s === "error")             return "failed";
  if (s === "partial")                               return "partial";
  if (s === "in progress" || s === "processing")     return "in_progress";
  return null;
}

// ─── إرسال إشعار للمستخدم في الموقع ──────────────────
async function notify(sb, userId, title, message) {
  if (!userId) return;
  try {
    await sb.from("notifications").insert({
      user_id: userId,
      title,
      message,
      is_read: false,
    });
  } catch (e) {
    console.warn("[OrderSync] ⚠️ فشل الإشعار:", e.message?.slice(0, 80));
  }
}

// ─── الدالة الرئيسية ──────────────────────────────────
async function syncOrderStatuses(config) {
  const sb = getSb();
  if (!sb) return;

  const { apiKey, baseUrl } = config;
  if (!apiKey) return;

  try {
    // 1. اجلب الطلبات المعلقة التي عندها رقم طلب من Followiz
    const { data: orders, error } = await sb
      .from("orders")
      .select("id, user_id, provider_order_id, total_price, quantity, provider_service_id")
      .eq("status", "pending")
      .not("provider_order_id", "is", null)
      .neq("provider_order_id", "")
      .limit(30);

    if (error) {
      console.warn("[OrderSync] ⚠️ خطأ في جلب الطلبات:", error.message);
      return;
    }

    if (!orders?.length) {
      console.log("[OrderSync] ✅ لا طلبات معلقة");
      return;
    }

    console.log(`[OrderSync] 🔍 فحص ${orders.length} طلب معلق...`);
    let updated = 0;

    for (const order of orders) {
      try {
        // 2. استعلام Followiz عن حالة الطلب
        const body = new URLSearchParams({
          key:    apiKey,
          action: "status",
          order:  order.provider_order_id,
        });

        const res  = await fetch(baseUrl, {
          method:  "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body:    body.toString(),
        });
        const data = await res.json();

        const newStatus = mapStatus(data.status);
        if (!newStatus) continue; // لم تتغير الحالة

        // 3. حدّث حالة الطلب في قاعدة البيانات
        const { error: upErr } = await sb
          .from("orders")
          .update({ status: newStatus })
          .eq("id", order.id);

        if (upErr) {
          console.warn(`[OrderSync] ⚠️ فشل تحديث طلب #${order.id}:`, upErr.message);
          continue;
        }

        updated++;
        console.log(`[OrderSync] ✅ طلب #${order.provider_order_id}: pending → ${newStatus}`);

        // 4. أرسل إشعار للمستخدم
        if (order.user_id) {
          if (newStatus === "completed") {
            await notify(
              sb,
              order.user_id,
              "✅ اكتمل طلبك",
              `تم تنفيذ طلبك #${order.provider_order_id} بنجاح — ${order.quantity?.toLocaleString() || ""} متابع/تفاعل`
            );
          } else if (newStatus === "partial") {
            await notify(
              sb,
              order.user_id,
              "⚠️ طلبك اكتمل جزئياً",
              `طلبك #${order.provider_order_id} اكتمل بشكل جزئي — سيُراجع التيم الباقي`
            );
          } else if (newStatus === "cancelled" || newStatus === "failed") {
            // رُدّ الرصيد للمستخدم
            if (order.total_price && order.total_price > 0) {
              const { data: profile } = await sb
                .from("profiles")
                .select("balance")
                .eq("id", order.user_id)
                .single();

              if (profile) {
                const newBalance = Number(profile.balance || 0) + Number(order.total_price);
                await sb
                  .from("profiles")
                  .update({ balance: newBalance })
                  .eq("id", order.user_id);

                await notify(
                  sb,
                  order.user_id,
                  newStatus === "cancelled" ? "❌ تم إلغاء طلبك" : "❌ فشل طلبك",
                  `طلبك #${order.provider_order_id} — ${data.status || newStatus}\n💰 تم استرداد ${Number(order.total_price).toLocaleString()} IQD إلى رصيدك تلقائياً`
                );

                console.log(`[OrderSync] 🔄 استُرد ${order.total_price} IQD → ${order.user_id}`);
              }
            } else {
              await notify(
                sb,
                order.user_id,
                newStatus === "cancelled" ? "❌ تم إلغاء طلبك" : "❌ فشل طلبك",
                `طلبك #${order.provider_order_id} — ${data.status || newStatus}`
              );
            }
          }
        }

      } catch (e) {
        console.warn(`[OrderSync] ⚠️ خطأ في طلب #${order.provider_order_id}:`, e.message);
      }
    }

    if (updated > 0) {
      console.log(`[OrderSync] 🎉 حُدِّث ${updated} طلب`);
    }

  } catch (e) {
    console.error("[OrderSync] ❌ خطأ عام:", e.message);
  }
}

module.exports = { syncOrderStatuses };
