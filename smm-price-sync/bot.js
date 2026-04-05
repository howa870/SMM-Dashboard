/**
 * bot.js
 * ─────────────────────────────────────────────────────
 * بوت Telegram للتحكم بنسبة الربح وإدارة النظام
 *
 * الأوامر المتاحة:
 *   /start   — قائمة الأوامر
 *   /markup  — عرض نسبة الربح الحالية
 *   /setmarkup [رقم] — تغيير نسبة الربح على كل الخدمات
 *   /status  — إحصائيات النظام
 *   /help    — المساعدة
 * ─────────────────────────────────────────────────────
 */

const axios = require("axios");
const { getCurrentMarkup, setCurrentMarkup } = require("./config");

const TELEGRAM_API = "https://api.telegram.org";

// ─── إرسال رسالة ────────────────────────────────────

async function sendMsg(token, chatId, text) {
  try {
    await axios.post(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      chat_id:    chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }, { timeout: 12000 });
  } catch (err) {
    console.error(`[Bot] ❌ خطأ إرسال رسالة: ${err.message}`);
  }
}

// ─── معالجة الأوامر ──────────────────────────────────

async function handleCommand(text, token, chatId, deps) {
  const { getStats, updateAllPricesWithNewMarkup } = deps;
  const parts = text.trim().split(/\s+/);
  const cmd   = parts[0].toLowerCase().split("@")[0]; // تجاهل @botname

  // ── /start أو /help ──
  if (cmd === "/start" || cmd === "/help") {
    await sendMsg(token, chatId, [
      `🤖 <b>بوت Boost Iraq — إدارة الأسعار</b>`,
      ``,
      `📋 <b>الأوامر المتاحة:</b>`,
      ``,
      `/markup — عرض نسبة الربح الحالية`,
      `/setmarkup [رقم] — تغيير نسبة الربح`,
      `   مثال: <code>/setmarkup 50</code> لربح 50%`,
      `   مثال: <code>/setmarkup 30</code> لربح 30%`,
      `/status — إحصائيات النظام`,
      `/help — هذه القائمة`,
      ``,
      `⚠️ <b>ملاحظة:</b> /setmarkup يحدّث أسعار كل الخدمات فوراً في الموقع`,
    ].join("\n"));
    return;
  }

  // ── /markup — عرض الربح الحالي ──
  if (cmd === "/markup") {
    const m   = getCurrentMarkup();
    const pct = ((m - 1) * 100).toFixed(0);
    await sendMsg(token, chatId, [
      `📊 <b>نسبة الربح الحالية</b>`,
      ``,
      `💰 الربح: <code>${pct}%</code>`,
      `🔢 المضاعف: <code>${m}x</code>`,
      ``,
      `📌 مثال على التسعير:`,
      `   سعر المزود $1.00 → يُباع بـ <code>${Math.ceil(1 * m * 1300).toLocaleString()} IQD</code>`,
      `   سعر المزود $0.50 → يُباع بـ <code>${Math.ceil(0.5 * m * 1300).toLocaleString()} IQD</code>`,
    ].join("\n"));
    return;
  }

  // ── /setmarkup [رقم] — تغيير الربح ──
  if (cmd === "/setmarkup") {
    const pct = parseFloat(parts[1]);

    if (isNaN(pct) || pct < 1 || pct > 500) {
      await sendMsg(token, chatId, [
        `❌ <b>خطأ في الإدخال</b>`,
        ``,
        `أدخل نسبة بين 1% و500%`,
        `مثال: <code>/setmarkup 50</code>`,
        `مثال: <code>/setmarkup 75</code>`,
      ].join("\n"));
      return;
    }

    const newMarkup = Math.round((1 + pct / 100) * 1000) / 1000;
    const oldMarkup = getCurrentMarkup();
    const oldPct    = ((oldMarkup - 1) * 100).toFixed(0);

    // إشعار بدء التحديث
    await sendMsg(token, chatId, [
      `⏳ <b>جاري تحديث الأسعار...</b>`,
      ``,
      `📉 الربح القديم: <code>${oldPct}%</code>`,
      `📈 الربح الجديد: <code>${pct}%</code>`,
      ``,
      `يتم تحديث كل الخدمات في الموقع — يرجى الانتظار...`,
    ].join("\n"));

    // تحديث الإعداد
    setCurrentMarkup(newMarkup);

    // تحديث كل الأسعار في Supabase
    let result = { updated: 0, failed: 0 };
    if (updateAllPricesWithNewMarkup) {
      result = await updateAllPricesWithNewMarkup(newMarkup);
    }

    const arrow = pct > parseFloat(oldPct) ? "📈" : "📉";

    await sendMsg(token, chatId, [
      `✅ <b>تم تحديث الأسعار بنجاح!</b>`,
      ``,
      `${arrow} الربح القديم: <code>${oldPct}%</code>`,
      `${arrow} الربح الجديد: <code>${pct}%</code>`,
      ``,
      `📦 خدمات مُحدّثة: <code>${result.updated}</code>`,
      result.failed > 0 ? `❌ فشل: <code>${result.failed}</code>` : ``,
      ``,
      `📌 مثال جديد:`,
      `   $1.00 → <code>${Math.ceil(1 * newMarkup * 1300).toLocaleString()} IQD</code>`,
      `   $0.50 → <code>${Math.ceil(0.5 * newMarkup * 1300).toLocaleString()} IQD</code>`,
      ``,
      `🕐 <i>${new Date().toLocaleString("ar-IQ", { timeZone: "Asia/Baghdad" })}</i>`,
    ].filter(l => l !== "").join("\n"));
    return;
  }

  // ── /status — إحصائيات النظام ──
  if (cmd === "/status") {
    const stats = getStats ? getStats() : {};
    const m     = getCurrentMarkup();
    const pct   = ((m - 1) * 100).toFixed(0);

    await sendMsg(token, chatId, [
      `📊 <b>إحصائيات النظام</b>`,
      ``,
      `💰 الربح الحالي: <code>${pct}%</code>`,
      `🔄 عدد الفحصات: <code>${stats.totalChecks ?? 0}</code>`,
      `📈 أسعار ارتفعت: <code>${stats.totalUpdates ?? 0}</code>`,
      `✨ خدمات جديدة: <code>${stats.totalNewServices ?? 0}</code>`,
      `🕐 آخر فحص: <code>${stats.lastCheck ?? "لم يبدأ بعد"}</code>`,
      ``,
      `⏰ الفحص التالي: كل 5 دقائق`,
    ].join("\n"));
    return;
  }
}

// ─── Long Polling ────────────────────────────────────

/**
 * بدء تشغيل البوت مع Long Polling
 * @param {string}   token  - توكن البوت
 * @param {string}   chatId - معرف المحادثة المصرّحة
 * @param {Object}   deps   - تبعيات (getStats, updateAllPricesWithNewMarkup)
 */
async function startBot(token, chatId, deps = {}) {
  if (!token || !chatId) {
    console.log("[Bot] ⚠️  TELEGRAM_BOT_TOKEN أو TELEGRAM_CHAT_ID غير موجود — البوت معطّل");
    console.log("[Bot]    أضفهم في .env لتفعيل التحكم عبر Telegram");
    return;
  }

  let offset = 0;
  const apiBase = `${TELEGRAM_API}/bot${token}`;

  // إرسال رسالة ترحيب عند البدء
  await sendMsg(token, chatId, [
    `🤖 <b>بوت Boost Iraq جاهز!</b>`,
    ``,
    `اكتب /help لعرض الأوامر المتاحة`,
    `اكتب /setmarkup 50 لتغيير الربح إلى 50%`,
  ].join("\n")).catch(() => {});

  console.log("[Bot] ✅ البوت يعمل ويستمع للأوامر...");

  async function poll() {
    try {
      const { data } = await axios.get(`${apiBase}/getUpdates`, {
        params: { offset, timeout: 25, allowed_updates: ["message"] },
        timeout: 30000,
      });

      for (const update of (data.result || [])) {
        offset = update.update_id + 1;
        const msg = update.message;
        if (!msg?.text) continue;

        const fromId = String(msg.chat.id);
        if (fromId !== String(chatId)) {
          // رد مختصر للمحادثات غير المصرّح بها
          await sendMsg(token, fromId, "⛔ غير مصرّح لك باستخدام هذا البوت").catch(() => {});
          continue;
        }

        console.log(`[Bot] 📩 أمر: ${msg.text}`);
        await handleCommand(msg.text, token, chatId, deps).catch((err) =>
          console.error(`[Bot] خطأ في معالجة الأمر: ${err.message}`)
        );
      }
    } catch (err) {
      if (!err.message.includes("timeout")) {
        console.error(`[Bot] خطأ polling: ${err.message}`);
      }
    }

    // استمر في الـ polling
    setTimeout(poll, 1000);
  }

  poll();
}

module.exports = { startBot };
