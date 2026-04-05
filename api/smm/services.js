import { setCors, sbSelect, followizCall, FOLLOWIZ_KEY, SERVICE_KEY } from "../_utils.js";

const PLATFORM_MAP = [
  { kw: ["instagram"],             platform: "Instagram"   },
  { kw: ["tiktok", "tik tok"],    platform: "TikTok"      },
  { kw: ["telegram"],              platform: "Telegram"    },
  { kw: ["youtube", "yt "],       platform: "YouTube"     },
  { kw: ["facebook", "fb "],      platform: "Facebook"    },
  { kw: ["twitter", " x "],       platform: "Twitter"     },
  { kw: ["snapchat"],              platform: "Snapchat"    },
  { kw: ["twitch"],                platform: "Twitch"      },
  { kw: ["spotify"],               platform: "Spotify"     },
  { kw: ["soundcloud"],            platform: "SoundCloud"  },
  { kw: ["linkedin"],              platform: "LinkedIn"    },
  { kw: ["pinterest"],             platform: "Pinterest"   },
  { kw: ["discord"],               platform: "Discord"     },
  { kw: ["threads"],               platform: "Threads"     },
];

function detectPlatform(name = "", category = "") {
  const h = (name + " " + category).toLowerCase();
  for (const { kw, platform } of PLATFORM_MAP) {
    if (kw.some(k => h.includes(k))) return platform;
  }
  return "Other";
}

function normalizeService(s) {
  const price = parseFloat(s.price ?? s.rate ?? 0) || 0;
  const platform = s.platform || detectPlatform(s.name || "", s.category || "");
  return {
    id:                  s.id ?? s.service,
    provider_service_id: String(s.provider_service_id ?? s.service ?? s.id ?? ""),
    name:                s.name || "خدمة غير معروفة",
    category:            s.category || platform,
    platform,
    service_type:        s.service_type || null,
    price,
    min_order:           Number(s.min_order ?? s.min ?? 100),
    max_order:           Number(s.max_order ?? s.max ?? 100000),
    status:              s.status || "active",
    provider:            s.provider || "followiz",
    refill:              s.refill ?? false,
    cancel:              s.cancel ?? false,
    description:         s.description || null,
  };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    // ── 1. Try Supabase DB (has our custom prices) ────────────────────────────
    if (SERVICE_KEY) {
      try {
        const raw = await sbSelect("services", "status=eq.active&order=id&limit=2000");
        if (Array.isArray(raw) && raw.length > 0) {
          const services = raw.map(normalizeService);
          console.log(`[smm/services] Supabase: ${services.length} services`);
          return res.json({ ok: true, success: true, data: services, services, count: services.length, source: "supabase" });
        }
      } catch (dbErr) {
        console.warn("[smm/services] Supabase fallback:", dbErr.message);
      }
    }

    // ── 2. Fallback: Followiz direct ──────────────────────────────────────────
    if (!FOLLOWIZ_KEY) {
      return res.status(503).json({ ok: false, error: "لم يتم إعداد مفتاح API بعد" });
    }
    const raw = await followizCall({ action: "services" });
    const list = Array.isArray(raw) ? raw : (raw?.data ?? raw?.services ?? []);
    const services = list.map(normalizeService);
    console.log(`[smm/services] Followiz: ${services.length} services`);
    return res.json({ ok: true, success: true, data: services, services, count: services.length, source: "followiz" });

  } catch (err) {
    console.error("[smm/services]", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
}
