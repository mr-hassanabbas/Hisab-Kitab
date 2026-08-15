import { Router } from "express";
import bcrypt from "bcryptjs";
import { queryGet, queryAll, dbExec } from "../lib/db.js";
import { authenticate } from "../middlewares/auth.js";

const router = Router();

const DEFAULT_SETTINGS: Record<string, string> = {
  app_name: "Hisab Kitab",
  app_version: "1.0.0",
  auto_backup: "1",
  sync_interval: "30",
  last_backup: "",
  last_sync: "",
  default_language: "en",
  default_theme: "system",
};

router.get("/", async (req, res) => {
  try {
    const rows = await queryAll<{ key: string; value: string }>("SELECT * FROM settings ORDER BY key ASC");
    const settings: Record<string, string> = { ...DEFAULT_SETTINGS };
    for (const row of rows) { settings[row.key] = row.value; }
    res.json({ success: true, data: settings });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.get("/:key", async (req, res) => {
  try {
    const row = await queryGet<{ key: string; value: string }>("SELECT * FROM settings WHERE key = ?", [req.params.key]);
    const value = row?.value ?? DEFAULT_SETTINGS[req.params.key] ?? null;
    res.json({ success: true, data: { key: req.params.key, value } });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.post("/", async (req, res) => {
  try {
    const { settings } = req.body as { settings: Record<string, string> };
    if (!settings || typeof settings !== "object") {
      return res.status(400).json({ success: false, error: "settings object required" });
    }
    for (const [key, value] of Object.entries(settings)) {
      const existing = await queryGet("SELECT key FROM settings WHERE key = ?", [key]);
      if (existing) {
        await dbExec("UPDATE settings SET value = ? WHERE key = ?", [String(value), key]);
      } else {
        await dbExec("INSERT INTO settings (key, value) VALUES (?, ?)", [key, String(value)]);
      }
    }
    res.json({ success: true, message: "Settings saved" });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.put("/:key", async (req, res) => {
  try {
    const { value } = req.body as { value: string };
    if (value === undefined) return res.status(400).json({ success: false, error: "value required" });
    const existing = await queryGet("SELECT key FROM settings WHERE key = ?", [req.params.key]);
    if (existing) {
      await dbExec("UPDATE settings SET value = ? WHERE key = ?", [String(value), req.params.key]);
    } else {
      await dbExec("INSERT INTO settings (key, value) VALUES (?, ?)", [req.params.key, String(value)]);
    }
    res.json({ success: true, data: { key: req.params.key, value } });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.post("/change-pin", authenticate, async (req, res) => {
  try {
    const { current_pin, new_pin } = req.body as { current_pin?: string; new_pin?: string };
    if (!current_pin || !new_pin) return res.status(400).json({ success: false, error: "Both PINs required" });
    if (!/^[0-9]{4}$/.test(new_pin)) return res.status(400).json({ success: false, error: "New PIN must be 4 digits" });
    const user = await queryGet<{ pin_hash: string }>("SELECT pin_hash FROM users WHERE id = ?", [req.user!.id]);
    if (!user || !bcrypt.compareSync(current_pin, user.pin_hash)) {
      return res.status(401).json({ success: false, error: "Invalid current PIN" });
    }
    await dbExec("UPDATE users SET pin_hash = ? WHERE id = ?", [bcrypt.hashSync(new_pin, 10), req.user!.id]);
    return res.json({ success: true, message: "PIN changed successfully" });
  } catch (e) {
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

router.post("/clear-data", authenticate, async (req, res) => {
  try {
    const { pin } = req.body as { pin?: string };
    if (!pin) return res.status(400).json({ success: false, error: "PIN is required" });
    const user = await queryGet<{ pin_hash: string }>("SELECT pin_hash FROM users WHERE id = ?", [req.user!.id]);
    if (!user || !bcrypt.compareSync(pin, user.pin_hash)) {
      return res.status(401).json({ success: false, error: "Incorrect PIN" });
    }
    const CLEAR_TABLES = [
      "photos", "daily_diary", "owner_payments", "equipment",
      "materials", "daily_expenses", "weekly_payments",
      "attendance", "project_labour", "labour", "projects",
    ];
    const cleared: Record<string, number> = {};
    for (const table of CLEAR_TABLES) {
      const before = await queryGet<{ count: string }>(`SELECT COUNT(*) as count FROM ${table}`);
      await dbExec(`DELETE FROM ${table}`);
      cleared[table] = parseInt(before?.count ?? "0");
    }
    return res.json({ success: true, message: "All project data cleared", cleared });
  } catch (e) {
    return res.status(500).json({ success: false, error: (e as Error).message });
  }
});

export default router;
