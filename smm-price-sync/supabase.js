/**
 * supabase.js
 * ─────────────────────────────────────────────────────
 * الاتصال بـ Supabase وتحديث أسعار الخدمات في الموقع
 * ─────────────────────────────────────────────────────
 */

const { createClient } = require("@supabase/supabase-js");

// ─── نفس صيغة حساب السعر المستخدمة في الموقع ───────
// السعر بالدولار × المضاعف × 1300 (دينار عراقي لكل دولار)
const PROFIT_MULTIPLIERS = {
  Followers: 1.30,
  Likes:     1.25,
  Views:     1.20,
  Comments:  1.40,
  Other:     1.25,
};

function detectServiceType(name) {
  const n = (name || "").toLowerCase();
  if (/follower|member|subscriber|\bsubs?\b|audience|fan/.test(n)) return "Followers";
  if (/\blikes?\b|heart|reaction|retweet|\bfave\b/.test(n))        return "Likes";
  if (/\bviews?\b|watch|\bplays?\b|stream|impression/.test(n))     return "Views";
  if (/comment|reply|review/.test(n))                               return "Comments";
  return "Other";
}

/**
 * حساب سعر البيع بالدينار العراقي
 * @param {number} rate - سعر المزود بالدولار
 * @param {string} serviceName - اسم الخدمة (لتحديد النوع)
 * @returns {number} - السعر بالدينار العراقي
 */
function calcPriceIQD(rate, serviceName) {
  const type = detectServiceType(serviceName);
  const mult = PROFIT_MULTIPLIERS[type] ?? 1.25;
  return Math.ceil(Number(rate) * mult * 1300);
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
 * فحص ما إذا كان Supabase مُعدّاً
 */
function isSupabaseConfigured() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

module.exports = { updateServicePriceInDb, calcPriceIQD, isSupabaseConfigured };
