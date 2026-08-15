import { Router } from "express";
import bcrypt from "bcryptjs";
import { queryAll, queryGet, dbExec, getPKT } from "../lib/db.js";

const router = Router();

const TABLES = [
  "users", "projects", "labour", "mason", "project_labour", "project_mason",
  "attendance", "mason_attendance", "weekly_payments", "mason_weekly_payments",
  "daily_expenses", "materials", "equipment",
  "owner_payments", "daily_diary", "photos", "settings"
];

router.get("/export", async (req, res) => {
  try {
    const backup: Record<string, unknown[]> = {};
    // settings uses `key` as PK, not `id`; everything else has id
    const NO_ID_TABLES = new Set(["settings"]);
    for (const table of TABLES) {
      const orderBy = NO_ID_TABLES.has(table) ? "ORDER BY 1" : "ORDER BY id ASC";
      backup[table] = await queryAll(`SELECT * FROM ${table} ${orderBy}`);
    }
    const ts = getPKT().replace(/[: ]/g, "-").replace(/\./g, "-");
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="hisab-kitab-backup-${ts}.json"`);
    res.json({ success: true, exported_at: getPKT(), version: "1.0", data: backup });
  } catch (e) { res.status(500).json({ success: false, error: "Backup failed" }); }
});

router.post("/restore", async (req, res) => {
  try {
    const body = req.body as { version?: string; data?: Record<string, unknown[]> };
    if (!body?.data) {
      return res.status(400).json({ success: false, error: "Invalid backup file — missing data" });
    }
    const restored: Record<string, number> = {};
    const errors: string[] = [];

    for (const table of TABLES) {
      const rows = body.data[table];
      if (!rows || !Array.isArray(rows)) continue;
      try {
        // Delete existing rows (foreign keys: order matters)
        // Truncate in reverse dependency order
        if (table === "users") continue; // never restore users — would lock out current user
        await dbExec(`DELETE FROM ${table}`);
        let count = 0;
        for (const row of rows) {
          if (!row || typeof row !== "object") continue;
          const r = row as Record<string, unknown>;
          const cols = Object.keys(r);
          if (cols.length === 0) continue;
          const placeholders = cols.map(() => "?").join(", ");
          const vals = cols.map((c) => r[c]);
          try {
            await dbExec(`INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`, vals);
            count++;
          } catch {
            // skip individual row errors (e.g. FK constraint)
          }
        }
        restored[table] = count;
      } catch (tableErr) {
        errors.push(`${table}: ${(tableErr as Error).message}`);
      }
    }

    res.json({
      success: true,
      message: "Restore complete",
      restored,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e) {
    res.status(500).json({ success: false, error: `Restore failed: ${(e as Error).message}` });
  }
});

// Clear all project data — requires PIN confirmation
router.post("/clear", async (req, res) => {
  try {
    const { pin } = req.body as { pin?: string };
    if (!pin) return res.status(400).json({ success: false, error: "PIN is required" });

    const user = await queryGet<{ pin_hash: string }>(
      "SELECT pin_hash FROM users WHERE id = ?", [req.user!.id]
    );
    if (!user || !bcrypt.compareSync(pin, user.pin_hash)) {
      return res.status(401).json({ success: false, error: "Incorrect PIN" });
    }

    // Delete in FK-safe reverse order (skip users and settings)
    const CLEAR_TABLES = [
      "photos", "daily_diary", "owner_payments", "equipment",
      "materials", "daily_expenses", "weekly_payments", "mason_weekly_payments",
      "attendance", "mason_attendance", "project_labour", "project_mason", "labour", "mason", "projects",
    ];
    const cleared: Record<string, number> = {};
    for (const table of CLEAR_TABLES) {
      const before = await queryGet<{ count: string }>(
        `SELECT COUNT(*) as count FROM ${table}`
      );
      await dbExec(`DELETE FROM ${table}`);
      cleared[table] = parseInt(before?.count ?? "0");
    }

    return res.json({ success: true, message: "All project data cleared", cleared });
  } catch (e) {
    return res.status(500).json({ success: false, error: (e as Error).message });
  }
});

router.get("/status", async (req, res) => {
  try {
    const counts: Record<string, number> = {};
    for (const table of TABLES) {
      const r = await queryAll<{ count: string }>(`SELECT COUNT(*) as count FROM ${table}`);
      counts[table] = parseInt(r[0]?.count ?? "0");
    }
    res.json({ success: true, data: { tables: counts, timestamp: getPKT() } });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

export default router;
