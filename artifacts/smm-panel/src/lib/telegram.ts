const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/api";

export async function notifyTelegramPayment(payment: {
  id: number;
  email: string;
  amount: number;
  method: string;
  transaction_id?: string | null;
  proof_url?: string | null;
  notes?: string | null;
}): Promise<void> {
  try {
    await fetch(`${API_BASE}/telegram/payment-notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payment),
    });
  } catch {
    // Silently fail if Telegram not configured
  }
}

export async function notifyTelegramApproved(email: string, amount: number): Promise<void> {
  try {
    await fetch(`${API_BASE}/telegram/payment-approved`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, amount }),
    });
  } catch {}
}

export async function notifyTelegramRejected(email: string, amount: number): Promise<void> {
  try {
    await fetch(`${API_BASE}/telegram/payment-rejected`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, amount }),
    });
  } catch {}
}
