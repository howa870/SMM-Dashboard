/**
 * Telegram Webhook Handler — Boost Iraq Admin Bot
 *
 * 1. POST /api/telegram  ← سجّل الـ webhook مرة واحدة:
 *    curl "https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://YOUR_DOMAIN/api/telegram"
 *
 * Commands (يرسلها الأدمن في الشات مع البوت):
 *   /approve {payment_uuid}  ← اعتماد دفعة + إضافة الرصيد
 *   /reject  {payment_uuid}  ← رفض دفعة
 *   /balance {user_id}       ← استعلام رصيد مستخدم
 *   /pending                 ← قائمة الدفعات المعلّقة
 *
 * Or: Click inline ✅/❌ buttons sent automatically with each payment.
 */

import {
  setCors,
  sbSelect,
  sbUpdate,
  sbInsert,
  sendTelegram,
  TELEGRAM_TOKEN,
  SERVICE_KEY,
  SUPABASE_URL,
} from "./_utils.js";

const ADMIN_IDS = (process.env.TELEGRAM_ADMIN_ID || "6460074022")
  .split(",")
  .map(s => String(s.trim()));

// ─── Send a message (with optional inline keyboard) ──────────────────────────
async function tgSend(chatId, text, replyMarkup = null) {
  if (!TELEGRAM_TOKEN) return;
  const body = {
    chat_id:    chatId,
    text,
    parse_mode: "HTML",
  };
  if (replyMarkup) body.reply_markup = replyMarkup;
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

// ─── Answer a callback query (to clear the loading spinner) ──────────────────
async function tgAnswerCb(callbackQueryId, text = "") {
  if (!TELEGRAM_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

// ─── Edit the original approval message after action ─────────────────────────
async function tgEditMsg(chatId, messageId, text) {
  if (!TELEGRAM_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageText`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode: "HTML" }),
  });
}

// ─── Approve payment: update DB + notify ─────────────────────────────────────
async function approvePayment(paymentId, chatId, messageId = null) {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Supabase env vars missing");

  // 1. جيب بيانات الدفعة
  const payments = await sbSelect("payments", `id=eq.${paymentId}&select=*`);
  const payment  = payments?.[0];

  if (!payment)              throw new Error(`❌ لم أجد الدفعة: ${paymentId}`);
  if (payment.status !== "pending") throw new Error(`⚠️ الدفعة ليست معلّقة (الحالة: ${payment.status})`);

  // 2. جيب رصيد المستخدم الحالي
  const profiles = await sbSelect("profiles", `id=eq.${payment.user_id}&select=balance,email,name`);
  const profile  = profiles?.[0];
  if (!profile) throw new Error(`❌ لم أجد المستخدم: ${payment.user_id}`);

  const oldBalance = Number(profile.balance ?? 0);
  const amount     = Number(payment.amount);
  const newBalance = oldBalance + amount;

  // 3. حدّث الرصيد (atomic — بدون race condition عبر service role)
  await sbUpdate("profiles", `id=eq.${payment.user_id}`, { balance: newBalance });

  // 4. حدّث حالة الدفعة
  await sbUpdate("payments", `id=eq.${paymentId}`, { status: "approved" });

  // 5. أضف إشعار للمستخدم في جدول notifications
  try {
    await sbInsert("notifications", {
      user_id: payment.user_id,
      title:   "✅ تم شحن رصيدك",
      message: `تم إضافة ${amount.toLocaleString()} IQD. رصيدك الجديد: ${newBalance.toLocaleString()} IQD`,
    });
  } catch (_) { /* optional — don't block approval */ }

  const confirmText =
    `✅ <b>تم اعتماد الدفعة</b>\n` +
    `👤 ${profile.name || profile.email}\n` +
    `💵 ${amount.toLocaleString()} IQD\n` +
    `💰 الرصيد الجديد: <b>${newBalance.toLocaleString()} IQD</b>`;

  // 6. عدّل الرسالة الأصلية أو أرسل رسالة جديدة للأدمن
  if (messageId) {
    await tgEditMsg(chatId, messageId, confirmText);
  } else {
    await tgSend(chatId, confirmText);
  }

  return { amount, newBalance, userEmail: profile.email };
}

// ─── Reject payment ───────────────────────────────────────────────────────────
async function rejectPayment(paymentId, chatId, messageId = null) {
  const payments = await sbSelect("payments", `id=eq.${paymentId}&select=*`);
  const payment  = payments?.[0];

  if (!payment)              throw new Error(`❌ لم أجد الدفعة: ${paymentId}`);
  if (payment.status !== "pending") throw new Error(`⚠️ الدفعة ليست معلّقة (الحالة: ${payment.status})`);

  await sbUpdate("payments", `id=eq.${paymentId}`, { status: "rejected" });

  try {
    await sbInsert("notifications", {
      user_id: payment.user_id,
      title:   "❌ تم رفض طلب الشحن",
      message: `تم رفض طلب شحن ${Number(payment.amount).toLocaleString()} IQD. تواصل مع الدعم.`,
    });
  } catch (_) {}

  const confirmText = `❌ <b>تم رفض الدفعة</b>\n💵 المبلغ: ${Number(payment.amount).toLocaleString()} IQD`;
  if (messageId) {
    await tgEditMsg(chatId, messageId, confirmText);
  } else {
    await tgSend(chatId, confirmText);
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  // Telegram sends GET for webhook verification
  if (req.method === "GET") {
    return res.json({ ok: true, message: "Boost Iraq Bot Webhook Ready 🚀" });
  }

  if (req.method !== "POST") return res.status(405).end();

  // Acknowledge immediately (Telegram re-tries if we don't respond in 60s)
  res.status(200).json({ ok: true });

  const update = req.body || {};

  // ── Inline button callback (✅ / ❌ buttons) ──────────────────────────────
  if (update.callback_query) {
    const cb      = update.callback_query;
    const chatId  = cb.message?.chat?.id;
    const msgId   = cb.message?.message_id;
    const data    = cb.data || "";      // e.g. "approve:uuid" or "reject:uuid"
    const senderId = String(cb.from?.id);

    await tgAnswerCb(cb.id);

    if (!ADMIN_IDS.includes(senderId)) return;

    const [action, paymentId] = data.split(":");
    if (!paymentId) return;

    try {
      if (action === "approve") {
        await approvePayment(paymentId, chatId, msgId);
      } else if (action === "reject") {
        await rejectPayment(paymentId, chatId, msgId);
      }
    } catch (err) {
      await tgSend(chatId, `⚠️ خطأ: ${err.message}`);
    }
    return;
  }

  // ── Text message commands ─────────────────────────────────────────────────
  const msg      = update.message;
  if (!msg?.text) return;

  const chatId   = msg.chat?.id;
  const senderId = String(msg.from?.id);
  const text     = msg.text?.trim() || "";

  // Only allow admins
  if (!ADMIN_IDS.includes(senderId)) {
    await tgSend(chatId, "⛔ غير مصرح لك باستخدام هذا البوت.");
    return;
  }

  // /start — رسالة ترحيب
  if (text === "/start") {
    await tgSend(chatId,
      `🚀 <b>Boost Iraq Admin Bot</b>\n\n` +
      `الأوامر المتاحة:\n` +
      `/approve {id}  — اعتماد دفعة\n` +
      `/reject {id}   — رفض دفعة\n` +
      `/balance {uid} — رصيد مستخدم\n` +
      `/pending       — الدفعات المعلّقة`
    );
    return;
  }

  // /approve {payment_id}
  if (text.startsWith("/approve")) {
    const paymentId = text.split(/\s+/)[1]?.trim();
    if (!paymentId) {
      await tgSend(chatId, "⚠️ استخدام: /approve {payment_id}");
      return;
    }
    try {
      await approvePayment(paymentId, chatId);
    } catch (err) {
      await tgSend(chatId, `⚠️ ${err.message}`);
    }
    return;
  }

  // /reject {payment_id}
  if (text.startsWith("/reject")) {
    const paymentId = text.split(/\s+/)[1]?.trim();
    if (!paymentId) {
      await tgSend(chatId, "⚠️ استخدام: /reject {payment_id}");
      return;
    }
    try {
      await rejectPayment(paymentId, chatId);
    } catch (err) {
      await tgSend(chatId, `⚠️ ${err.message}`);
    }
    return;
  }

  // /balance {user_id}
  if (text.startsWith("/balance")) {
    const uid = text.split(/\s+/)[1]?.trim();
    if (!uid) {
      await tgSend(chatId, "⚠️ استخدام: /balance {user_id}");
      return;
    }
    try {
      const rows = await sbSelect("profiles", `id=eq.${uid}&select=balance,email,name`);
      const u    = rows?.[0];
      if (!u) {
        await tgSend(chatId, `❌ لم أجد المستخدم: ${uid}`);
      } else {
        await tgSend(chatId,
          `👤 ${u.name || u.email}\n💰 الرصيد: <b>${Number(u.balance).toLocaleString()} IQD</b>`
        );
      }
    } catch (err) {
      await tgSend(chatId, `⚠️ ${err.message}`);
    }
    return;
  }

  // /pending
  if (text.startsWith("/pending")) {
    try {
      const rows = await sbSelect(
        "payments",
        "status=eq.pending&select=id,amount,method,user_id,created_at&order=created_at.desc&limit=10"
      );
      if (!rows?.length) {
        await tgSend(chatId, "✅ لا توجد دفعات معلّقة.");
        return;
      }
      const lines = rows.map(p =>
        `• <code>${p.id}</code>\n  💵 ${Number(p.amount).toLocaleString()} IQD — ${p.method}`
      ).join("\n\n");
      await tgSend(chatId, `📋 <b>الدفعات المعلّقة (${rows.length}):</b>\n\n${lines}`);
    } catch (err) {
      await tgSend(chatId, `⚠️ ${err.message}`);
    }
    return;
  }

  // Unknown command
  await tgSend(chatId, "❓ أمر غير معروف. أرسل /start للمساعدة.");
}
