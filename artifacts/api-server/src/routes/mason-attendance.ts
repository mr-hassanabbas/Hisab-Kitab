import { Router } from "express";
import { validateBody } from "../lib/validate.js";
import { insertMasonAttendanceSchema } from "@workspace/db/schema";

import { queryGet, queryAll, dbExec, dbInsert, getPKT, getPKTDate } from "../lib/db.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { project_id, mason_id, date, start_date, end_date, status, limit = "200", offset = "0" } = req.query as Record<string, string>;
    let sql = `SELECT a.*, m.name as mason_name, m.phone as mason_phone
               FROM mason_attendance a JOIN mason m ON m.id = a.mason_id WHERE 1=1`;
    const params: unknown[] = [];
    if (project_id) { sql += " AND a.project_id = ?"; params.push(project_id); }
    if (mason_id) { sql += " AND a.mason_id = ?"; params.push(mason_id); }
    if (date) { sql += " AND a.date = ?"; params.push(date); }
    if (start_date) { sql += " AND a.date >= ?"; params.push(start_date); }
    if (end_date) { sql += " AND a.date <= ?"; params.push(end_date); }
    if (status) { sql += " AND a.status = ?"; params.push(status); }
    sql += " ORDER BY a.date DESC, m.name ASC LIMIT ? OFFSET ?";
    params.push(parseInt(limit), parseInt(offset));
    const rows = await queryAll(sql, params);
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.get("/today", async (req, res) => {
  try {
    const { project_id, date } = req.query as Record<string, string>;
    if (!project_id) return res.status(400).json({ success: false, error: "project_id required" });
    const theDate = date || getPKTDate();
    const mason = await queryAll(
      `SELECT m.*, pm.daily_wage as project_wage,
              a.status as today_status, a.wage_for_day, a.overtime_hours, a.overtime_pay, a.advance_given, a.remarks as attendance_remarks, a.id as attendance_id
       FROM mason m
       JOIN project_mason pm ON pm.mason_id = m.id AND pm.project_id = ? AND pm.removed_at IS NULL
       LEFT JOIN mason_attendance a ON a.mason_id = m.id AND a.project_id = ? AND a.date = ?
       ORDER BY m.name ASC`,
      [project_id, project_id, theDate]
    );
    res.json({ success: true, data: mason, date: theDate });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.post("/", validateBody(insertMasonAttendanceSchema), async (req, res) => {
  try {
    const { project_id, mason_id, date, status, advance_given = 0, remarks, overtime_hours = 0 } = req.body as Record<string, unknown>;
    if (!project_id || !mason_id || !date || !status) {
      return res.status(400).json({ success: false, error: "project_id, mason_id, date, status required" });
    }
    if (!["present", "absent", "half_day"].includes(status as string)) {
      return res.status(400).json({ success: false, error: "status must be present/absent/half_day" });
    }
    const otHours = Math.max(0, parseFloat(String(overtime_hours)) || 0);
    let pm = await queryGet<{ daily_wage: number }>(
      "SELECT daily_wage FROM project_mason WHERE mason_id = ? AND project_id = ? AND removed_at IS NULL",
      [mason_id, project_id]
    );
    if (!pm) {
      // Auto-register mason to project using their base daily_wage
      const masonBase = await queryGet<{ daily_wage: number }>("SELECT daily_wage FROM mason WHERE id = ?", [mason_id]);
      const baseWage = masonBase?.daily_wage ?? 0;
      await dbInsert(
        "INSERT INTO project_mason (project_id, mason_id, daily_wage, assigned_at) VALUES (?, ?, ?, ?)",
        [project_id, mason_id, baseWage, getPKT()]
      );
      pm = { daily_wage: baseWage };
    }
    // Fetch this mason's overtime rate from their profile
    const masonProfile = await queryGet<{ overtime_rate_per_hour: number }>(
      "SELECT overtime_rate_per_hour FROM mason WHERE id = ?", [mason_id]
    );
    const otRate = masonProfile?.overtime_rate_per_hour ?? 0;
    const dailyWage = pm.daily_wage ?? 0;
    const baseWageForDay = status === "present" ? dailyWage : status === "half_day" ? dailyWage / 2 : 0;
    const overtimePay = status !== "absent" ? otHours * otRate : 0;
    const wageForDay = baseWageForDay + overtimePay;
    const now = getPKT();
    const existing = await queryGet<{ id: number }>(
      "SELECT id FROM mason_attendance WHERE project_id = ? AND mason_id = ? AND date = ?",
      [project_id, mason_id, date]
    );
    if (existing) {
      await dbExec(
        "UPDATE mason_attendance SET status = ?, wage_for_day = ?, overtime_hours = ?, overtime_pay = ?, advance_given = ?, remarks = ? WHERE id = ?",
        [status, wageForDay, otHours, overtimePay, advance_given, remarks ?? null, existing.id]
      );
      const updated = await queryGet("SELECT * FROM mason_attendance WHERE id = ?", [existing.id]);
      return res.json({ success: true, data: updated, updated: true });
    }
    const { id } = await dbInsert(
      "INSERT INTO mason_attendance (project_id, mason_id, date, status, wage_for_day, overtime_hours, overtime_pay, advance_given, remarks, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [project_id, mason_id, date, status, wageForDay, otHours, overtimePay, advance_given, remarks ?? null, now]
    );
    const record = await queryGet("SELECT * FROM mason_attendance WHERE id = ?", [id]);
    res.status(201).json({ success: true, data: record });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.post("/bulk", async (req, res) => {
  try {
    const { project_id, date, records } = req.body as { project_id: number; date: string; records: Array<{ mason_id: number; status: string; advance_given?: number; remarks?: string }> };
    if (!project_id || !date || !Array.isArray(records)) {
      return res.status(400).json({ success: false, error: "project_id, date, records required" });
    }
    const now = getPKT();
    const results = [];
    for (const rec of records) {
      const pm = await queryGet<{ daily_wage: number }>(
        "SELECT daily_wage FROM project_mason WHERE mason_id = ? AND project_id = ? AND removed_at IS NULL",
        [rec.mason_id, project_id]
      );
      const dailyWage = pm?.daily_wage ?? 0;
      const wageForDay = rec.status === "present" ? dailyWage : rec.status === "half_day" ? dailyWage / 2 : 0;
      const existing = await queryGet<{ id: number }>(
        "SELECT id FROM mason_attendance WHERE project_id = ? AND mason_id = ? AND date = ?",
        [project_id, rec.mason_id, date]
      );
      if (existing) {
        await dbExec(
          "UPDATE mason_attendance SET status = ?, wage_for_day = ?, advance_given = ?, remarks = ? WHERE id = ?",
          [rec.status, wageForDay, rec.advance_given ?? 0, rec.remarks ?? null, existing.id]
        );
        results.push({ mason_id: rec.mason_id, updated: true });
      } else {
        await dbInsert(
          "INSERT INTO mason_attendance (project_id, mason_id, date, status, wage_for_day, advance_given, remarks, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [project_id, rec.mason_id, date, rec.status, wageForDay, rec.advance_given ?? 0, rec.remarks ?? null, now]
        );
        results.push({ mason_id: rec.mason_id, inserted: true });
      }
    }
    res.json({ success: true, data: results, count: results.length });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.put("/:id", validateBody(insertMasonAttendanceSchema.partial()), async (req, res) => {
  try {
    const record = await queryGet<{ id: number; project_id: number; mason_id: number }>(
      "SELECT * FROM mason_attendance WHERE id = ?", [req.params.id]
    );
    if (!record) return res.status(404).json({ success: false, error: "Record not found" });
    const { status, advance_given, remarks } = req.body as Record<string, unknown>;
    const updates: string[] = [];
    const vals: unknown[] = [];
    if (status !== undefined) {
      const pm = await queryGet<{ daily_wage: number }>(
        "SELECT daily_wage FROM project_mason WHERE mason_id = ? AND project_id = ? AND removed_at IS NULL",
        [record.mason_id, record.project_id]
      );
      const dailyWage = pm?.daily_wage ?? 0;
      const wageForDay = status === "present" ? dailyWage : status === "half_day" ? dailyWage / 2 : 0;
      updates.push("status = ?", "wage_for_day = ?");
      vals.push(status, wageForDay);
    }
    if (advance_given !== undefined) { updates.push("advance_given = ?"); vals.push(advance_given); }
    if (remarks !== undefined) { updates.push("remarks = ?"); vals.push(remarks); }
    if (updates.length === 0) return res.status(400).json({ success: false, error: "Nothing to update" });
    vals.push(req.params.id);
    await dbExec(`UPDATE mason_attendance SET ${updates.join(", ")} WHERE id = ?`, vals);
    const updated = await queryGet("SELECT * FROM mason_attendance WHERE id = ?", [req.params.id]);
    res.json({ success: true, data: updated });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});



router.delete("/today", async (req, res) => {
  try {
    const { project_id, date } = req.query as Record<string, string>;
    if (!project_id || !date) {
      return res.status(400).json({ success: false, error: "project_id and date required" });
    }
    const count = await dbExec(
      "DELETE FROM mason_attendance WHERE project_id = ? AND date = ?",
      [project_id, date]
    );
    res.json({ success: true, count });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.delete("/:id", async (req, res) => {
  try {
    await dbExec("DELETE FROM mason_attendance WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: "Attendance record deleted" });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.post("/today/make-all-present", async (req, res) => {
  try {
    const { project_id, date } = req.body as { project_id: number; date: string };
    if (!project_id || !date) {
      return res.status(400).json({ success: false, error: "project_id and date required" });
    }
    const now = getPKT();
    const mason = await queryAll(
      `SELECT m.id, pm.daily_wage FROM mason m
       JOIN project_mason pm ON pm.mason_id = m.id AND pm.project_id = ? AND pm.removed_at IS NULL
       ORDER BY m.id ASC`,
      [project_id]
    );
    const results = [];
    for (const m of mason as Array<{ id: number; daily_wage: number }>) {
      const existing = await queryGet<{ id: number }>(
        "SELECT id FROM mason_attendance WHERE project_id = ? AND mason_id = ? AND date = ?",
        [project_id, m.id, date]
      );
      if (existing) {
        await dbExec(
          "UPDATE mason_attendance SET status = 'present', wage_for_day = ? WHERE id = ?",
          [m.daily_wage ?? 0, existing.id]
        );
        results.push({ mason_id: m.id, updated: true });
      } else {
        await dbInsert(
          "INSERT INTO mason_attendance (project_id, mason_id, date, status, wage_for_day, created_at) VALUES (?, ?, ?, 'present', ?, ?)",
          [project_id, m.id, date, m.daily_wage ?? 0, now]
        );
        results.push({ mason_id: m.id, inserted: true });
      }
    }
    res.json({ success: true, data: results, count: results.length });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.post("/today/make-all-absent", async (req, res) => {
  try {
    const { project_id, date } = req.body as { project_id: number; date: string };
    if (!project_id || !date) {
      return res.status(400).json({ success: false, error: "project_id and date required" });
    }
    const now = getPKT();
    const mason = await queryAll(
      `SELECT m.id FROM mason m
       JOIN project_mason pm ON pm.mason_id = m.id AND pm.project_id = ? AND pm.removed_at IS NULL
       ORDER BY m.id ASC`,
      [project_id]
    );
    const results = [];
    for (const m of mason as Array<{ id: number }>) {
      const existing = await queryGet<{ id: number }>(
        "SELECT id FROM mason_attendance WHERE project_id = ? AND mason_id = ? AND date = ?",
        [project_id, m.id, date]
      );
      if (existing) {
        await dbExec(
          "UPDATE mason_attendance SET status = 'absent', wage_for_day = 0 WHERE id = ?",
          [existing.id]
        );
        results.push({ mason_id: m.id, updated: true });
      } else {
        await dbInsert(
          "INSERT INTO mason_attendance (project_id, mason_id, date, status, wage_for_day, created_at) VALUES (?, ?, ?, 'absent', 0, ?)",
          [project_id, m.id, date, now]
        );
        results.push({ mason_id: m.id, inserted: true });
      }
    }
    res.json({ success: true, data: results, count: results.length });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

export default router;
