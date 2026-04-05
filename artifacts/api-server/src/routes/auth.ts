import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import { createSession, requireAuth, type AuthRequest } from "../middlewares/auth";
import { createClient } from "@supabase/supabase-js";

const router = Router();

// Supabase admin client — uses service role key to bypass email confirmation
const SUPABASE_URL  = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || "";
const SERVICE_KEY   = process.env["SUPABASE_SERVICE_ROLE_KEY"] || "";
const supabaseAdmin = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

/**
 * POST /api/auth/supabase-register
 * Creates a Supabase user with email auto-confirmed (no email verification needed)
 */
router.post("/supabase-register", async (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || !email || !password) {
    res.status(400).json({ error: "الاسم والبريد وكلمة المرور مطلوبة" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" });
    return;
  }

  if (!supabaseAdmin) {
    res.status(500).json({ error: "إعدادات Supabase غير مكتملة" });
    return;
  }

  try {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,           // ← key: skip email verification
      user_metadata: { name },
    });

    if (error) {
      const msg = error.message.includes("already been registered") || error.message.includes("already registered")
        ? "هذا البريد الإلكتروني مسجّل مسبقاً"
        : error.message;
      res.status(400).json({ error: msg });
      return;
    }

    res.status(201).json({ success: true, userId: data.user?.id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ في إنشاء الحساب";
    res.status(500).json({ error: msg });
  }
});

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

/**
 * POST /api/auth/jwt-sync
 * Accepts a Supabase JWT, verifies it, and issues a backend session cookie.
 * Used to restore backend sessions for existing Supabase users on page load.
 */
router.post("/jwt-sync", async (req, res) => {
  try {
    const { jwt } = req.body as { jwt?: string };
    if (!jwt || !supabaseAdmin) {
      res.status(400).json({ error: "Missing JWT or Supabase config" });
      return;
    }
    // Verify the Supabase JWT
    const { data, error } = await supabaseAdmin.auth.getUser(jwt);
    if (error || !data?.user?.email) {
      res.status(401).json({ error: "JWT inválido" });
      return;
    }
    const email = data.user.email;
    // Find or create the user in Drizzle
    let [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (!user) {
      // Auto-create user from Supabase data
      const name = (data.user.user_metadata as { name?: string })?.name || email.split("@")[0];
      const fakeHash = await bcrypt.hash(Math.random().toString(36), 8);
      const [inserted] = await db.insert(usersTable).values({ email, name, password: fakeHash, role: "user" }).returning();
      user = inserted;
    }
    const token = createSession(user.id, user.role);
    res.cookie("session", token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: "lax", path: "/" });
    res.json({
      user: { id: user.id, email: user.email, name: user.name, balance: parseFloat(user.balance), role: user.role },
      token,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
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
