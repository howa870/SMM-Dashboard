import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const SESSION_SECRET = process.env.SESSION_SECRET || "perfect-follow-secret-key";

export interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
}

function encodeSession(userId: number, role: string): string {
  const payload = JSON.stringify({ userId, role, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  return Buffer.from(payload + ":" + SESSION_SECRET).toString("base64");
}

function decodeSession(token: string): { userId: number; role: string; exp: number } | null {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf8");
    const sepIdx = decoded.lastIndexOf(":" + SESSION_SECRET);
    if (sepIdx === -1) return null;
    const payload = decoded.substring(0, sepIdx);
    const data = JSON.parse(payload);
    if (data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function createSession(userId: number, role: string): string {
  return encodeSession(userId, role);
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = req.cookies?.["session"] || req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    res.status(401).json({ error: "غير مصرح" });
    return;
  }
  const session = decodeSession(token);
  if (!session) {
    res.status(401).json({ error: "جلسة منتهية الصلاحية" });
    return;
  }
  req.userId = session.userId;
  req.userRole = session.role;
  next();
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.userRole !== "admin") {
      res.status(403).json({ error: "غير مصرح - يتطلب صلاحيات المدير" });
      return;
    }
    next();
  });
}

export { decodeSession };
