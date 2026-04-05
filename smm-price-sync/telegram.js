/**
 * telegram.js
 * ─────────────────────────────────────────────────────
 * إرسال إشعارات Telegram عند تغيير الأسعار
 * ─────────────────────────────────────────────────────
 */

const axios = require("axios");

const TELEGRAM_API = "https://api.telegram.org";
const SEND_TIMEOUT = 12000;

/**
 * إرسال رسالة نصية إلى Telegram
 * @param {string} token   - توكن البوت
 * @param {string} chatId  - معرف المحادثة
 * @param {string} message - نص الرسالة (يدعم HTML)
 */
async function sendTelegramMessage(token, chatId, message) {
  if (!token || !chatId) {
    console.warn("[Telegram] ⚠️  BOT_TOKEN أو CHAT_ID غير مضبوط — تم تخطي الإشعار");
    return;
  }

  const url = `${TELEGRAM_API}/bot${token}/sendMessage`;

  await axios.post(
    url,
    {
      chat_id: chatId,
      text: message,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    },
    { timeout: SEND_TIMEOUT }
  );
}

/**
 * إرسال إشعار برفع سعر خدمة
 * @param {string} token
 * @param {string} chatId
 * @param {Object} info
 * @param {string|number} info.serviceId
 * @param {string}        info.serviceName
 * @param {number}        info.oldProviderPrice
 * @param {number}        info.newProviderPrice
 * @param {number}        info.oldSellPrice
 * @param {number}        info.newSellPrice
 * @param {string}        info.changePercent
 */
async function notifyPriceIncrease(token, chatId, info) {
  const {
    serviceId,
    serviceName,
    oldProviderPrice,
    newProviderPrice,
    oldSellPrice,
    newSellPrice,
    changePercent,
  } = info;

  const message = [
    `📈 <b>ارتفع سعر خدمة!</b>`,
    ``,
    `🆔 <b>رقم الخدمة:</b> <code>${serviceId}</code>`,
    `📌 <b>الخدمة:</b> ${escapeHtml(serviceName)}`,
    ``,
    `💲 <b>سعر المزود القديم:</b> <code>$${oldProviderPrice.toFixed(4)}</code>`,
    `💲 <b>سعر المزود الجديد:</b> <code>$${newProviderPrice.toFixed(4)}</code>`,
    `📊 <b>نسبة التغيير:</b> <code>${changePercent}</code>`,
    ``,
    `🏷️ <b>سعر البيع القديم:</b> <code>$${oldSellPrice.toFixed(4)}</code>`,
    `🏷️ <b>سعر البيع الجديد:</b> <code>$${newSellPrice.toFixed(4)}</code>`,
    ``,
    `🕐 <i>${new Date().toLocaleString("ar-IQ", { timeZone: "Asia/Baghdad" })}</i>`,
  ].join("\n");

  await sendTelegramMessage(token, chatId, message);
}

/**
 * إرسال إشعار ملخص عند بدء التشغيل
 * @param {string} token
 * @param {string} chatId
 * @param {number} serviceCount - عدد الخدمات المحملة
 */
async function notifyStartup(token, chatId, serviceCount) {
  const message = [
    `🚀 <b>SMM Price Monitor يعمل الآن</b>`,
    ``,
    `📦 <b>عدد الخدمات:</b> <code>${serviceCount}</code>`,
    `⏰ <b>الفحص كل:</b> 5 دقائق`,
    `📈 <b>هامش الربح:</b> 50%`,
    ``,
    `🕐 <i>${new Date().toLocaleString("ar-IQ", { timeZone: "Asia/Baghdad" })}</i>`,
  ].join("\n");

  await sendTelegramMessage(token, chatId, message);
}

/**
 * هروب أحرف HTML الخاصة
 */
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

module.exports = { sendTelegramMessage, notifyPriceIncrease, notifyStartup };
