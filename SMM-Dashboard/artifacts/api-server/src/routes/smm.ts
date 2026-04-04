import { Router } from "express";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const router = Router();

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const FOLLOWIZ_URL = "https://followiz.com/api/v2";
const FOLLOWIZ_KEY = process.env["FOLLOWIZ_KEY"] || "";

const SUPABASE_URL = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"] || "";
const SUPABASE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"] || "";

if (!FOLLOWIZ_KEY) console.warn("[SMM] ⚠️  FOLLOWIZ_KEY env var not set!");
if (!SUPABASE_URL || !SUPABASE_KEY) console.warn("[SMM] ⚠️  Supabase credentials missing");

const adminDb: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── TYPES ────────────────────────────────────────────────────────────────────
type FollowizService = {
  service: number;
  name: string;
  type: string;
  category: string;
  rate: string;
  min: string | number;
  max: string | number;
  refill?: boolean;
  cancel?: boolean;
};

// ─── FOLLOWIZ RAW API CALL ────────────────────────────────────────────────────
async function followizRequest(params: Record<string, string>): Promise<unknown> {
  const body = new URLSearchParams({ key: FOLLOWIZ_KEY, ...params });
  console.log(`[SMM] → Followiz action=${params.action}`);
  const res = await fetch(FOLLOWIZ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = await res.json();
  console.log(`[SMM] ← Followiz (${params.action}):`, JSON.stringify(json).slice(0, 200));
  return json;
}

// ─── PLATFORM DETECTION ───────────────────────────────────────────────────────
const PLATFORM_RULES: Array<{ kw: string[]; platform: string }> = [
  { kw: ["instagram"],              platform: "Instagram"   },
  { kw: ["tiktok", "tik tok"],     platform: "TikTok"      },
  { kw: ["telegram"],               platform: "Telegram"    },
  { kw: ["youtube", "yt "],        platform: "YouTube"     },
  { kw: ["facebook", "fb "],       platform: "Facebook"    },
  { kw: ["twitter", " x "],        platform: "Twitter"     },
  { kw: ["snapchat"],               platform: "Snapchat"    },
  { kw: ["twitch"],                 platform: "Twitch"      },
  { kw: ["spotify"],                platform: "Spotify"     },
  { kw: ["soundcloud"],             platform: "SoundCloud"  },
  { kw: ["linkedin"],               platform: "LinkedIn"    },
  { kw: ["pinterest"],              platform: "Pinterest"   },
  { kw: ["discord"],                platform: "Discord"     },
  { kw: ["threads"],                platform: "Threads"     },
];

function detectPlatform(name: string, category: string): string {
  const h = (name + " " + category).toLowerCase();
  for (const r of PLATFORM_RULES) {
    if (r.kw.some(k => h.includes(k))) return r.platform;
  }
  return "Other";
}

// ══════════════════════════════════════════════════════════════════════════════
// SERVICE QUALITY FILTER
// Keeps only high-quality services, removes spam/bots, max 20 per platform
// ══════════════════════════════════════════════════════════════════════════════

// ─── QUALITY KEYWORDS ─────────────────────────────────────────────────────────
// Any of these in the name = quality tier (preferred)
const QUALITY_KEYWORDS = [
  "high quality", "no drop", "real", "refill", "fast",
  "[r7]", "[r30]", "[r60]", "[r90]", "[r365]",   // Followiz refill shorthands
  "guaranteed", "hq",
];

// Any of these = blacklisted (always removed)
const BLACKLIST_KEYWORDS = ["cheap", "low quality", "bot", "test", "trial"];

// ─── SERVICE TYPE DETECTION ────────────────────────────────────────────────────
type ServiceType = "Followers" | "Likes" | "Views" | "Comments" | "Other";

const TYPE_LIMITS: Record<ServiceType, number> = {
  Followers: 10,
  Likes:      5,
  Views:      5,
  Comments:   5,
  Other:      5,
};

const MAX_PER_PLATFORM = 30;

function detectServiceType(name: string): ServiceType {
  const n = name.toLowerCase();
  if (/follower|member|subscriber|\bsubs?\b|audience|fan/.test(n)) return "Followers";
  if (/\blikes?\b|heart|reaction|retweet|\bfave\b/.test(n))        return "Likes";
  if (/\bviews?\b|watch|\bplays?\b|stream|impression/.test(n))     return "Views";
  if (/comment|reply|review/.test(n))                               return "Comments";
  return "Other";
}

// Quality score: higher = better
function qualityScore(name: string): number {
  const n = name.toLowerCase();
  if (n.includes("no drop"))                          return 6;
  if (n.includes("[r365]"))                           return 5;
  if (n.includes("high quality") || n.includes("hq")) return 5;
  if (n.includes("real"))                             return 4;
  if (n.includes("[r90]") || n.includes("[r60]"))    return 3;
  if (n.includes("fast"))                             return 3;
  if (n.includes("guaranteed"))                       return 3;
  if (n.includes("[r30]"))                            return 2;
  if (n.includes("[r7]") || n.includes("refill"))    return 1;
  return 0;
}

// ─── MAIN FILTER FUNCTION ─────────────────────────────────────────────────────
function filterAndRankServices(raw: FollowizService[]): FollowizService[] {
  // 1. Deduplicate
  const seen = new Set<string>();
  const deduped = raw.filter(s => {
    const k = String(s.service);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // 2. Remove blacklisted
  const cleaned = deduped.filter(s => !BLACKLIST_KEYWORDS.some(kw => s.name.toLowerCase().includes(kw)));

  // 3. Split quality tier vs standard tier
  const isQuality = (s: FollowizService) => QUALITY_KEYWORDS.some(kw => s.name.toLowerCase().includes(kw));
  const qualityTier  = cleaned.filter(isQuality);
  const standardTier = cleaned.filter(s => !isQuality(s));

  // 4. Sort each tier: quality score desc, then rate asc (best value first)
  const sortFn = (a: FollowizService, b: FollowizService) => {
    const d = qualityScore(b.name) - qualityScore(a.name);
    return d !== 0 ? d : Number(a.rate) - Number(b.rate);
  };
  qualityTier.sort(sortFn);
  standardTier.sort(sortFn);

  // 5. Group each tier by (platform, serviceType)
  type Bucket = FollowizService[];
  const makeKey = (s: FollowizService) =>
    `${detectPlatform(s.name, s.category)}|${detectServiceType(s.name)}`;

  const qualityBuckets: Record<string, Bucket> = {};
  const standardBuckets: Record<string, Bucket> = {};

  for (const s of qualityTier) {
    const k = makeKey(s);
    (qualityBuckets[k] ||= []).push(s);
  }
  for (const s of standardTier) {
    const k = makeKey(s);
    (standardBuckets[k] ||= []).push(s);
  }

  // 6. For each platform, build the result respecting per-type & total limits
  const result: FollowizService[] = [];
  const platformTotals: Record<string, number> = {};
  const typeCounts: Record<string, Record<ServiceType, number>> = {};

  const addService = (s: FollowizService) => {
    const p    = detectPlatform(s.name, s.category);
    const type = detectServiceType(s.name);
    platformTotals[p] = (platformTotals[p] || 0) + 1;
    if (!typeCounts[p]) typeCounts[p] = { Followers: 0, Likes: 0, Views: 0, Comments: 0, Other: 0 };
    typeCounts[p][type] = (typeCounts[p][type] || 0) + 1;
    result.push(s);
  };

  const canAdd = (s: FollowizService): boolean => {
    const p    = detectPlatform(s.name, s.category);
    const type = detectServiceType(s.name);
    const tc   = typeCounts[p]?.[type] || 0;
    const tot  = platformTotals[p] || 0;
    return tc < TYPE_LIMITS[type] && tot < MAX_PER_PLATFORM;
  };

  // Pass 1: quality tier
  for (const s of qualityTier) {
    if (canAdd(s)) addService(s);
  }

  // Pass 2: backfill with standard tier where type slots still open
  for (const s of standardTier) {
    if (canAdd(s)) addService(s);
  }

  // Log summary
  const summary = Object.entries(platformTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([p, c]) => `${p}:${c}`)
    .join(", ");
  console.log(`[SMM] ✅ Filter: ${result.length}/${raw.length} services kept | ${summary}`);
  return result;
}

// ══════════════════════════════════════════════════════════════════════════════
// AUTO-SYNC ENGINE
// Fetches from Followiz → filters → upserts to Supabase
// ─── SMART PRICING ────────────────────────────────────────────────────────────
// Type-based profit multiplier × 1300 IQD per USD
const PROFIT_MULTIPLIERS: Record<string, number> = {
  Followers: 1.30,
  Likes:     1.25,
  Views:     1.20,
  Comments:  1.40,
  Other:     1.25,
};

function calcPriceIQD(rate: number | string, serviceType?: string): number {
  const mult = PROFIT_MULTIPLIERS[serviceType || "Other"] ?? 1.25;
  return Math.ceil(Number(rate) * mult * 1300);
}

// Price = rate * profit_multiplier * 1300 IQD/USD
// ══════════════════════════════════════════════════════════════════════════════
let lastDbSyncTime = 0;       // epoch ms of last successful DB sync
let isDbSyncing    = false;   // guard against concurrent syncs
const DB_SYNC_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const BATCH_SIZE = 100;

async function autoSyncServicesToDb(): Promise<number> {
  if (isDbSyncing) {
    console.log("[SMM] Sync already in progress — skipping");
    return 0;
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn("[SMM] Cannot sync — Supabase credentials missing");
    return 0;
  }

  isDbSyncing = true;
  console.log("[SMM] 🔄 Auto-syncing services to Supabase...");

  try {
    // 1. Fetch from Followiz API
    let followizServices: FollowizService[];
    try {
      const raw = await followizRequest({ action: "services" });
      if (!Array.isArray(raw)) throw new Error("Unexpected response format");
      followizServices = raw as FollowizService[];
      console.log(`[SMM] Fetched ${followizServices.length} services from Followiz`);
    } catch (err) {
      console.error("[SMM] Failed to fetch from Followiz:", err);
      return 0;
    }

    // 2. Filter & rank — keep only high-quality services, max 20 per platform
    const filtered = filterAndRankServices(followizServices);
    console.log(`[SMM] Filtered: ${filtered.length}/${followizServices.length} services kept`);

    // 3. Build upsert rows — type-based smart pricing
    const rows = filtered.map(svc => {
      const svcType = detectServiceType(svc.name);
      return {
      provider:            "followiz",
      provider_service_id: String(svc.service),
      name:                svc.name,
      category:            svc.category,
      platform:            detectPlatform(svc.name, svc.category),
      service_type:        svcType,
      price:               calcPriceIQD(svc.rate, svcType),
      min_order:           Number(svc.min),
      max_order:           Number(svc.max),
      status:              "active",
      };
    });

    // 4. Smart sync: fetch existing provider_service_ids → INSERT new, UPDATE existing
    const keptIds = new Set(rows.map(r => r.provider_service_id));

    // Load all existing followiz provider_service_id values from DB
    const { data: existingRows } = await adminDb
      .from("services")
      .select("id, provider_service_id")
      .eq("provider", "followiz");

    const existingMap = new Map<string, number>(
      (existingRows || []).map(r => [r.provider_service_id as string, r.id as number])
    );

    const toInsert = rows.filter(r => !existingMap.has(r.provider_service_id));
    const toUpdate = rows.filter(r => existingMap.has(r.provider_service_id));

    let total = 0;

    // INSERT new services in batches
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const { error } = await adminDb.from("services").insert(batch);
      if (error) {
        console.warn("[SMM] Insert batch error:", error.message);
      } else {
        total += batch.length;
      }
    }

    // UPDATE existing services one by one (safe, no constraint needed)
    let updateCount = 0;
    for (const row of toUpdate) {
      const existingId = existingMap.get(row.provider_service_id)!;
      const { error } = await adminDb
        .from("services")
        .update(row)
        .eq("id", existingId);
      if (!error) updateCount++;
    }
    total += updateCount;

    console.log(`[SMM] Sync summary — inserted: ${total - updateCount}, updated: ${updateCount}, total: ${total}`);

    // 5. Deactivate old Followiz services NOT in the filtered set
    try {
      const { data: existing } = await adminDb
        .from("services")
        .select("provider_service_id")
        .eq("provider", "followiz")
        .eq("status", "active");

      const toDeactivate = (existing || [])
        .map(r => r.provider_service_id)
        .filter(id => id && !keptIds.has(id));

      if (toDeactivate.length > 0) {
        const { error: deactErr } = await adminDb
          .from("services")
          .update({ status: "inactive" })
          .eq("provider", "followiz")
          .in("provider_service_id", toDeactivate);
        if (deactErr) {
          console.warn("[SMM] Deactivate error:", deactErr.message);
        } else {
          console.log(`[SMM] Deactivated ${toDeactivate.length} removed/low-quality services`);
        }
      }
    } catch (deactErr) {
      console.warn("[SMM] Could not deactivate old services:", deactErr);
    }

    lastDbSyncTime = Date.now();
    console.log(`[SMM] ✅ Auto-sync complete: ${total}/${filtered.length} services upserted`);
    return total;

  } catch (err) {
    console.error("[SMM] autoSyncServicesToDb error:", err);
    return 0;
  } finally {
    isDbSyncing = false;
  }
}

// Check if DB has followiz services
async function isDbEmpty(): Promise<boolean> {
  try {
    const { count, error } = await adminDb
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("provider", "followiz");
    if (error) return true; // treat error as "empty" to trigger sync
    return (count ?? 0) === 0;
  } catch {
    return true;
  }
}

// Ensure DB is fresh — call on every /services request
async function ensureServicesFresh() {
  const stale = !lastDbSyncTime || (Date.now() - lastDbSyncTime > DB_SYNC_INTERVAL_MS);
  if (!stale) return;

  const empty = await isDbEmpty();
  if (empty) {
    // DB is empty → must sync and await (user is waiting)
    console.log("[SMM] DB empty — awaiting initial sync...");
    await autoSyncServicesToDb();
  } else if (stale) {
    // Stale but has data → sync in background (return current data fast)
    console.log("[SMM] DB stale — triggering background sync");
    autoSyncServicesToDb(); // intentionally NOT awaited
  }
}

// ─── AUTH HELPER ──────────────────────────────────────────────────────────────
async function verifyToken(authHeader?: string): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  try {
    const { data, error } = await adminDb.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

// Build a Service array from raw Followiz data (fallback when DB migration not run)
// Applies the same filtering + ranking as the DB sync engine
function followizToServices(raw: FollowizService[]) {
  const filtered = filterAndRankServices(raw);
  return filtered.map(svc => {
    const svcType = detectServiceType(svc.name);
    return {
    id:                  svc.service,
    name:                svc.name,
    category:            svc.category,
    platform:            detectPlatform(svc.name, svc.category),
    service_type:        svcType,
    price:               calcPriceIQD(svc.rate, svcType),
    min_order:           Number(svc.min),
    max_order:           Number(svc.max),
    status:              "active",
    provider:            "followiz",
    provider_service_id: String(svc.service),
    platform_id:         null,
    description:         null,
    };
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/smm/services
// Returns from Supabase DB (auto-syncs from Followiz if empty or stale).
// Falls back to Followiz API directly if DB migration hasn't been run yet.
// ══════════════════════════════════════════════════════════════════════════════
router.get("/services", async (_req, res) => {
  console.log("[SMM] GET /services");
  try {
    // Ensure DB is up-to-date (may await if empty, or trigger background sync if stale)
    await ensureServicesFresh();

    const { data, error } = await adminDb
      .from("services")
      .select("id, name, category, platform, price, min_order, max_order, status, provider, provider_service_id, platform_id")
      .eq("status", "active")
      .order("platform")
      .order("id");

    if (error) {
      const isColumnMissing = error.message.includes("does not exist") || error.message.includes("column") || error.message.includes("schema");
      if (isColumnMissing) {
        // DB migration not run yet — serve directly from Followiz API
        console.warn("[SMM] DB columns missing — falling back to Followiz API directly");
        try {
          const raw = await fetch(`https://followiz.com/api/v2`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ key: FOLLOWIZ_KEY, action: "services" }).toString(),
          }).then(r => r.json()) as FollowizService[];

          const services = Array.isArray(raw) ? followizToServices(raw) : [];
          console.log(`[SMM] Followiz fallback: ${services.length} services`);
          res.json({ ok: true, data: services, total: services.length, source: "followiz-direct", migration_needed: true });
        } catch (fbErr) {
          console.error("[SMM] Followiz fallback failed:", fbErr);
          res.status(502).json({ ok: false, error: "تعذر تحميل الخدمات" });
        }
        return;
      }
      console.error("[SMM] /services DB error:", error.message);
      res.status(500).json({ ok: false, error: "خطأ في قاعدة البيانات" });
      return;
    }

    // If DB returned 0 (empty even after sync), also fallback to Followiz API
    if (!data || data.length === 0) {
      console.warn("[SMM] DB empty after sync — falling back to Followiz API");
      try {
        const raw = await fetch(`https://followiz.com/api/v2`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ key: FOLLOWIZ_KEY, action: "services" }).toString(),
        }).then(r => r.json()) as FollowizService[];

        const services = Array.isArray(raw) ? followizToServices(raw) : [];
        res.json({ ok: true, data: services, total: services.length, source: "followiz-direct" });
      } catch {
        res.json({ ok: true, data: [], total: 0, source: "empty" });
      }
      return;
    }

    console.log(`[SMM] /services → ${data.length} services from DB`);
    res.json({ ok: true, data, total: data.length, synced_at: lastDbSyncTime });
  } catch (err) {
    console.error("[SMM] /services error:", err);
    res.status(500).json({ ok: false, error: "خطأ داخلي" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/smm/platforms
// Returns distinct platforms with service counts from DB
// ══════════════════════════════════════════════════════════════════════════════
router.get("/platforms", async (_req, res) => {
  console.log("[SMM] GET /platforms");
  try {
    const { data, error } = await adminDb
      .from("services")
      .select("platform")
      .eq("provider", "followiz")
      .eq("status",   "active");

    if (error) {
      console.warn("[SMM] /platforms DB error (columns may not exist yet):", error.message);
      res.json({ ok: true, data: [], total: 0 });
      return;
    }

    const countMap: Record<string, number> = {};
    for (const row of data || []) {
      const p = row.platform || "Other";
      countMap[p] = (countMap[p] || 0) + 1;
    }

    const platforms = Object.entries(countMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    console.log(`[SMM] /platforms: ${platforms.length} platforms`);
    res.json({ ok: true, data: platforms, total: platforms.length });
  } catch (err) {
    console.error("[SMM] /platforms error:", err);
    res.status(500).json({ ok: false, error: "خطأ داخلي" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/smm/sync-services     (Admin only)
// Manual force-sync trigger from admin panel
// ══════════════════════════════════════════════════════════════════════════════
router.post("/sync-services", async (req, res) => {
  console.log("[SMM] POST /sync-services — manual trigger");

  const userId = await verifyToken(req.headers.authorization);
  if (!userId) { res.status(401).json({ ok: false, error: "يجب تسجيل الدخول" }); return; }

  const { data: profile } = await adminDb.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (profile?.role !== "admin") { res.status(403).json({ ok: false, error: "للمشرفين فقط" }); return; }

  // Force fresh fetch
  lastDbSyncTime = 0;
  const total = await autoSyncServicesToDb();

  res.json({
    ok: true,
    synced: total,
    message: `تم مزامنة ${total} خدمة بنجاح`,
    synced_at: lastDbSyncTime,
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/smm/order              (Authenticated)
// ══════════════════════════════════════════════════════════════════════════════
router.post("/order", async (req, res) => {
  console.log("[SMM] POST /order — body:", JSON.stringify(req.body));

  const userId = await verifyToken(req.headers.authorization);
  if (!userId) { res.status(401).json({ ok: false, error: "يجب تسجيل الدخول أولاً" }); return; }

  const { service_id, link, quantity } = req.body as {
    service_id: number | string;
    link: string;
    quantity: number | string;
  };

  if (!service_id || !link || !quantity) {
    res.status(400).json({ ok: false, error: "بيانات ناقصة: service_id, link, quantity مطلوبة" }); return;
  }

  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty <= 0) {
    res.status(400).json({ ok: false, error: "الكمية يجب أن تكون عدداً صحيحاً موجباً" }); return;
  }

  // 1. Load service — try DB by numeric id → provider_service_id → Followiz direct
  type SvcRow = { id: number | null; name: string; price: number; min_order: number; max_order: number; provider: string | null; provider_service_id: string | null };
  let svc: SvcRow | null = null;

  // 1a. Try DB by primary key
  {
    const { data } = await adminDb.from("services")
      .select("id, name, price, min_order, max_order, provider, provider_service_id")
      .eq("id", Number(service_id)).maybeSingle();
    if (data) svc = data as SvcRow;
  }

  // 1b. Not found by PK → try provider_service_id
  if (!svc) {
    const { data } = await adminDb.from("services")
      .select("id, name, price, min_order, max_order, provider, provider_service_id")
      .eq("provider_service_id", String(service_id)).maybeSingle();
    if (data) svc = data as SvcRow;
  }

  // 1c. Still not found → DB migration not run; fetch from Followiz API directly
  if (!svc) {
    console.log(`[SMM] Service ${service_id} not in DB — falling back to Followiz API...`);
    try {
      const all = await followizRequest({ action: "services" }) as FollowizService[];
      const raw = all.find(s => String(s.service) === String(service_id));
      if (raw) {
        const rawType = detectServiceType(raw.name);
        svc = {
          id:                  null,   // no DB row exists
          name:                raw.name,
          price:               calcPriceIQD(raw.rate, rawType),
          min_order:           Number(raw.min),
          max_order:           Number(raw.max),
          provider:            "followiz",
          provider_service_id: String(raw.service),
        };
        console.log(`[SMM] ✅ Followiz fallback: ${svc.name} | price=${svc.price}`);
      }
    } catch (e) {
      console.error("[SMM] Followiz fallback lookup failed:", e);
    }
  }

  if (!svc) {
    res.status(404).json({ ok: false, error: "الخدمة غير موجودة" }); return;
  }
  console.log(`[SMM] ✅ Service: ${svc.name} | price=${svc.price}/1000 | provider=${svc.provider}`);

  if (qty < svc.min_order) { res.status(400).json({ ok: false, error: `أقل كمية: ${svc.min_order.toLocaleString()}` }); return; }
  if (qty > svc.max_order) { res.status(400).json({ ok: false, error: `أقصى كمية: ${svc.max_order.toLocaleString()}` }); return; }

  // 2. Calculate total
  const totalPrice = Math.ceil((qty * Number(svc.price)) / 1000);
  console.log(`[SMM] Total price: ${qty} × IQD${svc.price}/1000 = IQD ${totalPrice}`);

  // 3. Deduct balance via RPC (with fallback)
  const { error: rpcErr } = await adminDb.rpc("decrement_balance", { uid: userId, amount: totalPrice });
  if (rpcErr) {
    console.warn("[SMM] RPC failed, using fallback:", rpcErr.message);
    const { data: prof } = await adminDb.from("profiles").select("balance").eq("id", userId).maybeSingle();
    const bal = Number(prof?.balance || 0);
    if (bal < totalPrice) {
      res.status(400).json({ ok: false, error: `رصيدك غير كافٍ. رصيدك: IQD ${bal.toLocaleString()}، المطلوب: IQD ${totalPrice.toLocaleString()}` }); return;
    }
    const { error: updErr } = await adminDb.from("profiles").update({ balance: bal - totalPrice }).eq("id", userId);
    if (updErr) { res.status(500).json({ ok: false, error: "فشل خصم الرصيد" }); return; }
  }
  console.log(`[SMM] ✅ Deducted IQD ${totalPrice}`);

  // Helper: refund balance (always works, no RPC dependency)
  const refundBalance = async () => {
    const { data: prof } = await adminDb.from("profiles").select("balance").eq("id", userId).maybeSingle();
    const newBal = Number(prof?.balance || 0) + totalPrice;
    await adminDb.from("profiles").update({ balance: newBal }).eq("id", userId);
    console.log(`[SMM] 🔄 Refunded IQD ${totalPrice} → new balance: ${newBal}`);
  };

  // 4. Place order with Followiz
  let providerOrderId: string | null = null;
  if (svc.provider === "followiz" && svc.provider_service_id) {
    console.log(`[SMM] → Sending to Followiz: service=${svc.provider_service_id}, qty=${qty}`);
    try {
      const result = await followizRequest({
        action: "add", service: String(svc.provider_service_id), link, quantity: String(qty),
      }) as Record<string, unknown>;

      if (result.order) {
        providerOrderId = String(result.order);
        console.log(`[SMM] ✅ Followiz accepted: order_id=${providerOrderId}`);
      } else {
        console.error("[SMM] ❌ Followiz rejected:", JSON.stringify(result));
        await refundBalance();
        res.status(400).json({ ok: false, error: String(result.error || "رفض المزود الطلب — تم استرداد رصيدك") }); return;
      }
    } catch (err) {
      console.error("[SMM] ❌ Followiz request failed:", err);
      await refundBalance();
      res.status(502).json({ ok: false, error: "تعذر الاتصال بمزود الخدمة — تم استرداد رصيدك" }); return;
    }
  }

  // 5. Save order to DB
  const { data: order, error: orderErr } = await adminDb.from("orders").insert({
    user_id:           userId,
    service_id:        svc.id,   // may be null when service came from Followiz direct
    link,
    quantity:          qty,
    total_price:       totalPrice,
    status:            "pending",
    provider_order_id: providerOrderId,
    provider_service_id: svc.provider_service_id || null,
  }).select().single();

  if (orderErr) {
    console.error("[SMM] Order DB save failed:", orderErr.message);
    // Still a success from the provider side — don't refund
    res.status(500).json({ ok: false, error: "الطلب أُرسل للمزود لكن فشل الحفظ في قاعدة البيانات" }); return;
  }

  console.log(`[SMM] ✅ Order saved: id=${order.id} | followiz=${providerOrderId} | total=IQD${totalPrice}`);
  res.status(201).json({
    ok:                true,
    order_id:          order.id,
    order,
    provider_order_id: providerOrderId,
    service:           { id: svc.id, name: svc.name, price: svc.price },
    total_price:       totalPrice,
    message:           providerOrderId
      ? `تم إرسال طلبك بنجاح! رقم الطلب: ${providerOrderId}`
      : `تم إنشاء طلبك بنجاح! رقم: ${order.id}`,
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/smm/orders  (Legacy endpoint — kept for backwards compat)
// ══════════════════════════════════════════════════════════════════════════════
router.post("/orders", async (req, res) => {
  const userId = await verifyToken(req.headers.authorization);
  if (!userId) { res.status(401).json({ ok: false, error: "يجب تسجيل الدخول أولاً" }); return; }
  const { provider_service_id, link, quantity, price_per_1000 } = req.body as Record<string, unknown>;
  if (!provider_service_id || !link || !quantity) { res.status(400).json({ ok: false, error: "بيانات ناقصة" }); return; }
  const qty = Number(quantity), pricePerK = Number(price_per_1000);
  const totalPrice = Math.ceil((qty * pricePerK) / 1000);
  const { data: prof } = await adminDb.from("profiles").select("balance").eq("id", userId).maybeSingle();
  const bal = Number(prof?.balance || 0);
  if (bal < totalPrice) { res.status(400).json({ ok: false, error: "رصيد غير كافٍ" }); return; }
  let result: Record<string, unknown>;
  try { result = await followizRequest({ action: "add", service: String(provider_service_id), link: String(link), quantity: String(qty) }) as Record<string, unknown>; }
  catch { res.status(502).json({ ok: false, error: "تعذر الاتصال بالمزود" }); return; }
  if (!result.order) { res.status(400).json({ ok: false, error: String(result.error || "رفض المزود الطلب") }); return; }
  const pid = String(result.order);
  const { error: rpcErr } = await adminDb.rpc("decrement_balance", { uid: userId, amount: totalPrice });
  if (rpcErr) await adminDb.from("profiles").update({ balance: bal - totalPrice }).eq("id", userId);
  const { data: order } = await adminDb.from("orders").insert({ user_id: userId, service_id: null, link, quantity: qty, total_price: totalPrice, status: "pending", provider_order_id: pid, provider_service_id: String(provider_service_id) }).select().single();
  res.status(201).json({ ok: true, order, followiz_order_id: pid });
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/smm/orders/:orderId/status
// ══════════════════════════════════════════════════════════════════════════════
router.get("/orders/:orderId/status", async (req, res) => {
  const userId = await verifyToken(req.headers.authorization);
  if (!userId) { res.status(401).json({ ok: false, error: "يجب تسجيل الدخول" }); return; }
  const { data: order } = await adminDb.from("orders").select("id, provider_order_id, status")
    .eq("id", req.params.orderId).eq("user_id", userId).maybeSingle();
  if (!order?.provider_order_id) { res.json({ ok: true, status: order?.status || "unknown" }); return; }
  const r = await followizRequest({ action: "status", order: order.provider_order_id }) as Record<string, string>;
  res.json({ ok: true, status: r.status, followiz: r });
});

// ══════════════════════════════════════════════════════════════════════════════
// ORDER STATUS POLLER — every 30 seconds
// ══════════════════════════════════════════════════════════════════════════════
const STATUS_MAP: Record<string, string> = {
  Pending:       "pending",
  Processing:    "processing",
  "In progress": "processing",
  Partial:       "processing",
  Completed:     "completed",
  Canceled:      "cancelled",
  Cancelled:     "cancelled",
  Failed:        "failed",
};

async function syncPendingOrders() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  try {
    const { data: orders, error } = await adminDb
      .from("orders").select("id, provider_order_id, status")
      .in("status", ["pending", "processing"]).not("provider_order_id", "is", null).limit(50);
    if (error || !orders?.length) return;
    console.log(`[SMM] 🔄 Checking ${orders.length} pending orders...`);
    for (let i = 0; i < orders.length; i += 10) {
      await Promise.all(orders.slice(i, i + 10).map(async o => {
        try {
          const r = await followizRequest({ action: "status", order: o.provider_order_id! }) as Record<string, string>;
          const ns = STATUS_MAP[r.status];
          if (ns && ns !== o.status) {
            await adminDb.from("orders").update({ status: ns }).eq("id", o.id);
            console.log(`[SMM] Order ${o.id}: ${o.status} → ${ns}`);
          }
        } catch (err) { console.warn(`[SMM] Status check failed #${o.id}:`, err); }
      }));
    }
  } catch (err) { console.error("[SMM] syncPendingOrders error:", err); }
}

let orderPollInterval:   ReturnType<typeof setInterval> | null = null;
let serviceSyncInterval: ReturnType<typeof setInterval> | null = null;

export function startSmmPoller() {
  if (orderPollInterval) return; // already started

  // ── Order status polling every 30s ──────────────────────────────────────
  console.log("[SMM] 🔄 Starting order-status polling (30s)...");
  orderPollInterval = setInterval(syncPendingOrders, 30_000);
  setTimeout(syncPendingOrders, 5_000);

  // ── Service auto-sync every 10 min ──────────────────────────────────────
  console.log("[SMM] 🔄 Starting service auto-sync (10 min)...");
  serviceSyncInterval = setInterval(autoSyncServicesToDb, DB_SYNC_INTERVAL_MS);

  // ── Initial sync on startup (after 3s to let DB connections warm up) ────
  setTimeout(async () => {
    console.log("[SMM] 🚀 Server startup — checking if services DB is empty...");
    const empty = await isDbEmpty();
    if (empty) {
      console.log("[SMM] 🚀 DB is empty — syncing services now...");
      await autoSyncServicesToDb();
    } else {
      console.log("[SMM] 🚀 DB already has services — skipping initial sync");
      lastDbSyncTime = Date.now(); // assume recent enough
    }
  }, 3_000);
}

export function stopSmmPoller() {
  if (orderPollInterval)   { clearInterval(orderPollInterval);   orderPollInterval   = null; }
  if (serviceSyncInterval) { clearInterval(serviceSyncInterval); serviceSyncInterval = null; }
  console.log("[SMM] ⏹️  Stopped all pollers");
}

export default router;
