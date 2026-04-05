import { setCors, sbInsert, sbGetUser, sendTelegram, SERVICE_KEY, TELEGRAM_TOKEN } from "./_utils.js";

const TELEGRAM_ADMIN_ID = process.env.TELEGRAM_ADMIN_ID || "6460074022";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const authHeader = req.headers["authorization"] || "";
    const token      = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!token) return res.status(401).json({ ok: false, error: "مطلوب تسجيل الدخول" });

    const user = await sbGetUser(token);
    if (!user?.id) return res.status(401).json({ ok: false, error: "جلسة غير صالحة" });

    const { amount, method, transaction_id, proof_url, notes } = req.body || {};

    if (!amount || Number(amount) < 1000) {
      return res.status(400).json({ ok: false, error: "المبلغ يجب أن يكون 1000 IQD على الأقل" });
    }

    // ── Insert payment (service role — bypasses RLS) ───────────────────────
    const payment = await sbInsert("payments", {
      user_id:        user.id,
      amount:         Number(amount),
      method:         method || "manual",
      transaction_id: transaction_id || null,
      proof_url:      proof_url || null,
      notes:          notes || null,
      status:         "pending",
    });

    // ── Telegram notification ─────────────────────────────────────────────
    if (TELEGRAM_ADMIN_ID && TELEGRAM_TOKEN) {
      const msg = [
        `💰 <b>طلب شحن جديد</b>`,
        `👤 المستخدم: ${user.email || user.id}`,
        `💵 المبلغ: ${Number(amount).toLocaleString()} IQD`,
        `💳 الطريقة: ${method || "manual"}`,
        transaction_id ? `🔖 رقم العملية: ${transaction_id}` : null,
        notes ? `📝 ملاحظة: ${notes}` : null,
      ].filter(Boolean).join("\n");

      sendTelegram(TELEGRAM_ADMIN_ID, msg).catch(() => {});
    }

    res.json({ ok: true, success: true, payment: Array.isArray(payment) ? payment[0] : payment });

  } catch (err) {
    console.error("[payment]", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
}
