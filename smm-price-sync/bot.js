/**
 * bot.js
 * ─────────────────────────────────────────────────────
 * بوت Telegram بأزرار ثابتة للتحكم بنسبة الربح
 * ─────────────────────────────────────────────────────
 */

const axios = require("axios");
const { getCurrentMarkup, setCurrentMarkup } = require("./config");

const TELEGRAM_API = "https://api.telegram.org";

// ─── الأزرار الثابتة في أسفل المحادثة ───────────────

const MAIN_KEYBOARD = {
  keyboard: [
    [{ text: "📊 الربح الحالي" }, { text: "📈 الإحصائيات" }],
    [{ text: "⚙️ تغيير نسبة الربح" }],
  ],
  resize_keyboard:   true,
  persistent:        true,
  input_field_placeholder: "اختر من الأزرار أو اكتب أمراً...",
};

// ─── أزرار اختيار نسبة الربح ────────────────────────

const MARKUP_INLINE_KEYBOARD = {
  inline_keyboard: [
    [
      { text: "20%",  callback_data: "markup_20"  },
      { text: "30%",  callback_data: "markup_30"  },
      { text: "40%",  callback_data: "markup_40"  },
    ],
    [
      { text: "50% ✅", callback_data: "markup_50" },
      { text: "60%",  callback_data: "markup_60"  },
      { text: "75%",  callback_data: "markup_75"  },
    ],
    [
      { text: "100%", callback_data: "markup_100" },
      { text: "150%", callback_data: "markup_150" },
      { text: "200%", callback_data: "markup_200" },
    ],
    [
      { text: "✏️ أدخل رقم مخصص", callback_data: "markup_custom" },
    ],
  ],
};

// ─── إرسال رسالة عادية ──────────────────────────────

async function sendMsg(token, chatId, text, extra = {}) {
  try {
    await axios.post(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      chat_id:    chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...extra,
    }, { timeout: 12000 });
  } catch (err) {
    console.error(`[Bot] ❌ خطأ إرسال: ${err.message}`);
  }
}

// ─── تعديل رسالة موجودة (لتحديث الإجابة بعد ضغط زر) ─

async function editMsg(token, chatId, messageId, text) {
  try {
    await axios.post(`${TELEGRAM_API}/bot${token}/editMessageText`, {
      chat_id:    chatId,
      message_id: messageId,
      text,
      parse_mode: "HTML",
    }, { timeout: 12000 });
  } catch { /* تجاهل أخطاء التعديل */ }
}

// ─── الإجابة على ضغطة زر Inline ─────────────────────

async function answerCallback(token, callbackQueryId, text = "") {
  try {
    await axios.post(`${TELEGRAM_API}/bot${token}/answerCallbackQuery`, {
      callback_query_id: callbackQueryId,
      text,
      show_alert: false,
    }, { timeout: 8000 });
  } catch { /* تجاهل */ }
}

// ─── رسالة الربح الحالي ─────────────────────────────

function markupInfoText() {
  const m   = getCurrentMarkup();
  const pct = ((m - 1) * 100).toFixed(0);
  return [
    `📊 <b>نسبة الربح الحالية: ${pct}%</b>`,
    ``,
    `مثال على الأسعار:`,
    `  $0.10 → <code>${Math.ceil(0.10 * m * 1300).toLocaleString()} IQD</code>`,
    `  $0.50 → <code>${Math.ceil(0.50 * m * 1300).toLocaleString()} IQD</code>`,
    `  $1.00 → <code>${Math.ceil(1.00 * m * 1300).toLocaleString()} IQD</code>`,
    `  $5.00 → <code>${Math.ceil(5.00 * m * 1300).toLocaleString()} IQD</code>`,
  ].join("\n");
}

// ─── حالات انتظار المدخلات ───────────────────────────
// نحفظ من هو بانتظار إدخال رقم مخصص
const waitingForCustomMarkup = new Set();

// ─── معالجة الرسائل النصية ──────────────────────────

async function handleMessage(msg, token, chatId, deps) {
  const text   = msg.text || "";
  const fromId = String(msg.chat.id);

  if (fromId !== String(chatId)) {
    await sendMsg(token, fromId, "⛔ غير مصرّح لك باستخدام هذا البوت");
    return;
  }

  console.log(`[Bot] 📩 رسالة: ${text}`);

  // ── إذا كان المستخدم بانتظار إدخال رقم مخصص ──
  if (waitingForCustomMarkup.has(fromId)) {
    const pct = parseFloat(text.replace("%", "").trim());
    if (!isNaN(pct) && pct >= 1 && pct <= 500) {
      waitingForCustomMarkup.delete(fromId);
      await applyMarkup(pct, token, chatId, deps);
    } else {
      await sendMsg(token, chatId,
        `❌ رقم غير صحيح. أدخل نسبة بين 1 و500\nمثال: <code>60</code> أو <code>75</code>`,
        { reply_markup: MAIN_KEYBOARD }
      );
    }
    return;
  }

  // ── الأزرار الثابتة ──
  if (text === "📊 الربح الحالي") {
    await sendMsg(token, chatId, markupInfoText(), { reply_markup: MAIN_KEYBOARD });
    return;
  }

  if (text === "⚙️ تغيير نسبة الربح") {
    await sendMsg(token, chatId,
      `⚙️ <b>اختر نسبة الربح الجديدة:</b>\n\nسيتم تحديث جميع الأسعار في الموقع فوراً`,
      { reply_markup: MARKUP_INLINE_KEYBOARD }
    );
    return;
  }

  if (text === "📈 الإحصائيات") {
    const stats = deps.getStats ? deps.getStats() : {};
    const pct   = ((getCurrentMarkup() - 1) * 100).toFixed(0);
    await sendMsg(token, chatId, [
      `📈 <b>إحصائيات النظام</b>`,
      ``,
      `💰 الربح الحالي: <code>${pct}%</code>`,
      `🔄 عدد الفحصات: <code>${stats.totalChecks ?? 0}</code>`,
      `📈 أسعار ارتفعت: <code>${stats.totalUpdates ?? 0}</code>`,
      `✨ خدمات جديدة: <code>${stats.totalNewServices ?? 0}</code>`,
      `🕐 آخر فحص: <code>${stats.lastCheck ?? "لم يبدأ"}</code>`,
    ].join("\n"), { reply_markup: MAIN_KEYBOARD });
    return;
  }

  // ── أوامر نصية (للتوافق) ──
  if (text.startsWith("/start") || text.startsWith("/help")) {
    await sendMsg(token, chatId, [
      `👋 <b>أهلاً! أنا بوت Boost Iraq لإدارة الأسعار</b>`,
      ``,
      `استخدم الأزرار أدناه للتحكم:`,
      `📊 <b>الربح الحالي</b> — عرض نسبة الربح ومثال على الأسعار`,
      `⚙️ <b>تغيير نسبة الربح</b> — تحديث كل الخدمات فوراً`,
      `📈 <b>الإحصائيات</b> — إحصائيات النظام`,
    ].join("\n"), { reply_markup: MAIN_KEYBOARD });
    return;
  }
}

// ─── تطبيق نسبة ربح جديدة ───────────────────────────

async function applyMarkup(pct, token, chatId, deps, callbackMsgId = null) {
  const newMarkup = Math.round((1 + pct / 100) * 1000) / 1000;
  const oldMarkup = getCurrentMarkup();
  const oldPct    = ((oldMarkup - 1) * 100).toFixed(0);

  await sendMsg(token, chatId,
    `⏳ جاري تحديث ${pct}%... يرجى الانتظار`,
    { reply_markup: MAIN_KEYBOARD }
  );

  setCurrentMarkup(newMarkup);

  let result = { updated: 0, failed: 0 };
  if (deps.updateAllPricesWithNewMarkup) {
    result = await deps.updateAllPricesWithNewMarkup(newMarkup);
  }

  const arrow = pct > parseFloat(oldPct) ? "📈" : "📉";

  await sendMsg(token, chatId, [
    `✅ <b>تم تحديث الأسعار!</b>`,
    ``,
    `${arrow} الربح: <code>${oldPct}%</code> → <code>${pct}%</code>`,
    `📦 خدمات مُحدّثة: <code>${result.updated}</code>`,
    result.failed > 0 ? `⚠️ فشل: <code>${result.failed}</code>` : "",
    ``,
    `مثال الأسعار الجديدة:`,
    `  $0.50 → <code>${Math.ceil(0.5 * newMarkup * 1300).toLocaleString()} IQD</code>`,
    `  $1.00 → <code>${Math.ceil(1.0 * newMarkup * 1300).toLocaleString()} IQD</code>`,
    ``,
    `🕐 <i>${new Date().toLocaleString("ar-IQ", { timeZone: "Asia/Baghdad" })}</i>`,
  ].filter(l => l !== "").join("\n"), { reply_markup: MAIN_KEYBOARD });
}

// ─── معالجة ضغط أزرار Inline ────────────────────────

async function handleCallbackQuery(cb, token, chatId, deps) {
  const fromId = String(cb.message.chat.id);
  if (fromId !== String(chatId)) return;

  const data = cb.data || "";
  await answerCallback(token, cb.id);

  if (data.startsWith("markup_")) {
    const val = data.replace("markup_", "");

    if (val === "custom") {
      waitingForCustomMarkup.add(fromId);
      await sendMsg(token, chatId,
        `✏️ <b>أدخل نسبة الربح المخصصة:</b>\n\nمثال: <code>45</code> أو <code>80</code>\n(بين 1 و 500)`,
        { reply_markup: { force_reply: true } }
      );
      return;
    }

    const pct = parseFloat(val);
    if (!isNaN(pct)) {
      await applyMarkup(pct, token, chatId, deps, cb.message.message_id);
    }
  }
}

// ─── Long Polling ────────────────────────────────────

async function startBot(token, chatId, deps = {}) {
  if (!token || !chatId) {
    console.log("[Bot] ⚠️  TELEGRAM_BOT_TOKEN أو TELEGRAM_CHAT_ID غير موجود — البوت معطّل");
    return;
  }

  // رسالة ترحيب عند البدء
  await sendMsg(token, chatId, [
    `🤖 <b>بوت Boost Iraq جاهز!</b>`,
    ``,
    `استخدم الأزرار أدناه للتحكم بالأسعار`,
  ].join("\n"), { reply_markup: MAIN_KEYBOARD }).catch(() => {});

  console.log("[Bot] ✅ البوت يعمل — الأزرار الثابتة مفعّلة");

  let offset = 0;
  const apiBase = `${TELEGRAM_API}/bot${token}`;

  async function poll() {
    try {
      const { data } = await axios.get(`${apiBase}/getUpdates`, {
        params: {
          offset,
          timeout: 25,
          allowed_updates: ["message", "callback_query"],
        },
        timeout: 30000,
      });

      for (const update of (data.result || [])) {
        offset = update.update_id + 1;

        if (update.message) {
          await handleMessage(update.message, token, chatId, deps).catch((err) =>
            console.error(`[Bot] خطأ في الرسالة: ${err.message}`)
          );
        }

        if (update.callback_query) {
          await handleCallbackQuery(update.callback_query, token, chatId, deps).catch((err) =>
            console.error(`[Bot] خطأ في الزر: ${err.message}`)
          );
        }
      }
    } catch (err) {
      if (!err.message.includes("timeout")) {
        console.error(`[Bot] خطأ polling: ${err.message}`);
      }
    }

    setTimeout(poll, 1000);
  }

  poll();
}

module.exports = { startBot };
