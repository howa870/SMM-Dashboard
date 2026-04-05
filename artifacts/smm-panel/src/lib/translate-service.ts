/**
 * translateServiceName
 * ─────────────────────────────────────────────────────────────────────────────
 * Translates English SMM service names to Arabic while:
 *  • Preserving all bracket groups [ ] and their internal structure
 *  • Preserving numbers, rates, symbols (1h, 500k, ⛔, etc.)
 *  • Translating only known English words/phrases
 *  • Applying bracket-specific qualifier translations (High Quality, Male, etc.)
 */

// ── Platform names ────────────────────────────────────────────────────────────
const PLATFORMS: [RegExp, string][] = [
  [/\bFacebook\b/gi,   "فيسبوك"],
  [/\bInstagram\b/gi,  "انستغرام"],
  [/\bTikTok\b/gi,     "تيك توك"],
  [/\bTiktok\b/gi,     "تيك توك"],
  [/\bYouTube\b/gi,    "يوتيوب"],
  [/\bYoutube\b/gi,    "يوتيوب"],
  [/\bX\/Twitter\b/gi, "إكس/تويتر"],
  [/\bTwitter\b/gi,    "تويتر"],
  [/\bTelegram\b/gi,   "تيليغرام"],
  [/\bSpotify\b/gi,    "سبوتيفاي"],
  [/\bLinkedin\b/gi,   "لينكد إن"],
  [/\bLinkedIn\b/gi,   "لينكد إن"],
  [/\bTwitch\b/gi,     "تويتش"],
  [/\bKick\b/gi,       "كيك"],
  [/\bWebsite\b/gi,    "موقع ويب"],
];

// ── Compound phrases (must be matched BEFORE individual words) ────────────────
// Sorted longest → shortest to ensure correct precedence
const PHRASES: [RegExp, string][] = [
  // Auto combos
  [/\bAuto\s+Shares?\s*\+\s*Engagements?\s*\+\s*Reachs?\b/gi, "مشاركات تلقائية + تفاعلات + وصول"],
  [/\bAuto\s+Shares?\s*\+\s*Engagements?\b/gi,                 "مشاركات تلقائية + تفاعلات"],
  [/\bAuto\s+Reachs?\s*\+\s*Impressions?\b/gi,                 "وصول تلقائي + ظهور"],
  [/\bAuto\s+Comments?\s+Random\b/gi,                          "تعليقات تلقائية عشوائية"],
  [/\bAuto\s+Likes?\b/gi,                                      "إعجابات تلقائية"],
  [/\bAuto\s+Saves?\b/gi,                                      "حفظ تلقائي"],
  [/\bAuto\s+Shares?\b/gi,                                     "مشاركات تلقائية"],
  [/\bAuto\s+Views?\b/gi,                                      "مشاهدات تلقائية"],

  // Live combos
  [/\bLive\s+Stream\s+Comments?\s+Emoji\b/gi,    "تعليقات بث مباشر إيموجي"],
  [/\bLive\s+Stream\s+Likes?\b/gi,               "إعجابات بث مباشر"],
  [/\bLive\s+Stream\s+Views?\b/gi,               "مشاهدات بث مباشر"],
  [/\bLivestream\s+Views?\b/gi,                  "مشاهدات بث مباشر"],
  [/\bLive\s+Stream\b/gi,                        "بث مباشر"],
  [/\bLivestream\b/gi,                           "بث مباشر"],

  // Likes combos
  [/\bPower\s+Likes?\s*\+\s*Impressions?\s*\+\s*Reach\s*\+\s*Explore\b/gi,
                                                 "إعجابات مميزة + ظهور + وصول + استكشاف"],
  [/\bPower\s+Likes?\s*\+\s*Impressions?\s*\+\s*Reach\b/gi,
                                                 "إعجابات مميزة + ظهور + وصول"],
  [/\bLikes?\s*\+\s*Impressions?\s*\+\s*Reach\b/gi,  "إعجابات + ظهور + وصول"],
  [/\bLikes?\s*\+\s*Reach\s*\+\s*Impression\b/gi,    "إعجابات + وصول + ظهور"],
  [/\bLikes?\s*\+\s*Impressions?\b/gi,               "إعجابات + ظهور"],
  [/\bLikes?\s*\+\s*Views?\b/gi,                     "إعجابات + مشاهدات"],
  [/\bLikes?\s*\+\s*Retweet\b/gi,                    "إعجابات + إعادة تغريد"],
  [/\bPower\s+Likes?\b/gi,                           "إعجابات مميزة"],
  [/\bComment\s+Likes?\b/gi,                         "إعجابات التعليقات"],

  // Shares combos
  [/\bShares?\s*\+\s*Engagements?\s*\+\s*Reachs?\b/gi,  "مشاركات + تفاعلات + وصول"],
  [/\bShares?\s*\+\s*Engagements?\b/gi,                  "مشاركات + تفاعلات"],
  [/\bReshare\s*\/\s*Repost\b/gi,                        "إعادة مشاركة"],

  // Reach + Impressions combos
  [/\bReachs?\s*\+\s*Impressions?\b/gi,  "وصول + ظهور"],

  // Reactions combos
  [/\bReactions?\s*\+\s*Views?\b/gi,  "تفاعلات + مشاهدات"],

  // Story combos
  [/\bStory\s+Views?\s*\+\s*Reachs?\b/gi,  "مشاهدات ستوري + وصول"],
  [/\bStory\s+Link\s+Taps?\b/gi,            "نقرات روابط الستوري"],
  [/\bStory\s+Tag\s+Taps?\b/gi,             "نقرات وسوم الستوري"],
  [/\bStory\s+Views?\b/gi,                  "مشاهدات الستوري"],

  // Tweet combos
  [/\bTweet\s+Views?\s*\+\s*Impressions?\b/gi,  "مشاهدات التغريدة + ظهور"],
  [/\bTweet\s+Detail\s+Click\b/gi,              "نقرات تفاصيل التغريدة"],
  [/\bTweet\s+Profile\s+Click\b/gi,             "نقرات حساب التغريدة"],
  [/\bTweet\s+Impression\b/gi,                  "ظهور التغريدة"],
  [/\bTweet\s+Views?\b/gi,                      "مشاهدات التغريدة"],

  // Page / Post / Group / Profile combos
  [/\bPage\s+Likes?\s*\+\s*Followers?\b/gi,  "إعجابات الصفحة + متابعين"],
  [/\bPage\s+Likes?\b/gi,                    "إعجابات الصفحة"],
  [/\bPost\s+Likes?\b/gi,                    "إعجابات المنشور"],
  [/\bPost\s+Shares?\b/gi,                   "مشاركات المنشور"],
  [/\bPost\s+Views?\b/gi,                    "مشاهدات المنشور"],
  [/\bGroup\s+Members?\b/gi,                 "أعضاء المجموعة"],
  [/\bVideo\s+Views?\b/gi,                   "مشاهدات الفيديو"],
  [/\bClip\s+Views?\b/gi,                    "مشاهدات المقطع"],
  [/\bProfile\s+Visits?\b/gi,                "زيارات الحساب"],

  // Spotify combos
  [/\bAlbum\s+Plays?\b/gi,           "تشغيل الألبوم"],
  [/\bMonthly\s+Listeners?\b/gi,     "مستمعون شهريون"],
  [/\bPlaylist\s+Plays?\b/gi,        "تشغيل قائمة التشغيل"],

  // Telegram combos
  [/\bPremium\s+Members?\b/gi,               "أعضاء مميزون"],
  [/\bAuto\s+Reactions?\s*\+\s*Views?\b/gi,  "تفاعلات تلقائية + مشاهدات"],
  [/\bVote\s+&amp;\s+Poll\b/gi,              "تصويت واستطلاع"],
  [/\bVote\s+&\s+Poll\b/gi,                  "تصويت واستطلاع"],

  // Community combos
  [/\bCommunity\s+Members?\b/gi,  "أعضاء المجتمع"],

  // Chat bot
  [/\bChat\s+Bot\b/gi,  "بوت الدردشة"],

  // Comments combos
  [/\bComments?\s+Random\b/gi,   "تعليقات عشوائية"],
  [/\bComments?\s+Custom\b/gi,   "تعليقات مخصصة"],
  [/\bComments?\s+Likes?\b/gi,   "إعجابات التعليقات"],

  // Views from Followers
  [/\bViews?\s+from\s+Followers?\b/gi, "مشاهدات من متابعين"],
];

// ── Single words (applied after phrases) ─────────────────────────────────────
const WORDS: [RegExp, string][] = [
  [/\bFollowers?\b/gi,    "متابعين"],
  [/\bLikes?\b/gi,        "إعجابات"],
  [/\bViews?\b/gi,        "مشاهدات"],
  [/\bComments?\b/gi,     "تعليقات"],
  [/\bShares?\b/gi,       "مشاركات"],
  [/\bMembers?\b/gi,      "أعضاء"],
  [/\bSubscribers?\b/gi,  "مشتركين"],
  [/\bReels?\b/gi,        "ريلز"],
  [/\bStory\b/gi,         "ستوري"],
  [/\bSaves?\b/gi,        "حفظ"],
  [/\bImpressions?\b/gi,  "مرات الظهور"],
  [/\bReachs?\b/gi,       "وصول"],
  [/\bWatchtime\b/gi,     "وقت المشاهدة"],
  [/\bTraffic\b/gi,       "زيارات"],
  [/\bReactions?\b/gi,    "تفاعلات"],
  [/\bVote\b/gi,          "تصويت"],
  [/\bPoll\b/gi,          "استطلاع"],
  [/\bRepost\b/gi,        "إعادة نشر"],
  [/\bReshare\b/gi,       "إعادة مشاركة"],
  [/\bPlays?\b/gi,        "تشغيل"],
  [/\bPlaylist\b/gi,      "قائمة التشغيل"],
  [/\bTweet\b/gi,         "تغريدة"],
  [/\bImpression\b/gi,    "ظهور"],
  [/\bPost\b/gi,          "منشور"],
  [/\bPage\b/gi,          "صفحة"],
  [/\bProfile\b/gi,       "حساب"],
  [/\bGroup\b/gi,         "مجموعة"],
  [/\bEvent\b/gi,         "فعالية"],
  [/\bVideo\b/gi,         "فيديو"],
  [/\bClip\b/gi,          "مقطع"],
  [/\bPremium\b/gi,       "مميز"],
  [/\bIGTV\b/gi,          "IGTV"],
];

// ── Bracket-internal qualifiers ───────────────────────────────────────────────
// These are applied only INSIDE bracket content
const BRACKET_TERMS: [RegExp, string][] = [
  [/\bHigh\s+Quality\b/gi,         "جودة عالية"],
  [/\bLow\s+Quality\b/gi,          "جودة منخفضة"],
  [/\b100%\s+Concurrent\b/gi,      "100% متزامن"],
  [/\bPage\s*-\s*Profile\b/gi,     "صفحة - حساب"],
  [/\bPage\s*\/\s*Profile\b/gi,    "صفحة/حساب"],
  [/\bPage\s+Only\b/gi,            "صفحة فقط"],
  [/\bProfile\s+Only\b/gi,         "حساب فقط"],
  [/\bPost\s*-\s*Photo\b/gi,       "منشور - صورة"],
  [/\bViews\s+from\s+Followers\b/gi, "مشاهدات من متابعين"],
  [/\bMale\b/gi,                   "ذكور"],
  [/\bFemale\b/gi,                 "إناث"],
  [/\bUSA\b/g,                     "أمريكي"],
  [/\bTurkish\b/gi,                "تركي"],
  [/\bVietnamese?\b/gi,            "فيتنامي"],
  [/\bPremium\b/gi,                "مميز"],
  [/\bConcurrent\b/gi,             "متزامن"],
  // Time units (only when accompanied by a number)
  [/\b(\d+)\s+Minutes?\b/gi, (_m, n) => `${n} دقيقة`],
  [/\b(\d+)\s+Seconds?\b/gi, (_m, n) => `${n} ثانية`],
  [/\b(\d+)\s+Hours?\b/gi,   (_m, n) => `${n} ساعة`],
  [/\b(\d+)\s+Days?\b/gi,    (_m, n) => `${n} يوم`],
  [/\b(\d+)\s+Weeks?\b/gi,   (_m, n) => `${n} أسبوع`],
  [/\b(\d+)\s+Months?\b/gi,  (_m, n) => `${n} شهر`],
  [/\b(\d+)\s+Years?\b/gi,   (_m, n) => `${n} سنة`],
];

// ── Brand suffix cleanup ──────────────────────────────────────────────────────
// "- FOLLOWIZ.com" and "- FOLLOWIZ.COM" → remove (it's just a supplier tag)
const BRAND_SUFFIX = /\s*-\s*FOLLOWIZ\.com[s]?\s*$/gi;
const BRAND_SUFFIX2 = /\s*-\s*FOLLOWIZ\.COM[S]?\s*$/gi;

// Private services
const PRIVATE_MAP: Record<string, string> = {
  "private":   "خدمة خاصة",
  "private-f": "خدمة خاصة - إناث",
  "private-m": "خدمة خاصة - ذكور",
};

// ── Main function ─────────────────────────────────────────────────────────────
export function translateServiceName(name: string): string {
  if (!name) return name;

  const lower = name.trim().toLowerCase();

  // Handle private services
  if (lower in PRIVATE_MAP) return PRIVATE_MAP[lower];

  // Remove brand suffix before translation
  let cleaned = name
    .replace(BRAND_SUFFIX, "")
    .replace(BRAND_SUFFIX2, "")
    .trim();

  // Split into segments: [bracket content] vs outer text
  // We process each segment separately
  const segments = cleaned.split(/(\[[^\]]*\])/g);

  const translated = segments.map((seg) => {
    if (seg.startsWith("[") && seg.endsWith("]")) {
      // ── Bracket segment: apply bracket-specific qualifiers only ──────────
      const inner = seg.slice(1, -1);
      let result = inner;
      for (const [re, ar] of BRACKET_TERMS) {
        result = result.replace(re, ar as string);
      }
      return `[${result}]`;
    } else {
      // ── Outer segment: apply platforms → phrases → words ─────────────────
      let result = seg;

      // 1. Platform names
      for (const [re, ar] of PLATFORMS) {
        result = result.replace(re, ar);
      }

      // 2. Compound phrases (longest first)
      for (const [re, ar] of PHRASES) {
        result = result.replace(re, ar);
      }

      // 3. Individual words
      for (const [re, ar] of WORDS) {
        result = result.replace(re, ar);
      }

      return result;
    }
  });

  return translated.join("").replace(/\s{2,}/g, " ").trim();
}
