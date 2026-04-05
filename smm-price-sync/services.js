/**
 * services.js
 * ─────────────────────────────────────────────────────
 * جلب قائمة الخدمات من API المزود الخارجي
 * ─────────────────────────────────────────────────────
 */

const axios = require("axios");

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

/**
 * تأخير بالميلي ثانية
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * جلب قائمة الخدمات من API مع إعادة المحاولة تلقائياً
 * @param {string} apiKey   - مفتاح API
 * @param {string} baseUrl  - رابط API الأساسي
 * @returns {Promise<Array>} - مصفوفة الخدمات
 */
async function fetchServices(apiKey, baseUrl) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(
        `[Services] محاولة جلب الخدمات (${attempt}/${MAX_RETRIES})...`
      );

      const response = await axios.post(
        baseUrl,
        new URLSearchParams({ key: apiKey, action: "services" }),
        {
          timeout: 20000,
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "SMM-Price-Sync/1.0",
          },
        }
      );

      const data = response.data;

      if (!Array.isArray(data)) {
        throw new Error(
          `استجابة غير صالحة من API: ${JSON.stringify(data).slice(0, 200)}`
        );
      }

      console.log(`[Services] ✅ تم جلب ${data.length} خدمة بنجاح`);
      return data;
    } catch (err) {
      lastError = err;
      const isLast = attempt === MAX_RETRIES;
      console.error(
        `[Services] ❌ فشلت المحاولة ${attempt}: ${err.message}${isLast ? "" : ` — إعادة المحاولة خلال ${RETRY_DELAY_MS / 1000}s...`}`
      );
      if (!isLast) await sleep(RETRY_DELAY_MS * attempt);
    }
  }

  throw new Error(
    `فشل جلب الخدمات بعد ${MAX_RETRIES} محاولات: ${lastError.message}`
  );
}

module.exports = { fetchServices };
