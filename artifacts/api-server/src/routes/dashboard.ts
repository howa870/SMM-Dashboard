import { Router } from "express";
import { db, ordersTable, usersTable, servicesTable, platformsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router = Router();

router.get("/stats", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    const orders = await db.select().from(ordersTable).where(eq(ordersTable.userId, req.userId!));

    const totalOrders = orders.length;
    const pendingOrders = orders.filter(o => o.status === "pending").length;
    const processingOrders = orders.filter(o => o.status === "processing").length;
    const completedOrders = orders.filter(o => o.status === "completed").length;
    const cancelledOrders = orders.filter(o => o.status === "cancelled" || o.status === "failed").length;
    const totalSpent = orders.reduce((sum, o) => sum + parseFloat(o.totalPrice), 0);

    const recentOrdersRaw = await db.select().from(ordersTable)
      .where(eq(ordersTable.userId, req.userId!))
      .orderBy(desc(ordersTable.createdAt))
      .limit(5);

    const recentOrders = await Promise.all(recentOrdersRaw.map(async o => {
      const results = await db.select({ service: servicesTable, platform: platformsTable })
        .from(servicesTable)
        .innerJoin(platformsTable, eq(servicesTable.platformId, platformsTable.id))
        .where(eq(servicesTable.id, o.serviceId))
        .limit(1);
      const r = results[0];
      return {
        id: o.id,
        userId: o.userId,
        userName: user?.name || "مجهول",
        serviceId: o.serviceId,
        serviceName: r?.service.name || "خدمة محذوفة",
        platformName: r?.platform.name || "منصة محذوفة",
        link: o.link,
        quantity: o.quantity,
        totalPrice: parseFloat(o.totalPrice),
        status: o.status,
        createdAt: o.createdAt
      };
    }));

    res.json({
      balance: parseFloat(user.balance),
      totalOrders,
      pendingOrders,
      processingOrders,
      completedOrders,
      cancelledOrders,
      totalSpent,
      recentOrders
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

export default router;
