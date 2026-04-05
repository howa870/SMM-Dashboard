/**
 * pricing.js
 * ─────────────────────────────────────────────────────
 * منطق حساب الأسعار وهامش الربح
 * ─────────────────────────────────────────────────────
 */

/**
 * نسبة الربح (1.5 = 50% فوق سعر المزود)
 */
const MARKUP = parseFloat(process.env.MARKUP || "1.5");

/**
 * الحد الأدنى لسعر البيع
 */
const MIN_SELL_PRICE = parseFloat(process.env.MIN_SELL_PRICE || "0.01");

/**
 * حساب سعر البيع بناءً على سعر المزود
 * @param {number|string} providerPrice - سعر المزود
 * @returns {number} - سعر البيع مقرباً لرقمين عشريين
 */
function calculateSellPrice(providerPrice) {
  const price = parseFloat(providerPrice);
  if (isNaN(price) || price <= 0) return MIN_SELL_PRICE;
  const sell = Math.round(price * MARKUP * 100) / 100;
  return Math.max(sell, MIN_SELL_PRICE);
}

/**
 * حساب نسبة التغيير بين سعرين
 * @param {number} oldPrice
 * @param {number} newPrice
 * @returns {string} - مثال: "+12.50%"
 */
function calculateChangePercent(oldPrice, newPrice) {
  if (oldPrice === 0) return "N/A";
  const change = ((newPrice - oldPrice) / oldPrice) * 100;
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(2)}%`;
}

/**
 * هل السعر الجديد أعلى من السعر القديم؟
 * (لا نخفض السعر أبداً — فقط نرفعه)
 * @param {number} oldPrice
 * @param {number} newPrice
 * @returns {boolean}
 */
function isPriceHigher(oldPrice, newPrice) {
  return newPrice > oldPrice;
}

module.exports = {
  MARKUP,
  MIN_SELL_PRICE,
  calculateSellPrice,
  calculateChangePercent,
  isPriceHigher,
};
