import { supabase } from "./supabase";

export type Platform = {
  id: number;
  name: string;
  icon: string | null;
  color: string | null;
};

export type Service = {
  id: number;
  platform_id: number;
  name: string;
  description: string | null;
  price: number;
  min_order: number;
  max_order: number;
  status: string;
  platforms?: { name: string };
};

export type SupabaseOrder = {
  id: number;
  user_id: string;
  service_id: number;
  link: string;
  quantity: number;
  total_price: number;
  status: string;
  created_at: string;
  services?: { name: string };
};

export type Profile = {
  id: string;
  name: string | null;
  email: string | null;
  balance: number;
  role: string;
};

export type Payment = {
  id: string;
  user_id: string;
  amount: number;
  method: "zaincash" | "qicard" | "manual";
  transaction_id: string | null;
  proof_url: string | null;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  profiles?: { name: string | null; email: string | null };
};

export type Notification = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

// Convert any Supabase error into a proper JS Error with message
function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  if (err && typeof err === "object" && "message" in err) {
    const e = new Error(String((err as { message: unknown }).message));
    e.name = "SupabaseError";
    return e;
  }
  return new Error(String(err));
}

// ─── PLATFORMS ────────────────────────────────────────────────

export async function getPlatforms(): Promise<Platform[]> {
  const { data, error } = await supabase
    .from("platforms")
    .select("id, name, icon, color")
    .order("id");
  if (error) {
    console.error("[DB] getPlatforms:", error.message, error.code);
    throw toError(error);
  }
  return data as Platform[];
}

// ─── SERVICES ─────────────────────────────────────────────────

export async function getServices(platformId?: number): Promise<Service[]> {
  let query = supabase
    .from("services")
    .select("*, platforms(name)")
    .eq("status", "active");
  if (platformId) query = query.eq("platform_id", platformId);
  const { data, error } = await query.order("id");
  if (error) {
    console.error("[DB] getServices:", error.message, error.code);
    throw toError(error);
  }
  return data as Service[];
}

// ─── PROFILES ─────────────────────────────────────────────────

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.error("[DB] getProfile:", error.message, error.code);
    throw toError(error);
  }
  return data as Profile | null;
}

export async function upsertProfile(profile: Partial<Profile> & { id: string }): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .upsert(profile, { onConflict: "id" });
  if (error) {
    console.error("[DB] upsertProfile:", error.message, error.code);
    throw toError(error);
  }
}

export async function getAdminStats(): Promise<{
  totalUsers: number;
  totalOrders: number;
  totalRevenue: number;
  pendingPayments: number;
  approvedPayments: number;
}> {
  const [profiles, orders, payments] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("id,total_price"),
    supabase.from("payments").select("id,amount,status"),
  ]);
  // Log errors but don't throw — dashboard should show partial data
  if (profiles.error) console.warn("[DB] getAdminStats profiles:", profiles.error.message);
  if (orders.error) console.warn("[DB] getAdminStats orders:", orders.error.message);
  if (payments.error) console.warn("[DB] getAdminStats payments:", payments.error.message);

  const totalUsers = profiles.count || 0;
  const totalOrders = orders.data?.length || 0;
  const totalRevenue = (payments.data || [])
    .filter(p => p.status === "approved")
    .reduce((acc, p) => acc + Number(p.amount), 0);
  const pendingPayments = (payments.data || []).filter(p => p.status === "pending").length;
  const approvedPayments = (payments.data || []).filter(p => p.status === "approved").length;
  return { totalUsers, totalOrders, totalRevenue, pendingPayments, approvedPayments };
}

export async function getDailyPaymentStats(): Promise<{ date: string; amount: number; count: number }[]> {
  const { data, error } = await supabase
    .from("payments")
    .select("amount, created_at")
    .eq("status", "approved")
    .order("created_at", { ascending: true });
  if (error) {
    console.warn("[DB] getDailyPaymentStats:", error.message);
    return [];
  }
  const byDay: Record<string, { amount: number; count: number }> = {};
  (data || []).forEach(p => {
    const day = p.created_at.slice(0, 10);
    if (!byDay[day]) byDay[day] = { amount: 0, count: 0 };
    byDay[day].amount += Number(p.amount);
    byDay[day].count += 1;
  });
  return Object.entries(byDay).map(([date, v]) => ({ date, ...v }));
}

// ─── ORDERS ───────────────────────────────────────────────────

export async function getUserOrders(userId: string): Promise<SupabaseOrder[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*, services(name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[DB] getUserOrders:", error.message, error.code);
    throw toError(error);
  }
  return data as SupabaseOrder[];
}

export async function submitOrder(params: {
  user_id: string;
  service_id: number;
  link: string;
  quantity: number;
  total_price: number;
}): Promise<SupabaseOrder> {
  const { data, error } = await supabase
    .from("orders")
    .insert({ ...params, status: "pending" })
    .select()
    .single();
  if (error) {
    console.error("[DB] submitOrder:", error.message, error.code);
    throw toError(error);
  }
  return data as SupabaseOrder;
}

export async function deductBalance(userId: string, newBalance: number): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ balance: newBalance })
    .eq("id", userId);
  if (error) {
    console.error("[DB] deductBalance:", error.message);
    throw toError(error);
  }
}

// ─── PAYMENTS ─────────────────────────────────────────────────

export async function getUserPayments(userId: string): Promise<Payment[]> {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[DB] getUserPayments:", error.message, error.code);
    throw toError(error);
  }
  return data as Payment[];
}

export async function createPayment(params: {
  user_id: string;
  amount: number;
  method: Payment["method"];
  transaction_id?: string;
  proof_url?: string;
  notes?: string;
}): Promise<Payment> {
  console.log("[DB] createPayment →", params);
  const { data, error } = await supabase
    .from("payments")
    .insert({ ...params, status: "pending" })
    .select()
    .single();
  if (error) {
    console.error("[DB] createPayment failed:", error.message, error.code, error.details);
    throw toError(error);
  }
  console.log("[DB] createPayment ✅ →", data);
  return data as Payment;
}

export async function getAllPayments(): Promise<Payment[]> {
  const { data, error } = await supabase
    .from("payments")
    .select("*, profiles(name, email)")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[DB] getAllPayments:", error.message, error.code);
    throw toError(error);
  }
  return data as Payment[];
}

export async function approvePayment(paymentId: string, userId: string, amount: number): Promise<void> {
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("balance")
    .eq("id", userId)
    .single();
  if (profileError) throw toError(profileError);

  const newBalance = Number(profileData.balance) + Number(amount);

  const { error: balanceError } = await supabase
    .from("profiles")
    .update({ balance: newBalance })
    .eq("id", userId);
  if (balanceError) throw toError(balanceError);

  const { error: paymentError } = await supabase
    .from("payments")
    .update({ status: "approved" })
    .eq("id", paymentId);
  if (paymentError) throw toError(paymentError);

  await createNotification({
    user_id: userId,
    title: "✅ تم شحن رصيدك",
    message: `تم إضافة ${Number(amount).toLocaleString()} IQD إلى حسابك بنجاح.`,
  });
}

export async function rejectPayment(paymentId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("payments")
    .update({ status: "rejected" })
    .eq("id", paymentId);
  if (error) throw toError(error);

  await createNotification({
    user_id: userId,
    title: "❌ تم رفض طلب الشحن",
    message: "تم رفض طلب شحن الرصيد. يرجى التواصل مع الدعم.",
  });
}

// ─── PROOF IMAGE UPLOAD ────────────────────────────────────────

export async function uploadProofImage(file: File, userId: string): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const fileName = `${userId}/${Date.now()}.${ext}`;
  console.log("[DB] uploadProofImage →", fileName, "size:", file.size);
  const { data, error } = await supabase.storage
    .from("payment_proofs")
    .upload(fileName, file, { cacheControl: "3600", upsert: false });
  if (error) {
    console.error("[DB] uploadProofImage failed:", error.message);
    throw new Error(`رفع الصورة فشل: ${error.message}`);
  }
  const { data: urlData } = supabase.storage.from("payment_proofs").getPublicUrl(data.path);
  console.log("[DB] uploadProofImage ✅ →", urlData.publicUrl);
  return urlData.publicUrl;
}

// ─── NOTIFICATIONS ────────────────────────────────────────────

export async function createNotification(params: {
  user_id: string;
  title: string;
  message: string;
}): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .insert({ ...params, is_read: false });
  if (error) console.warn("[DB] createNotification failed:", error.message);
}

export async function getUserNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) {
    console.error("[DB] getUserNotifications:", error.message, error.code);
    throw toError(error);
  }
  return data as Notification[];
}

export async function markNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  if (error) throw toError(error);
}
