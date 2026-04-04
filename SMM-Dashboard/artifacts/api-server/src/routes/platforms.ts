import { Router } from "express";
import { db, platformsTable, servicesTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { CreatePlatformBody, GetPlatformParams, UpdatePlatformBody, UpdatePlatformParams, DeletePlatformParams } from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/auth";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const platforms = await db.select().from(platformsTable).orderBy(platformsTable.id);
    res.json(platforms.map(p => ({
      id: p.id,
      name: p.name,
      icon: p.icon,
      servicesCount: p.servicesCount,
      status: p.status,
      color: p.color,
      createdAt: p.createdAt
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  const parsed = CreatePlatformBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صالحة" });
    return;
  }
  try {
    const [platform] = await db.insert(platformsTable).values({
      name: parsed.data.name,
      icon: parsed.data.icon,
      status: parsed.data.status,
      color: parsed.data.color,
    }).returning();
    res.status(201).json({ id: platform.id, name: platform.name, icon: platform.icon, servicesCount: platform.servicesCount, status: platform.status, color: platform.color, createdAt: platform.createdAt });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.get("/:id", async (req, res) => {
  const parsed = GetPlatformParams.safeParse({ id: parseInt(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "معرف غير صالح" });
    return;
  }
  try {
    const [platform] = await db.select().from(platformsTable).where(eq(platformsTable.id, parsed.data.id)).limit(1);
    if (!platform) {
      res.status(404).json({ error: "المنصة غير موجودة" });
      return;
    }
    res.json({ id: platform.id, name: platform.name, icon: platform.icon, servicesCount: platform.servicesCount, status: platform.status, color: platform.color, createdAt: platform.createdAt });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.put("/:id", requireAdmin, async (req, res) => {
  const paramParsed = UpdatePlatformParams.safeParse({ id: parseInt(req.params.id) });
  const bodyParsed = UpdatePlatformBody.safeParse(req.body);
  if (!paramParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "بيانات غير صالحة" });
    return;
  }
  try {
    const [platform] = await db.update(platformsTable).set({
      name: bodyParsed.data.name,
      icon: bodyParsed.data.icon,
      status: bodyParsed.data.status,
      color: bodyParsed.data.color,
    }).where(eq(platformsTable.id, paramParsed.data.id)).returning();
    if (!platform) {
      res.status(404).json({ error: "المنصة غير موجودة" });
      return;
    }
    res.json({ id: platform.id, name: platform.name, icon: platform.icon, servicesCount: platform.servicesCount, status: platform.status, color: platform.color, createdAt: platform.createdAt });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const parsed = DeletePlatformParams.safeParse({ id: parseInt(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "معرف غير صالح" });
    return;
  }
  try {
    await db.delete(platformsTable).where(eq(platformsTable.id, parsed.data.id));
    res.json({ message: "تم حذف المنصة بنجاح" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

export default router;
