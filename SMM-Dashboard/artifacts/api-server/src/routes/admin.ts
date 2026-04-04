import { Router } from "express";
import { db, usersTable, ordersTable, paymentsTable, servicesTable, platformsTable } from "@workspace/db";
import { eq, desc, count, sum, sql } from "drizzle-orm";
import { AdminUpdateUserBalanceBody, AdminUpdateUserBalanceParams, AdminUpdateOrderStatusBody, AdminUpdateOrderStatusParams, AdminApprovePaymentParams, AdminRejectPaymentParams } from "@workspace/api-zod";
import { requireAdmin, type AuthRequest } from "../middlewares/auth";

const router = Router();

async function formatOrderFull(o: typeof ordersTable.$inferSelect) {
  const results = await db.select({ service: servicesTable, platform: platformsTable, user: usersTable })
    .from(servicesTable)
    .innerJoin(platformsTable, eq(servicesTable.platformId, platformsTable.id))
    .innerJoin(usersTable, eq(usersTable.id, o.userId))
    .where(eq(servicesTable.id, o.serviceId))
    .limit(1);
  const r = results[0];
  return {
    id: o.id,
    userId: o.userId,
    userName: r?.user.name || "مجهول",
    serviceId: o.serviceId,
    serviceName: r?.service.name || "خدمة محذوفة",
    platformName: r?.platform.name || "منصة محذوفة",
    link: o.link,
    quantity: o.quantity,
    totalPrice: parseFloat(o.totalPrice),
    status: o.status,
    createdAt: o.createdAt
  };
}

async function formatPaymentFull(p: typeof paymentsTable.$inferSelect) {
  const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, p.userId)).limit(1);
  return {
    id: p.id,
    userId: p.userId,
    userName: user?.name || "مجهول",
    amount: parseFloat(p.amount),
    method: p.method,
    status: p.status,
    transactionId: p.transactionId || undefined,
    receiptUrl: p.receiptUrl || undefined,
    notes: p.notes || undefined,
    createdAt: p.createdAt
  };
}

// Get all users
router.get("/users", requireAdmin, async (req, res) => {
  try {
    const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
    res.json(users.map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      balance: parseFloat(u.balance),
      role: u.role,
      createdAt: u.createdAt
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// Update user balance
router.put("/users/:id/balance", requireAdmin, async (req, res) => {
  const paramParsed = AdminUpdateUserBalanceParams.safeParse({ id: parseInt(req.params.id) });
  const bodyParsed = AdminUpdateUserBalanceBody.safeParse(req.body);
  if (!paramParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "بيانات غير صالحة" });
    return;
  }
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, paramParsed.data.id)).limit(1);
    if (!user) {
      res.status(404).json({ error: "المستخدم غير موجود" });
      return;
    }
    let newBalance: number;
    const currentBalance = parseFloat(user.balance);
    const amount = bodyParsed.data.balance;
    if (bodyParsed.data.operation === "set") {
      newBalance = amount;
    } else if (bodyParsed.data.operation === "add") {
      newBalance = currentBalance + amount;
    } else {
      newBalance = Math.max(0, currentBalance - amount);
    }
    const [updated] = await db.update(usersTable).set({ balance: String(newBalance) }).where(eq(usersTable.id, paramParsed.data.id)).returning();
    res.json({ id: updated.id, email: updated.email, name: updated.name, balance: parseFloat(updated.balance), role: updated.role, createdAt: updated.createdAt });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// Get all orders
router.get("/orders", requireAdmin, async (req, res) => {
  try {
    const orders = await db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt));
    const formatted = await Promise.all(orders.map(formatOrderFull));
    res.json(formatted);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// Update order status
router.put("/orders/:id/status", requireAdmin, async (req, res) => {
  const paramParsed = AdminUpdateOrderStatusParams.safeParse({ id: parseInt(req.params.id) });
  const bodyParsed = AdminUpdateOrderStatusBody.safeParse(req.body);
  if (!paramParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "بيانات غير صالحة" });
    return;
  }
  try {
    const [order] = await db.update(ordersTable).set({ status: bodyParsed.data.status }).where(eq(ordersTable.id, paramParsed.data.id)).returning();
    if (!order) {
      res.status(404).json({ error: "الطلب غير موجود" });
      return;
    }
    const formatted = await formatOrderFull(order);
    res.json(formatted);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// Get all payments
router.get("/payments", requireAdmin, async (req, res) => {
  try {
    const payments = await db.select().from(paymentsTable).orderBy(desc(paymentsTable.createdAt));
    const formatted = await Promise.all(payments.map(formatPaymentFull));
    res.json(formatted);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// Approve payment - credit user balance
router.put("/payments/:id/approve", requireAdmin, async (req, res) => {
  const parsed = AdminApprovePaymentParams.safeParse({ id: parseInt(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "معرف غير صالح" });
    return;
  }
  try {
    const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, parsed.data.id)).limit(1);
    if (!payment) {
      res.status(404).json({ error: "الدفعة غير موجودة" });
      return;
    }
    if (payment.status !== "pending") {
      res.status(400).json({ error: "هذه الدفعة تمت معالجتها مسبقاً" });
      return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payment.userId)).limit(1);
    const newBalance = parseFloat(user.balance) + parseFloat(payment.amount);
    await db.update(usersTable).set({ balance: String(newBalance) }).where(eq(usersTable.id, payment.userId));
    const [updated] = await db.update(paymentsTable).set({ status: "approved" }).where(eq(paymentsTable.id, parsed.data.id)).returning();
    const formatted = await formatPaymentFull(updated);
    res.json(formatted);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// Reject payment
router.put("/payments/:id/reject", requireAdmin, async (req, res) => {
  const parsed = AdminRejectPaymentParams.safeParse({ id: parseInt(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "معرف غير صالح" });
    return;
  }
  try {
    const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, parsed.data.id)).limit(1);
    if (!payment) {
      res.status(404).json({ error: "الدفعة غير موجودة" });
      return;
    }
    if (payment.status !== "pending") {
      res.status(400).json({ error: "هذه الدفعة تمت معالجتها مسبقاً" });
      return;
    }
    const [updated] = await db.update(paymentsTable).set({ status: "rejected" }).where(eq(paymentsTable.id, parsed.data.id)).returning();
    const formatted = await formatPaymentFull(updated);
    res.json(formatted);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// Admin stats
router.get("/stats", requireAdmin, async (req, res) => {
  try {
    const [userCount] = await db.select({ count: count() }).from(usersTable);
    const [orderCount] = await db.select({ count: count() }).from(ordersTable);
    const [revenueResult] = await db.select({ total: sum(paymentsTable.amount) }).from(paymentsTable).where(eq(paymentsTable.status, "approved"));
    const [pendingPaymentsCount] = await db.select({ count: count() }).from(paymentsTable).where(eq(paymentsTable.status, "pending"));
    const [activeServices] = await db.select({ count: count() }).from(servicesTable).where(eq(servicesTable.status, "active"));
    const [activePlatforms] = await db.select({ count: count() }).from(platformsTable).where(eq(platformsTable.status, "active"));

    const recentOrdersRaw = await db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt)).limit(5);
    const recentOrders = await Promise.all(recentOrdersRaw.map(formatOrderFull));

    const recentPaymentsRaw = await db.select().from(paymentsTable).orderBy(desc(paymentsTable.createdAt)).limit(5);
    const recentPayments = await Promise.all(recentPaymentsRaw.map(formatPaymentFull));

    res.json({
      totalUsers: userCount.count,
      totalOrders: orderCount.count,
      totalRevenue: parseFloat(revenueResult.total || "0"),
      pendingPayments: pendingPaymentsCount.count,
      activeServices: activeServices.count,
      activePlatforms: activePlatforms.count,
      recentOrders,
      recentPayments
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

export default router;
