import { Router } from "express";
import { db, ordersTable, servicesTable, platformsTable, usersTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { CreateOrderBody, GetOrderParams } from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router = Router();

async function formatOrder(o: typeof ordersTable.$inferSelect) {
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

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const orders = await db.select().from(ordersTable)
      .where(eq(ordersTable.userId, req.userId!))
      .orderBy(desc(ordersTable.createdAt));
    const formatted = await Promise.all(orders.map(formatOrder));
    res.json(formatted);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صالحة" });
    return;
  }
  const { serviceId, link, quantity } = parsed.data;
  try {
    const [service] = await db.select().from(servicesTable).where(eq(servicesTable.id, serviceId)).limit(1);
    if (!service || service.status !== "active") {
      res.status(404).json({ error: "الخدمة غير متاحة" });
      return;
    }
    if (quantity < service.minOrder || quantity > service.maxOrder) {
      res.status(400).json({ error: `الكمية يجب أن تكون بين ${service.minOrder} و ${service.maxOrder}` });
      return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    const totalPrice = (parseFloat(service.price) * quantity) / 1000;
    const userBalance = parseFloat(user.balance);
    if (userBalance < totalPrice) {
      res.status(400).json({ error: "رصيدك غير كافٍ، يرجى شحن حسابك" });
      return;
    }
    const newBalance = userBalance - totalPrice;
    await db.update(usersTable).set({ balance: String(newBalance) }).where(eq(usersTable.id, req.userId!));
    const [order] = await db.insert(ordersTable).values({
      userId: req.userId!,
      serviceId,
      link,
      quantity,
      totalPrice: String(totalPrice),
      status: "pending"
    }).returning();
    const formatted = await formatOrder(order);
    res.status(201).json(formatted);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.get("/:id", requireAuth, async (req: AuthRequest, res) => {
  const parsed = GetOrderParams.safeParse({ id: parseInt(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "معرف غير صالح" });
    return;
  }
  try {
    const [order] = await db.select().from(ordersTable)
      .where(and(eq(ordersTable.id, parsed.data.id), eq(ordersTable.userId, req.userId!)))
      .limit(1);
    if (!order) {
      res.status(404).json({ error: "الطلب غير موجود" });
      return;
    }
    const formatted = await formatOrder(order);
    res.json(formatted);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

export default router;
