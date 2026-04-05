/**
 * updater.js
 * ─────────────────────────────────────────────────────
 * نظام الفحص التلقائي وتحديث الأسعار
 * القاعدة: لا نخفض السعر أبداً — فقط نرفعه
 * ─────────────────────────────────────────────────────
 */

const fs   = require("fs");
const path = require("path");

const { fetchServices }      = require("./services");
const { calculateSellPrice, calculateChangePercent, isPriceHigher } = require("./pricing");
const { notifyPriceIncrease } = require("./telegram");

const DATA_FILE = path.join(__dirname, "data", "prices.json");

// ─── Data persistence ────────────────────────────────

/**
 * تحميل الأسعار المحفوظة من الملف
 * @returns {Object} - قاموس {serviceId → record}
 */
function loadPrices() {
  try {
    if (!fs.existsSync(DATA_FILE)) return {};
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[Updater] ⚠️  خطأ في قراءة ملف الأسعار: ${err.message}`);
    return {};
  }
}

/**
 * حفظ الأسعار إلى الملف
 * @param {Object} prices
 */
function savePrices(prices) {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(prices, null, 2), "utf8");
  } catch (err) {
    console.error(`[Updater] ❌ فشل حفظ الأسعار: ${err.message}`);
  }
}

// ─── Stats counter ───────────────────────────────────

const stats = {
  totalChecks: 0,
  totalUpdates: 0,
  totalNewServices: 0,
  lastCheck: null,
};

// ─── Main update logic ───────────────────────────────

/**
 * فحص الأسعار وتحديثها إذا ارتفعت
 * @param {Object} config - إعدادات التطبيق
 */
async function checkAndUpdatePrices(config) {
  const { apiKey, baseUrl, telegramToken, telegramChatId } = config;
  const timestamp = new Date().toISOString();

  stats.totalChecks++;
  stats.lastCheck = timestamp;

  console.log(`\n${"─".repeat(60)}`);
  console.log(`[${timestamp}] 🔄 بدء فحص الأسعار (#${stats.totalChecks})`);

  // ── 1. جلب الخدمات من API ──
  let services;
  try {
    services = await fetchServices(apiKey, baseUrl);
  } catch (err) {
    console.error(`[${timestamp}] ❌ تعذّر جلب الخدمات: ${err.message}`);
    console.log(`[${timestamp}] ⏭️  تأجيل الفحص حتى الدورة القادمة...`);
    return; // لا نوقف النظام — ننتظر الدورة القادمة
  }

  // ── 2. تحميل الأسعار المحفوظة ──
  const savedPrices = loadPrices();

  let newCount     = 0;
  let updatedCount = 0;
  let skippedDown  = 0;
  let unchanged    = 0;

  // ── 3. معالجة كل خدمة ──
  for (const service of services) {
    const serviceId       = String(service.service || service.id || "");
    const serviceName     = service.name || `Service #${serviceId}`;
    const newProviderPrice = parseFloat(service.rate || service.price || 0);

    if (!serviceId || isNaN(newProviderPrice) || newProviderPrice <= 0) continue;

    const newSellPrice = calculateSellPrice(newProviderPrice);
    const existing     = savedPrices[serviceId];

    if (!existing) {
      // ── خدمة جديدة لم نرها من قبل ──
      savedPrices[serviceId] = {
        service_id:     serviceId,
        name:           serviceName,
        provider_price: newProviderPrice,
        sell_price:     newSellPrice,
        created_at:     timestamp,
        updated_at:     timestamp,
      };
      newCount++;
      console.log(
        `[Updater] ✨ خدمة جديدة #${serviceId}: سعر المزود $${newProviderPrice.toFixed(4)} — سعر البيع $${newSellPrice.toFixed(4)}`
      );
      continue;
    }

    const oldProviderPrice = existing.provider_price;
    const oldSellPrice     = existing.sell_price;

    if (newProviderPrice === oldProviderPrice) {
      unchanged++;
      continue;
    }

    if (isPriceHigher(oldProviderPrice, newProviderPrice)) {
      // ── السعر ارتفع — نحدّث ──
      const changePercent = calculateChangePercent(oldProviderPrice, newProviderPrice);

      console.log(
        `[Updater] 📈 ارتفع السعر للخدمة #${serviceId} (${serviceName})\n` +
        `          المزود: $${oldProviderPrice.toFixed(4)} → $${newProviderPrice.toFixed(4)} (${changePercent})\n` +
        `          البيع:  $${oldSellPrice.toFixed(4)} → $${newSellPrice.toFixed(4)}`
      );

      savedPrices[serviceId] = {
        ...existing,
        name:           serviceName,
        provider_price: newProviderPrice,
        sell_price:     newSellPrice,
        updated_at:     timestamp,
      };
      updatedCount++;
      stats.totalUpdates++;

      // ── إرسال إشعار Telegram ──
      if (telegramToken && telegramChatId) {
        notifyPriceIncrease(telegramToken, telegramChatId, {
          serviceId,
          serviceName,
          oldProviderPrice,
          newProviderPrice,
          oldSellPrice,
          newSellPrice,
          changePercent,
        }).catch((err) =>
          console.error(`[Telegram] ❌ فشل إرسال الإشعار: ${err.message}`)
        );
      }
    } else {
      // ── السعر انخفض — نتجاهل (لا نخفض أبداً) ──
      skippedDown++;
      console.log(
        `[Updater] ⬇️  تجاهل انخفاض السعر للخدمة #${serviceId}: $${oldProviderPrice.toFixed(4)} → $${newProviderPrice.toFixed(4)} (نحتفظ بسعرنا)`
      );
    }
  }

  // ── 4. حفظ التحديثات ──
  savePrices(savedPrices);
  stats.totalNewServices += newCount;

  // ── 5. ملخص ──
  console.log(
    `[${timestamp}] 📊 ملخص الفحص:\n` +
    `          ✨ جديدة: ${newCount} | 📈 مرتفعة: ${updatedCount} | ⬇️  متجاهلة: ${skippedDown} | ➖ بدون تغيير: ${unchanged}\n` +
    `          📦 الإجمالي في القاعدة: ${Object.keys(savedPrices).length} خدمة`
  );
}

/**
 * الحصول على إحصائيات النظام
 */
function getStats() {
  return { ...stats };
}

/**
 * الحصول على قائمة الخدمات المحفوظة
 */
function getSavedPrices() {
  return loadPrices();
}

module.exports = { checkAndUpdatePrices, getStats, getSavedPrices };
