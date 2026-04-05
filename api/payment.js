import { setCors, sbInsert, sbGetUser, TELEGRAM_TOKEN, SUPABASE_URL, SERVICE_KEY } from "./_utils.js";

const TELEGRAM_ADMIN_ID = process.env.TELEGRAM_ADMIN_ID || "6460074022";

// ─── Send Telegram message with optional inline keyboard ─────────────────────
async function tgSend(chatId, text, replyMarkup = null) {
  if (!TELEGRAM_TOKEN || !chatId) return;
  const body = { chat_id: chatId, text, parse_mode: "HTML" };
  if (replyMarkup) body.reply_markup = replyMarkup;
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

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

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(500).json({ ok: false, error: "إعدادات الخادم ناقصة" });
    }

    // ── Insert payment (service role — bypasses RLS) ───────────────────────
    const result = await sbInsert("payments", {
      user_id:        user.id,
      amount:         Number(amount),
      method:         method || "manual",
      transaction_id: transaction_id || null,
      proof_url:      proof_url || null,
      notes:          notes || null,
      status:         "pending",
    });

    const payment = Array.isArray(result) ? result[0] : result;
    const paymentId = payment?.id || "unknown";

    // ── Telegram notification with inline approve/reject buttons ──────────
    if (TELEGRAM_ADMIN_ID && TELEGRAM_TOKEN) {
      const msg = [
        `💰 <b>طلب شحن جديد</b>`,
        `👤 المستخدم: ${user.email || user.id}`,
        `💵 المبلغ: ${Number(amount).toLocaleString()} IQD`,
        `💳 الطريقة: ${method || "manual"}`,
        transaction_id ? `🔖 رقم العملية: <code>${transaction_id}</code>` : null,
        notes         ? `📝 ملاحظة: ${notes}`                              : null,
        `🆔 <code>${paymentId}</code>`,
      ].filter(Boolean).join("\n");

      // Inline keyboard: admin clicks ✅ or ❌ instead of typing commands
      const keyboard = {
        inline_keyboard: [[
          { text: "✅ قبول",  callback_data: `approve:${paymentId}` },
          { text: "❌ رفض",   callback_data: `reject:${paymentId}`  },
        ]],
      };

      tgSend(TELEGRAM_ADMIN_ID, msg, keyboard).catch(e =>
        console.warn("[payment] telegram failed:", e.message)
      );
    }

    res.json({ ok: true, success: true, payment });

  } catch (err) {
    console.error("[payment]", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
}
