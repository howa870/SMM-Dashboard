/**
 * config.js
 * ─────────────────────────────────────────────────────
 * إدارة الإعدادات الديناميكية (نسبة الربح وغيرها)
 * تُحفظ في data/config.json وتبقى بعد إعادة التشغيل
 * ─────────────────────────────────────────────────────
 */

const fs   = require("fs");
const path = require("path");

const CONFIG_FILE = path.join(__dirname, "data", "config.json");

function loadConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return {};
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveConfig(cfg) {
  try {
    const dir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), "utf8");
  } catch (err) {
    console.error(`[Config] ❌ فشل حفظ الإعدادات: ${err.message}`);
  }
}

// تحميل الإعدادات عند بدء التشغيل
// الأولوية: config.json > .env > الافتراضي (1.5 = 50%)
const _cfg = {
  markup: parseFloat(process.env.MARKUP || "1.5"),
  ...loadConfig(),
};

/**
 * الحصول على نسبة الربح الحالية (1.5 = 50%)
 */
function getCurrentMarkup() {
  return _cfg.markup;
}

/**
 * تعيين نسبة ربح جديدة وحفظها
 * @param {number} m - المضاعف (مثال: 1.6 = 60% ربح)
 */
function setCurrentMarkup(m) {
  _cfg.markup = m;
  saveConfig(_cfg);
  console.log(`[Config] ✅ نسبة الربح تغيرت إلى ${((m - 1) * 100).toFixed(0)}% (${m}x)`);
}

/**
 * حساب السعر بالدينار العراقي
 * @param {number} providerRate - سعر المزود بالدولار
 * @param {number} [markup]     - المضاعف (اختياري، يستخدم الحالي إذا لم يُحدد)
 * @returns {number} - السعر بالدينار العراقي
 */
function calcPriceIQD(providerRate, markup) {
  const m = markup ?? getCurrentMarkup();
  return Math.ceil(Number(providerRate) * m * 1300);
}

module.exports = { getCurrentMarkup, setCurrentMarkup, calcPriceIQD };
