import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { queryGet } from "../lib/db.js";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

export interface JwtPayload {
  id: number;
  mobile: string;
  name: string;
  language: string;
  theme: string;
  role?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function generateToken(user: JwtPayload): string {
  return jwt.sign(
    { id: user.id, mobile: user.mobile, name: user.name, language: user.language, theme: user.theme, role: user.role || "admin" },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export function verifyToken(token: string): { valid: boolean; decoded: JwtPayload | null; error?: string } {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return { valid: true, decoded };
  } catch (err: unknown) {
    const e = err as Error;
    return { valid: false, decoded: null, error: e.message };
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ success: false, error: "No token provided" });
    return;
  }
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    res.status(401).json({ success: false, error: "Invalid token format" });
    return;
  }
  const result = verifyToken(parts[1]);
  if (!result.valid || !result.decoded) {
    res.status(401).json({ success: false, error: result.error ?? "Invalid token" });
    return;
  }
  const user = await queryGet<{ id: number; name: string; mobile: string; language: string; theme: string; role?: string }>(
    "SELECT id, name, mobile, language, theme, COALESCE(role, 'admin') as role FROM users WHERE id = ?",
    [result.decoded.id]
  );
  if (!user) {
    res.status(401).json({ success: false, error: "User not found" });
    return;
  }
  req.user = { ...result.decoded, ...user, role: user.role || "admin" };
  next();
}

export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole = req.user?.role || "admin";
    if (!allowedRoles.includes(userRole)) {
      res.status(403).json({ success: false, error: "Access denied. Insufficient permissions." });
      return;
    }
    next();
  };
}
