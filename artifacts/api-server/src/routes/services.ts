import { Router } from "express";
import { db, servicesTable, platformsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { CreateServiceBody, GetServicesQueryParams, GetServiceParams, UpdateServiceBody, UpdateServiceParams, DeleteServiceParams } from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/auth";

const router = Router();

function formatService(s: typeof servicesTable.$inferSelect, platformName: string) {
  return {
    id: s.id,
    platformId: s.platformId,
    platformName,
    name: s.name,
    description: s.description,
    price: parseFloat(s.price),
    minOrder: s.minOrder,
    maxOrder: s.maxOrder,
    status: s.status,
    createdAt: s.createdAt
  };
}

router.get("/", async (req, res) => {
  const parsed = GetServicesQueryParams.safeParse(req.query);
  try {
    let query = db.select({ service: servicesTable, platform: platformsTable })
      .from(servicesTable)
      .innerJoin(platformsTable, eq(servicesTable.platformId, platformsTable.id));
    const results = await query;
    let filtered = results;
    if (parsed.success && parsed.data.platformId) {
      filtered = results.filter(r => r.service.platformId === parsed.data.platformId);
    }
    res.json(filtered.map(r => formatService(r.service, r.platform.name)));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  const parsed = CreateServiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صالحة" });
    return;
  }
  try {
    const [platform] = await db.select().from(platformsTable).where(eq(platformsTable.id, parsed.data.platformId)).limit(1);
    if (!platform) {
      res.status(404).json({ error: "المنصة غير موجودة" });
      return;
    }
    const [service] = await db.insert(servicesTable).values({
      platformId: parsed.data.platformId,
      name: parsed.data.name,
      description: parsed.data.description,
      price: String(parsed.data.price),
      minOrder: parsed.data.minOrder,
      maxOrder: parsed.data.maxOrder,
      status: parsed.data.status,
    }).returning();
    // Update services count
    await db.execute(sql`UPDATE platforms SET services_count = (SELECT COUNT(*) FROM services WHERE platform_id = ${parsed.data.platformId}) WHERE id = ${parsed.data.platformId}`);
    res.status(201).json(formatService(service, platform.name));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.get("/:id", async (req, res) => {
  const parsed = GetServiceParams.safeParse({ id: parseInt(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "معرف غير صالح" });
    return;
  }
  try {
    const results = await db.select({ service: servicesTable, platform: platformsTable })
      .from(servicesTable)
      .innerJoin(platformsTable, eq(servicesTable.platformId, platformsTable.id))
      .where(eq(servicesTable.id, parsed.data.id))
      .limit(1);
    if (results.length === 0) {
      res.status(404).json({ error: "الخدمة غير موجودة" });
      return;
    }
    res.json(formatService(results[0].service, results[0].platform.name));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.put("/:id", requireAdmin, async (req, res) => {
  const paramParsed = UpdateServiceParams.safeParse({ id: parseInt(req.params.id) });
  const bodyParsed = UpdateServiceBody.safeParse(req.body);
  if (!paramParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "بيانات غير صالحة" });
    return;
  }
  try {
    const [platform] = await db.select().from(platformsTable).where(eq(platformsTable.id, bodyParsed.data.platformId)).limit(1);
    if (!platform) {
      res.status(404).json({ error: "المنصة غير موجودة" });
      return;
    }
    const [service] = await db.update(servicesTable).set({
      platformId: bodyParsed.data.platformId,
      name: bodyParsed.data.name,
      description: bodyParsed.data.description,
      price: String(bodyParsed.data.price),
      minOrder: bodyParsed.data.minOrder,
      maxOrder: bodyParsed.data.maxOrder,
      status: bodyParsed.data.status,
    }).where(eq(servicesTable.id, paramParsed.data.id)).returning();
    if (!service) {
      res.status(404).json({ error: "الخدمة غير موجودة" });
      return;
    }
    res.json(formatService(service, platform.name));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const parsed = DeleteServiceParams.safeParse({ id: parseInt(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "معرف غير صالح" });
    return;
  }
  try {
    const [existing] = await db.select().from(servicesTable).where(eq(servicesTable.id, parsed.data.id)).limit(1);
    if (!existing) {
      res.status(404).json({ error: "الخدمة غير موجودة" });
      return;
    }
    const platformId = existing.platformId;
    await db.delete(servicesTable).where(eq(servicesTable.id, parsed.data.id));
    await db.execute(sql`UPDATE platforms SET services_count = (SELECT COUNT(*) FROM services WHERE platform_id = ${platformId}) WHERE id = ${platformId}`);
    res.json({ message: "تم حذف الخدمة بنجاح" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

export default router;
