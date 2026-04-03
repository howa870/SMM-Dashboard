import { Router } from "express";
import { createClient } from "@supabase/supabase-js";

const router = Router();

const BOT_TOKEN = process.env["TELEGRAM_BOT_TOKEN"];
const CHAT_ID = process.env["TELEGRAM_CHAT_ID"];
const ADMIN_URL = process.env["ADMIN_URL"] || "";

const SUPABASE_URL = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"] || "";
const SUPABASE_SERVICE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"] || "";

if (!BOT_TOKEN) console.error("[Telegram] TELEGRAM_BOT_TOKEN not set");
if (!CHAT_ID) console.error("[Telegram] TELEGRAM_CHAT_ID not set");
if (!SUPABASE_SERVICE_KEY) console.error("[Telegram] SUPABASE_SERVICE_ROLE_KEY not set");

// Admin Supabase client (bypasses RLS)
const adminSupabase = SUPABASE_URL && SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  : null;

async function sendTelegramMessage(text: string, replyMarkup?: object): Promise<{ ok: boolean; message_id?: number }> {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.log("[Telegram] Bot not configured, skipping.");
    return { ok: false };
  }
  try {
    const body: Record<string, unknown> = {
      chat_id: CHAT_ID,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    };
    if (replyMarkup) body.reply_markup = replyMarkup;

    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json() as { ok: boolean; result?: { message_id: number } };
    if (!json.ok) console.error("[Telegram] sendMessage failed:", JSON.stringify(json));
    return { ok: json.ok, message_id: json.result?.message_id };
  } catch (err) {
    console.error("[Telegram] Failed to send message:", err);
    return { ok: false };
  }
}

async function answerCallbackQuery(callbackQueryId: string, text: string): Promise<void> {
  if (!BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: false }),
    });
  } catch (err) {
    console.error("[Telegram] answerCallbackQuery failed:", err);
  }
}

async function editMessageReplyMarkup(chatId: string | number, messageId: number, replyMarkup: object): Promise<void> {
  if (!BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageReplyMarkup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: replyMarkup }),
    });
  } catch {}
}

// ─── POST /api/telegram/payment-notify ──────────────────────────────────────
router.post("/payment-notify", async (req, res) => {
  const { id, email, amount, method, transaction_id, proof_url, notes } = req.body as {
    id: number;
    email: string;
    amount: number;
    method: string;
    transaction_id?: string;
    proof_url?: string;
    notes?: string;
  };

  const methodLabels: Record<string, string> = {
    zaincash: "زين كاش 💳",
    qicard: "QiCard 💰",
    manual: "حوالة يدوية 🏦",
  };

  const text = [
    "🚀 <b>طلب شحن جديد!</b>",
    "",
    `👤 <b>المستخدم:</b> ${email}`,
    `💰 <b>المبلغ:</b> <code>${Number(amount).toLocaleString()} IQD</code>`,
    `💳 <b>الطريقة:</b> ${methodLabels[method] || method}`,
    transaction_id ? `🔢 <b>TXID:</b> <code>${transaction_id}</code>` : null,
    proof_url ? `📸 <b>إثبات الدفع:</b> <a href="${proof_url}">عرض الصورة</a>` : null,
    notes ? `📝 <b>ملاحظات:</b> ${notes}` : null,
    "",
    `🆔 <b>رقم الطلب:</b> #${id}`,
    `⏱ <b>الوقت:</b> ${new Date().toLocaleString("ar-IQ")}`,
  ].filter(Boolean).join("\n");

  const adminPanelUrl = ADMIN_URL || `https://${req.headers.host}/#/admin/payments`;

  const replyMarkup = {
    inline_keyboard: [[
      { text: "✅ قبول الطلب", callback_data: `approve_${id}` },
      { text: "❌ رفض الطلب", callback_data: `reject_${id}` },
    ], [
      { text: "🔍 فتح لوحة الإدارة", url: adminPanelUrl },
    ]],
  };

  await sendTelegramMessage(text, replyMarkup);
  res.json({ ok: true });
});

// ─── POST /api/telegram/webhook ─────────────────────────────────────────────
// Register this URL in Telegram:
// https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://YOUR_DOMAIN/api/telegram/webhook
router.post("/webhook", async (req, res) => {
  // Always respond 200 immediately so Telegram doesn't retry
  res.json({ ok: true });

  const update = req.body as TelegramUpdate;
  console.log("[Telegram Webhook] Received:", JSON.stringify(update).slice(0, 200));

  if (!update.callback_query) return;

  const { id: callbackId, data, message, from } = update.callback_query;
  if (!data) return;

  const chatId = message?.chat.id;
  const messageId = message?.message_id;

  // Parse action and payment ID (supports both integer IDs and UUID IDs)
  // callback_data format: "approve_<id>" or "reject_<id>"
  const approveMatch = data.match(/^approve_(.+)$/);
  const rejectMatch = data.match(/^reject_(.+)$/);

  // Ignore non-action callbacks (e.g. "done" button after processing)
  if (data === "done") {
    await answerCallbackQuery(callbackId, "✅ تمت المعالجة مسبقاً");
    return;
  }

  if (!approveMatch && !rejectMatch) {
    console.log("[Telegram Webhook] Unknown callback data:", data);
    await answerCallbackQuery(callbackId, "⚠️ طلب غير معروف");
    return;
  }

  if (!adminSupabase) {
    console.error("[Telegram Webhook] adminSupabase not initialized — SUPABASE_SERVICE_ROLE_KEY missing?");
    await answerCallbackQuery(callbackId, "❌ خطأ: لم يتم تهيئة قاعدة البيانات");
    return;
  }

  // Use string ID (works for both integer and UUID primary keys)
  const paymentId = approveMatch?.[1] || rejectMatch?.[1] || "";
  const isApprove = !!approveMatch;

  console.log(`[Telegram Webhook] ${isApprove ? "APPROVE" : "REJECT"} payment ID: ${paymentId}`);

  try {
    // Fetch the payment
    const { data: payment, error: fetchErr } = await adminSupabase
      .from("payments")
      .select("id, user_id, amount, status")
      .eq("id", paymentId)
      .single();

    if (fetchErr || !payment) {
      console.error("[Telegram Webhook] Payment not found:", paymentId, fetchErr?.message);
      await answerCallbackQuery(callbackId, `❌ الطلب غير موجود (${paymentId.slice(0, 8)}...)`);
      return;
    }

    if (payment.status !== "pending") {
      await answerCallbackQuery(callbackId, `⚠️ الطلب تمت معالجته مسبقاً: ${payment.status}`);
      return;
    }

    if (isApprove) {
      // Add balance to user
      const { data: profile, error: profileErr } = await adminSupabase
        .from("profiles")
        .select("balance")
        .eq("id", payment.user_id)
        .single();

      if (profileErr || !profile) {
        console.error("[Telegram Webhook] Profile not found:", payment.user_id);
        await answerCallbackQuery(callbackId, "❌ لم يتم العثور على حساب المستخدم");
        return;
      }

      const newBalance = Number(profile.balance) + Number(payment.amount);

      const { error: balanceErr } = await adminSupabase
        .from("profiles")
        .update({ balance: newBalance })
        .eq("id", payment.user_id);

      if (balanceErr) {
        console.error("[Telegram Webhook] Balance update failed:", balanceErr);
        await answerCallbackQuery(callbackId, "❌ فشل تحديث الرصيد");
        return;
      }

      // Update payment status
      await adminSupabase.from("payments").update({ status: "approved" }).eq("id", paymentId);

      // Insert notification for user
      await adminSupabase.from("notifications").insert({
        user_id: payment.user_id,
        title: "✅ تم شحن رصيدك",
        message: `تم إضافة ${Number(payment.amount).toLocaleString()} IQD إلى حسابك بنجاح.`,
        is_read: false,
      }).then(r => { if (r.error) console.warn("[Telegram Webhook] Notification insert:", r.error.message); });

      await answerCallbackQuery(callbackId, `✅ تم قبول الطلب #${paymentId} وإضافة ${Number(payment.amount).toLocaleString()} IQD`);

      // Update the Telegram message buttons to show it's done
      if (chatId && messageId) {
        await editMessageReplyMarkup(chatId, messageId, {
          inline_keyboard: [[{ text: `✅ تم القبول بواسطة ${from?.first_name || "المدير"}`, callback_data: "done" }]]
        });
      }

      console.log(`[Telegram Webhook] ✅ Approved payment #${paymentId} — added ${payment.amount} IQD to ${payment.user_id}`);
    } else {
      // Reject
      await adminSupabase.from("payments").update({ status: "rejected" }).eq("id", paymentId);

      // Insert rejection notification
      await adminSupabase.from("notifications").insert({
        user_id: payment.user_id,
        title: "❌ تم رفض طلب الشحن",
        message: `تم رفض طلب شحن بمبلغ ${Number(payment.amount).toLocaleString()} IQD. يرجى التواصل مع الدعم.`,
        is_read: false,
      }).then(r => { if (r.error) console.warn("[Telegram Webhook] Notification insert:", r.error.message); });

      await answerCallbackQuery(callbackId, `❌ تم رفض الطلب #${paymentId}`);

      if (chatId && messageId) {
        await editMessageReplyMarkup(chatId, messageId, {
          inline_keyboard: [[{ text: `❌ تم الرفض بواسطة ${from?.first_name || "المدير"}`, callback_data: "done" }]]
        });
      }

      console.log(`[Telegram Webhook] ❌ Rejected payment #${paymentId}`);
    }
  } catch (err) {
    console.error("[Telegram Webhook] Unexpected error:", err);
    await answerCallbackQuery(callbackId, "❌ حدث خطأ غير متوقع");
  }
});

// ─── POST /api/telegram/payment-approved (manual from admin panel) ───────────
router.post("/payment-approved", async (req, res) => {
  const { email, amount } = req.body as { email: string; amount: number };
  const text = [
    "✅ <b>تم قبول طلب شحن</b>",
    "",
    `👤 <b>المستخدم:</b> ${email}`,
    `💰 <b>المبلغ:</b> <code>${Number(amount).toLocaleString()} IQD</code>`,
    "",
    "تم إضافة الرصيد بنجاح.",
  ].join("\n");
  await sendTelegramMessage(text);
  res.json({ ok: true });
});

// ─── POST /api/telegram/payment-rejected (manual from admin panel) ──────────
router.post("/payment-rejected", async (req, res) => {
  const { email, amount } = req.body as { email: string; amount: number };
  const text = [
    "❌ <b>تم رفض طلب شحن</b>",
    "",
    `👤 <b>المستخدم:</b> ${email}`,
    `💰 <b>المبلغ:</b> <code>${Number(amount).toLocaleString()} IQD</code>`,
  ].join("\n");
  await sendTelegramMessage(text);
  res.json({ ok: true });
});

// ─── POST /api/telegram/setup-webhook ───────────────────────────────────────
// Call this once to register your webhook URL with Telegram
router.post("/setup-webhook", async (req, res) => {
  if (!BOT_TOKEN) {
    res.status(400).json({ error: "TELEGRAM_BOT_TOKEN not set" });
    return;
  }
  const host = req.headers.host || req.body.host;
  const webhookUrl = req.body.url || `https://${host}/api/telegram/webhook`;

  try {
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl, allowed_updates: ["callback_query"] }),
    });
    const json = await r.json();
    console.log("[Telegram] Webhook set:", JSON.stringify(json));
    res.json({ ok: true, webhookUrl, telegramResponse: json });
  } catch (err) {
    console.error("[Telegram] setWebhook failed:", err);
    res.status(500).json({ error: "Failed to set webhook" });
  }
});

// ─── GET /api/telegram/webhook-info ─────────────────────────────────────────
router.get("/webhook-info", async (_req, res) => {
  if (!BOT_TOKEN) { res.status(400).json({ error: "TELEGRAM_BOT_TOKEN not set" }); return; }
  try {
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
    const json = await r.json();
    res.json(json);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Type definitions
type TelegramUpdate = {
  update_id: number;
  callback_query?: {
    id: string;
    from: { id: number; first_name?: string; username?: string };
    message?: { message_id: number; chat: { id: number } };
    data?: string;
  };
};

export default router;
