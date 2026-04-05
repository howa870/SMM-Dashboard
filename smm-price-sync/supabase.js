/**
 * supabase.js
 * ─────────────────────────────────────────────────────
 * الاتصال بـ Supabase وتحديث أسعار الخدمات في الموقع
 * ─────────────────────────────────────────────────────
 */

const { createClient } = require("@supabase/supabase-js");
const fs   = require("fs");
const path = require("path");
const { getCurrentMarkup, calcPriceIQD: calcFromConfig } = require("./config");

const DATA_FILE = path.join(__dirname, "data", "prices.json");

/**
 * حساب سعر البيع بالدينار العراقي (يستخدم الربح الديناميكي من config)
 * @param {number} rate        - سعر المزود بالدولار
 * @param {string} serviceName - اسم الخدمة (غير مستخدم — للتوافق فقط)
 * @returns {number} - السعر بالدينار العراقي
 */
function calcPriceIQD(rate, serviceName) {
  return calcFromConfig(rate);
}

// ─── Supabase Client ─────────────────────────────────

let _client = null;

function getClient() {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null; // لم يتم الإعداد — نتخطى التحديث
  }

  _client = createClient(url, key);
  return _client;
}

/**
 * تحديث سعر خدمة في قاعدة بيانات الموقع
 * (فقط إذا كان السعر الجديد أعلى من الحالي)
 *
 * @param {string|number} providerServiceId - رقم الخدمة عند المزود
 * @param {number}        newProviderRate   - السعر الجديد بالدولار
 * @param {string}        serviceName       - اسم الخدمة
 * @returns {Promise<{updated: boolean, newPriceIQD: number, message: string}>}
 */
async function updateServicePriceInDb(providerServiceId, newProviderRate, serviceName) {
  const client = getClient();

  if (!client) {
    return { updated: false, newPriceIQD: 0, message: "Supabase غير مُعدّ — تخطي التحديث" };
  }

  const id = String(providerServiceId);

  try {
    // 1. اجلب السعر الحالي من قاعدة البيانات
    const { data: existing, error: fetchErr } = await client
      .from("services")
      .select("id, price, name")
      .eq("provider_service_id", id)
      .eq("provider", "followiz")
      .limit(1)
      .single();

    if (fetchErr || !existing) {
      return { updated: false, newPriceIQD: 0, message: `الخدمة #${id} غير موجودة في DB` };
    }

    const currentPriceIQD = Number(existing.price);
    const newPriceIQD     = calcPriceIQD(newProviderRate, serviceName || existing.name);

    // 2. لا نخفض السعر أبداً
    if (newPriceIQD <= currentPriceIQD) {
      return {
        updated: false,
        newPriceIQD,
        message: `السعر الجديد (${newPriceIQD} IQD) ≤ الحالي (${currentPriceIQD} IQD) — تجاهل`,
      };
    }

    // 3. تحديث السعر في قاعدة البيانات
    const { error: updateErr } = await client
      .from("services")
      .update({ price: newPriceIQD })
      .eq("id", existing.id);

    if (updateErr) {
      return { updated: false, newPriceIQD, message: `خطأ في التحديث: ${updateErr.message}` };
    }

    return {
      updated: true,
      oldPriceIQD: currentPriceIQD,
      newPriceIQD,
      message: `✅ تم تحديث الخدمة #${id}: ${currentPriceIQD} IQD → ${newPriceIQD} IQD`,
    };

  } catch (err) {
    return { updated: false, newPriceIQD: 0, message: `استثناء: ${err.message}` };
  }
}

/**
 * تحديث أسعار جميع الخدمات بنسبة ربح جديدة
 * يُستدعى من البوت عند تغيير نسبة الربح
 *
 * @param {number} newMarkup - المضاعف الجديد (1.5 = 50%)
 * @returns {Promise<{updated: number, failed: number}>}
 */
async function updateAllPricesWithNewMarkup(newMarkup) {
  const client = getClient();

  if (!client) {
    console.warn("[Supabase] ⚠️  لا يمكن تحديث الأسعار — Supabase غير مُعدّ");
    return { updated: 0, failed: 0 };
  }

  // 1. قراءة أسعار المزود من الملف المحلي
  let pricesData;
  try {
    if (!fs.existsSync(DATA_FILE)) {
      console.warn("[Supabase] ⚠️  prices.json غير موجود — شغّل فحصاً أولاً");
      return { updated: 0, failed: 0 };
    }
    pricesData = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (err) {
    console.error(`[Supabase] ❌ خطأ في قراءة prices.json: ${err.message}`);
    return { updated: 0, failed: 0 };
  }

  const entries = Object.values(pricesData);
  console.log(`[Supabase] 🔄 تحديث ${entries.length} خدمة بنسبة ربح ${((newMarkup - 1) * 100).toFixed(0)}%...`);

  let updated = 0;
  let failed  = 0;

  // 2. تحديث الأسعار في Supabase على دفعات (20 في آن واحد)
  const BATCH = 20;
  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH);

    await Promise.all(batch.map(async (entry) => {
      try {
        const newPriceIQD = Math.ceil(Number(entry.provider_price) * newMarkup * 1300);

        const { error } = await client
          .from("services")
          .update({ price: newPriceIQD })
          .eq("provider_service_id", String(entry.service_id))
          .eq("provider", "followiz");

        if (error) {
          failed++;
        } else {
          updated++;
        }
      } catch {
        failed++;
      }
    }));
  }

  console.log(`[Supabase] ✅ اكتمل التحديث: ${updated} نجح، ${failed} فشل`);
  return { updated, failed };
}

/**
 * فحص ما إذا كان Supabase مُعدّاً
 */
function isSupabaseConfigured() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

module.exports = {
  updateServicePriceInDb,
  updateAllPricesWithNewMarkup,
  calcPriceIQD,
  isSupabaseConfigured,
};
