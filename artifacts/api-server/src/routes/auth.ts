import { Router } from "express";
import bcrypt from "bcryptjs";
import { queryGet, dbExec, dbInsert, getPKT } from "../lib/db.js";
import { generateToken, authenticate, verifyToken } from "../middlewares/auth.js";

const router = Router();

router.get("/status", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const userExists = !!(await queryGet("SELECT id FROM users LIMIT 1"));
    let user = null;
    if (authHeader) {
      const parts = authHeader.split(" ");
      if (parts.length === 2 && parts[0] === "Bearer") {
        const result = verifyToken(parts[1]);
        if (result.valid && result.decoded) {
          user = await queryGet<{ id: number; name: string; mobile: string; language: string; theme: string }>(
            "SELECT id, name, mobile, language, theme FROM users WHERE id = ?",
            [result.decoded.id]
          );
        }
      }
    }
    res.json({ success: true, hasUser: userExists, isAuthenticated: !!user, user, needsSetup: !userExists });
  } catch (e) {
    console.error("AUTH STATUS ERROR:", e); res.status(500).json({ success: false, error: "Internal server error" });
  }
});

router.post("/setup", async (req, res) => {
  try {
    const { name, mobile, pin, confirmPin, language = "en", theme = "system" } = req.body as Record<string, string>;
    if (!name || !mobile || !pin || !confirmPin) {
      return res.status(400).json({ success: false, error: "All fields are required" });
    }
    if (pin !== confirmPin) return res.status(400).json({ success: false, error: "PINs do not match" });
    if (!/^[0-9]{4}$/.test(pin)) return res.status(400).json({ success: false, error: "PIN must be exactly 4 digits" });
    if (!/^03[0-9]{9}$/.test(mobile.replace(/[\s-]/g, ""))) {
      return res.status(400).json({ success: false, error: "Invalid mobile number format (e.g. 03001234567)" });
    }
    const existing = await queryGet("SELECT id FROM users LIMIT 1");
    if (existing) return res.status(400).json({ success: false, error: "Setup already completed" });
    const pin_hash = bcrypt.hashSync(pin, 10);
    const now = getPKT();
    const { id } = await dbInsert(
      "INSERT INTO users (name, mobile, pin_hash, language, theme, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [name, mobile.replace(/[\s-]/g, ""), pin_hash, language, theme, now]
    );
    const user = await queryGet<{ id: number; name: string; mobile: string; language: string; theme: string; role?: string }>(
      "SELECT id, name, mobile, language, theme, COALESCE(role, 'admin') as role FROM users WHERE id = ?",
      [id]
    );
    const token = generateToken({ ...user!, role: user!.role || "admin" });
    return res.json({ success: true, token, user, message: "Setup completed successfully" });
  } catch (e) {
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { mobile, pin } = req.body as { mobile: string; pin: string };
    if (!mobile || !pin) return res.status(400).json({ success: false, error: "Mobile and PIN required" });
    const user = await queryGet<{ id: number; name: string; mobile: string; language: string; theme: string; pin_hash: string; role?: string }>(
      "SELECT * FROM users WHERE mobile = ?",
      [mobile.replace(/[\s-]/g, "")]
    );
    if (!user) return res.status(401).json({ success: false, error: "User not found" });
    if (!user.pin_hash || !bcrypt.compareSync(pin, user.pin_hash)) {
      return res.status(401).json({ success: false, error: "Invalid PIN" });
    }
    const { pin_hash: _, ...safeUser } = user;
    const token = generateToken({ ...safeUser, role: safeUser.role || "admin" } as never);
    return res.json({ success: true, token, user: safeUser, message: "Login successful" });
  } catch (e) {
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

router.post("/logout", (_req, res) => {
  res.json({ success: true, message: "Logged out successfully" });
});

router.post("/change-pin", authenticate, async (req, res) => {
  try {
    const { oldPin, newPin } = req.body as { oldPin: string; newPin: string };
    if (!oldPin || !newPin) return res.status(400).json({ success: false, error: "Both PINs required" });
    if (!/^[0-9]{4}$/.test(newPin)) return res.status(400).json({ success: false, error: "New PIN must be 4 digits" });
    const user = await queryGet<{ pin_hash: string }>("SELECT pin_hash FROM users WHERE id = ?", [req.user!.id]);
    if (!user || !bcrypt.compareSync(oldPin, user.pin_hash)) {
      return res.status(401).json({ success: false, error: "Invalid current PIN" });
    }
    const newHash = bcrypt.hashSync(newPin, 10);
    await dbExec("UPDATE users SET pin_hash = ? WHERE id = ?", [newHash, req.user!.id]);
    return res.json({ success: true, message: "PIN changed successfully" });
  } catch (e) {
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

router.get("/me", authenticate, async (req, res) => {
  res.json({ success: true, user: req.user });
});

router.put("/me", authenticate, async (req, res) => {
  try {
    const { name, language, theme } = req.body as { name?: string; language?: string; theme?: string };
    const fields: string[] = [];
    const vals: unknown[] = [];
    if (name) { fields.push("name = ?"); vals.push(name); }
    if (language) { fields.push("language = ?"); vals.push(language); }
    if (theme) { fields.push("theme = ?"); vals.push(theme); }
    if (fields.length === 0) return res.status(400).json({ success: false, error: "Nothing to update" });
    vals.push(req.user!.id);
    await dbExec(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, vals);
    const user = await queryGet("SELECT id, name, mobile, language, theme FROM users WHERE id = ?", [req.user!.id]);
    res.json({ success: true, user });
  } catch (e) {
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

export default router;
