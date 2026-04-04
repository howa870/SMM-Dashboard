import { Router } from "express";
import { db, usersTable, ordersTable, paymentsTable } from "@workspace/db";
import { eq, desc, count, sum, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router = Router();

router.get("/balance", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select({ balance: usersTable.balance }).from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    if (!user) {
      res.status(404).json({ error: "المستخدم غير موجود" });
      return;
    }
    res.json({ balance: parseFloat(user.balance) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

export default router;
