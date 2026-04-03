import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import { createSession, requireAuth, type AuthRequest } from "../middlewares/auth";

const router = Router();

router.post("/register", async (req, res) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صالحة" });
    return;
  }
  const { email, password, name } = parsed.data;
  try {
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (existing.length > 0) {
      res.status(400).json({ error: "البريد الإلكتروني مستخدم بالفعل" });
      return;
    }
    const hashed = await bcrypt.hash(password, 10);
    const [user] = await db.insert(usersTable).values({ email, password: hashed, name }).returning();
    const token = createSession(user.id, user.role);
    res.cookie("session", token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: "lax", path: "/" });
    res.status(201).json({
      user: { id: user.id, email: user.email, name: user.name, balance: parseFloat(user.balance), role: user.role, createdAt: user.createdAt },
      message: "تم التسجيل بنجاح",
      token,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.post("/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صالحة" });
    return;
  }
  const { email, password } = parsed.data;
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (!user) {
      res.status(401).json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
      return;
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      res.status(401).json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
      return;
    }
    const token = createSession(user.id, user.role);
    res.cookie("session", token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: "lax", path: "/" });
    res.json({
      user: { id: user.id, email: user.email, name: user.name, balance: parseFloat(user.balance), role: user.role, createdAt: user.createdAt },
      message: "تم تسجيل الدخول بنجاح",
      token,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie("session");
  res.json({ message: "تم تسجيل الخروج بنجاح" });
});

router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    if (!user) {
      res.status(401).json({ error: "غير مصرح" });
      return;
    }
    res.json({ id: user.id, email: user.email, name: user.name, balance: parseFloat(user.balance), role: user.role, createdAt: user.createdAt });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

export default router;
