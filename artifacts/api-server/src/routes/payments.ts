import { Router } from "express";
import { db, paymentsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { CreatePaymentBody, UploadReceiptBody } from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import path from "path";
import fs from "fs";

const router = Router();
const UPLOADS_DIR = path.join(process.cwd(), "uploads");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

async function formatPayment(p: typeof paymentsTable.$inferSelect) {
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

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const payments = await db.select().from(paymentsTable)
      .where(eq(paymentsTable.userId, req.userId!))
      .orderBy(desc(paymentsTable.createdAt));
    const formatted = await Promise.all(payments.map(formatPayment));
    res.json(formatted);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const parsed = CreatePaymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صالحة" });
    return;
  }
  if (parsed.data.amount <= 0) {
    res.status(400).json({ error: "المبلغ يجب أن يكون أكبر من صفر" });
    return;
  }
  try {
    const [payment] = await db.insert(paymentsTable).values({
      userId: req.userId!,
      amount: String(parsed.data.amount),
      method: parsed.data.method,
      status: "pending",
      transactionId: parsed.data.transactionId || null,
      receiptUrl: parsed.data.receiptUrl || null,
      notes: parsed.data.notes || null,
    }).returning();
    const formatted = await formatPayment(payment);
    res.status(201).json(formatted);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.post("/upload-receipt", requireAuth, async (req: AuthRequest, res) => {
  const parsed = UploadReceiptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صالحة" });
    return;
  }
  try {
    const { imageData, fileName } = parsed.data;
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const ext = fileName.split(".").pop() || "jpg";
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, uniqueName);
    fs.writeFileSync(filePath, buffer);
    const url = `/api/uploads/${uniqueName}`;
    res.json({ url });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "خطأ في رفع الملف" });
  }
});

export default router;
