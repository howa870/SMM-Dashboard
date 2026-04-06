/**
 * index.js — SMM Price Sync System
 * ─────────────────────────────────────────────────────────────────────────────
 * نظام مراقبة وتحديث أسعار خدمات SMM Panel تلقائياً
 *
 * الميزات:
 *  - جلب الخدمات من API خارجي (Followiz أو أي مزود آخر)
 *  - حساب سعر البيع تلقائياً (50% ربح)
 *  - تحديث الأسعار كل 5 دقائق — فقط يرفع لا يخفض
 *  - إرسال إشعارات Telegram عند ارتفاع الأسعار
 *  - معالجة الأخطاء وإعادة المحاولة تلقائياً
 *
 * كيفية التشغيل:
 *  1. انسخ .env.example إلى .env
 *  2. أضف API_KEY و TELEGRAM_BOT_TOKEN و TELEGRAM_CHAT_ID
 *  3. npm install
 *  4. npm start
 * ─────────────────────────────────────────────────────────────────────────────
 */

require("dotenv").config();
const cron = require("node-cron");

const { checkAndUpdatePrices, getStats, getSavedPrices } = require("./updater");
const { notifyStartup }                                  = require("./telegram");
const { isSupabaseConfigured, updateAllPricesWithNewMarkup, getMarkupFromSupabase } = require("./supabase");
const { startBot }                                       = require("./bot");
const { getCurrentMarkup, setCurrentMarkup }             = require("./config");

// ─── التحقق من المتغيرات الأساسية ───────────────────

const config = {
  apiKey:          process.env.API_KEY,
  baseUrl:         process.env.API_URL || "https://followiz.com/api/v2",
  telegramToken:   process.env.TELEGRAM_BOT_TOKEN || "",
  telegramChatId:  process.env.TELEGRAM_CHAT_ID || "",
};

if (!config.apiKey) {
  console.error("❌ خطأ: API_KEY غير موجود في ملف .env");
  console.error("   أضف: API_KEY=your_key_here إلى ملف .env");
  process.exit(1);
}

// ─── بدء النظام ──────────────────────────────────────

console.log("═".repeat(60));
console.log("  🤖 SMM Price Sync System v1.0");
console.log("═".repeat(60));
console.log(`  📡 API URL:   ${config.baseUrl}`);
console.log(`  🔑 API Key:   ${config.apiKey.slice(0, 6)}${"*".repeat(Math.max(0, config.apiKey.length - 6))}`);
console.log(`  💬 Telegram:  ${config.telegramToken ? "✅ مفعّل" : "❌ غير مفعّل"}`);
console.log(`  🗄️  Supabase:  ${isSupabaseConfigured() ? "✅ مفعّل — الموقع يتحدث تلقائياً" : "⚠️  غير مفعّل (أضف SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY)"}`);
console.log(`  ⏰ الفحص كل: 5 دقائق`);
console.log(`  📈 هامش الربح: ${((parseFloat(process.env.MARKUP || "1.5") - 1) * 100).toFixed(0)}%`);
console.log("═".repeat(60));
console.log("");

// ─── تشغيل الفحص الأول فور البدء ────────────────────

// ─── مزامنة نسبة الربح من Supabase ───────────────────
async function syncMarkupFromSupabase() {
  try {
    const sbMarkup = await getMarkupFromSupabase();
    if (sbMarkup && sbMarkup !== getCurrentMarkup()) {
      const pct = ((sbMarkup - 1) * 100).toFixed(0);
      console.log(`[Sync] 🔄 نسبة الربح تغيّرت من Supabase: ${pct}%`);
      setCurrentMarkup(sbMarkup);
    }
  } catch (e) {
    console.warn(`[Sync] ⚠️  تعذّر قراءة نسبة الربح من Supabase: ${e.message}`);
  }
}

async function initialRun() {
  try {
    await syncMarkupFromSupabase();
    await checkAndUpdatePrices(config);

    // إشعار Telegram بعد الفحص الأول (إذا كان مفعّلاً)
    if (config.telegramToken && config.telegramChatId) {
      const prices = getSavedPrices();
      const count  = Object.keys(prices).length;
      notifyStartup(config.telegramToken, config.telegramChatId, count).catch(
        (err) => console.warn(`[Telegram] تعذّر إرسال إشعار البدء: ${err.message}`)
      );
    }
  } catch (err) {
    console.error(`[Main] ❌ خطأ في الفحص الأول: ${err.message}`);
    console.error("       النظام يستمر ويحاول في الدورة القادمة...");
  }
}

initialRun();

// ─── جدولة الفحص كل 5 دقائق ─────────────────────────

const job = cron.schedule(
  "*/5 * * * *",
  async () => {
    await syncMarkupFromSupabase();
    checkAndUpdatePrices(config).catch((err) => {
      console.error(
        `[Main] ❌ خطأ في الفحص الدوري: ${err.message}\n       النظام يستمر...`
      );
    });
  },
  {
    scheduled: true,
    timezone: "Asia/Baghdad",
  }
);

console.log("⏰ تم جدولة الفحص التلقائي كل 5 دقائق");
console.log("   اضغط Ctrl+C لإيقاف النظام\n");

// ─── تشغيل بوت Telegram ──────────────────────────────
startBot(config.telegramToken, config.telegramChatId, {
  getStats,
  updateAllPricesWithNewMarkup,
});

// ─── إحصائيات دورية كل ساعة ─────────────────────────

setInterval(() => {
  const s = getStats();
  console.log(
    `\n📊 [إحصائيات ساعية] فحصات: ${s.totalChecks} | تحديثات: ${s.totalUpdates} | خدمات جديدة: ${s.totalNewServices} | آخر فحص: ${s.lastCheck}`
  );
}, 60 * 60 * 1000);

// ─── إغلاق نظيف عند إيقاف البرنامج ─────────────────

process.on("SIGINT", () => {
  console.log("\n\n🛑 إيقاف النظام...");
  const s = getStats();
  console.log(
    `📊 ملخص الجلسة:\n   فحصات: ${s.totalChecks} | تحديثات: ${s.totalUpdates} | خدمات جديدة: ${s.totalNewServices}`
  );
  job.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  job.stop();
  process.exit(0);
});

process.on("uncaughtException", (err) => {
  console.error(`[Main] ❌ خطأ غير متوقع: ${err.message}`);
  console.error(err.stack);
  // النظام يستمر — لا يتوقف من أجل خطأ واحد
});

process.on("unhandledRejection", (reason) => {
  console.error(`[Main] ❌ Promise رُفضت: ${reason}`);
  // النظام يستمر
});
