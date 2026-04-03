// ─── Frontend Followiz API client ─────────────────────────────────────────────
// All calls go to OUR backend — the API key is NEVER exposed here

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") + "/api/smm";

export type FollowizService = {
  service: number;
  name: string;
  type: string;
  category: string;
  rate: string;
  min: string;
  max: string;
  refill?: boolean;
  cancel?: boolean;
};

// Fetch Followiz services via our backend (cached 5 min server-side)
export async function getFollowizServices(): Promise<FollowizService[]> {
  const res = await fetch(`${BASE}/services`);
  if (!res.ok) throw new Error("تعذر تحميل الخدمات");
  const json = await res.json() as { ok: boolean; data: FollowizService[]; error?: string };
  if (!json.ok) throw new Error(json.error || "خطأ في تحميل الخدمات");
  return json.data;
}

// Place an order via our backend (requires auth token)
export async function createFollowizOrder(params: {
  provider_service_id: number;
  link: string;
  quantity: number;
  price_per_1000: number;
  token: string;
}): Promise<{ ok: boolean; order: unknown; followiz_order_id: string }> {
  const res = await fetch(`${BASE}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.token}`,
    },
    body: JSON.stringify({
      provider_service_id: params.provider_service_id,
      link: params.link,
      quantity: params.quantity,
      price_per_1000: params.price_per_1000,
    }),
  });
  const json = await res.json() as { ok: boolean; order: unknown; followiz_order_id: string; error?: string };
  if (!res.ok || !json.ok) throw new Error(json.error || "فشل إنشاء الطلب");
  return json;
}
