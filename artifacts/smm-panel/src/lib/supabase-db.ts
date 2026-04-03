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
  id: number;
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

// ─── PLATFORMS ────────────────────────────────────────────────

export async function getPlatforms(): Promise<Platform[]> {
  const { data, error } = await supabase
    .from("platforms")
    .select("id, name, icon, color")
    .eq("status", "active")
    .order("id");
  if (error) throw error;
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
  if (error) throw error;
  return data as Service[];
}

// ─── PROFILES ─────────────────────────────────────────────────

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function upsertProfile(profile: Partial<Profile> & { id: string }): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .upsert(profile, { onConflict: "id" });
  if (error) throw error;
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
  if (error) throw error;

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
  if (error) throw error;
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
  if (error) throw error;
  return data as SupabaseOrder;
}

export async function deductBalance(userId: string, newBalance: number): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ balance: newBalance })
    .eq("id", userId);
  if (error) throw error;
}

// ─── PAYMENTS ─────────────────────────────────────────────────

export async function getUserPayments(userId: string): Promise<Payment[]> {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
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
  const { data, error } = await supabase
    .from("payments")
    .insert({ ...params, status: "pending" })
    .select()
    .single();
  if (error) throw error;
  return data as Payment;
}

export async function getAllPayments(): Promise<Payment[]> {
  const { data, error } = await supabase
    .from("payments")
    .select("*, profiles(name, email)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Payment[];
}

export async function approvePayment(paymentId: number, userId: string, amount: number): Promise<void> {
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("balance")
    .eq("id", userId)
    .single();
  if (profileError) throw profileError;

  const newBalance = Number(profileData.balance) + Number(amount);

  const { error: balanceError } = await supabase
    .from("profiles")
    .update({ balance: newBalance })
    .eq("id", userId);
  if (balanceError) throw balanceError;

  const { error: paymentError } = await supabase
    .from("payments")
    .update({ status: "approved" })
    .eq("id", paymentId);
  if (paymentError) throw paymentError;

  await createNotification({
    user_id: userId,
    title: "✅ تم شحن رصيدك",
    message: `تم إضافة ${Number(amount).toLocaleString()} IQD إلى حسابك بنجاح.`,
  });
}

export async function rejectPayment(paymentId: number, userId: string): Promise<void> {
  const { error } = await supabase
    .from("payments")
    .update({ status: "rejected" })
    .eq("id", paymentId);
  if (error) throw error;

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
  const { data, error } = await supabase.storage
    .from("payment_proofs")
    .upload(fileName, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from("payment_proofs").getPublicUrl(data.path);
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
  if (error) console.warn("Notification insert failed:", error.message);
}

export async function getUserNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data as Notification[];
}

export async function markNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  if (error) throw error;
}
