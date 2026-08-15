import { Router } from "express";
import { validateBody } from "../lib/validate.js";
import { insertAttendanceSchema } from "@workspace/db/schema";

import { queryGet, queryAll, dbExec, dbInsert, getPKT, getPKTDate } from "../lib/db.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { project_id, labour_id, date, start_date, end_date, status, limit = "200", offset = "0" } = req.query as Record<string, string>;
    let sql = `SELECT a.*, l.name as labour_name, l.phone as labour_phone
               FROM attendance a JOIN labour l ON l.id = a.labour_id WHERE 1=1`;
    const params: unknown[] = [];
    if (project_id) { sql += " AND a.project_id = ?"; params.push(project_id); }
    if (labour_id) { sql += " AND a.labour_id = ?"; params.push(labour_id); }
    if (date) { sql += " AND a.date = ?"; params.push(date); }
    if (start_date) { sql += " AND a.date >= ?"; params.push(start_date); }
    if (end_date) { sql += " AND a.date <= ?"; params.push(end_date); }
    if (status) { sql += " AND a.status = ?"; params.push(status); }
    sql += " ORDER BY a.date DESC, l.name ASC LIMIT ? OFFSET ?";
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
    const labour = await queryAll(
      `SELECT l.*, pl.daily_wage as project_wage,
              a.status as today_status, a.wage_for_day, a.overtime_hours, a.overtime_pay, a.advance_given, a.remarks as attendance_remarks, a.id as attendance_id
       FROM labour l
       JOIN project_labour pl ON pl.labour_id = l.id AND pl.project_id = ? AND pl.removed_at IS NULL
       LEFT JOIN attendance a ON a.labour_id = l.id AND a.project_id = ? AND a.date = ?
       ORDER BY l.name ASC`,
      [project_id, project_id, theDate]
    );
    res.json({ success: true, data: labour, date: theDate });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.post("/", validateBody(insertAttendanceSchema), async (req, res) => {
  try {
    const { project_id, labour_id, date, status, advance_given = 0, remarks, overtime_hours = 0 } = req.body as Record<string, unknown>;
    if (!project_id || !labour_id || !date || !status) {
      return res.status(400).json({ success: false, error: "project_id, labour_id, date, status required" });
    }
    if (!["present", "absent", "half_day"].includes(status as string)) {
      return res.status(400).json({ success: false, error: "status must be present/absent/half_day" });
    }
    const otHours = Math.max(0, parseFloat(String(overtime_hours)) || 0);
    let pl = await queryGet<{ daily_wage: number }>(
      "SELECT daily_wage FROM project_labour WHERE labour_id = ? AND project_id = ? AND removed_at IS NULL",
      [labour_id, project_id]
    );
    if (!pl) {
      // Auto-register labour to project using their base daily_wage
      const labourBase = await queryGet<{ daily_wage: number }>("SELECT daily_wage FROM labour WHERE id = ?", [labour_id]);
      const baseWage = labourBase?.daily_wage ?? 0;
      await dbInsert(
        "INSERT INTO project_labour (project_id, labour_id, daily_wage, assigned_at) VALUES (?, ?, ?, ?)",
        [project_id, labour_id, baseWage, getPKT()]
      );
      pl = { daily_wage: baseWage };
    }
    // Fetch this worker's overtime rate from their profile
    const labourProfile = await queryGet<{ overtime_rate_per_hour: number }>(
      "SELECT overtime_rate_per_hour FROM labour WHERE id = ?", [labour_id]
    );
    const otRate = labourProfile?.overtime_rate_per_hour ?? 0;
    const dailyWage = pl.daily_wage ?? 0;
    const baseWageForDay = status === "present" ? dailyWage : status === "half_day" ? dailyWage / 2 : 0;
    const overtimePay = status !== "absent" ? otHours * otRate : 0;
    const wageForDay = baseWageForDay + overtimePay;
    const now = getPKT();
    const existing = await queryGet<{ id: number }>(
      "SELECT id FROM attendance WHERE project_id = ? AND labour_id = ? AND date = ?",
      [project_id, labour_id, date]
    );
    if (existing) {
      await dbExec(
        "UPDATE attendance SET status = ?, wage_for_day = ?, overtime_hours = ?, overtime_pay = ?, advance_given = ?, remarks = ? WHERE id = ?",
        [status, wageForDay, otHours, overtimePay, advance_given, remarks ?? null, existing.id]
      );
      const updated = await queryGet("SELECT * FROM attendance WHERE id = ?", [existing.id]);
      return res.json({ success: true, data: updated, updated: true });
    }
    const { id } = await dbInsert(
      "INSERT INTO attendance (project_id, labour_id, date, status, wage_for_day, overtime_hours, overtime_pay, advance_given, remarks, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [project_id, labour_id, date, status, wageForDay, otHours, overtimePay, advance_given, remarks ?? null, now]
    );
    const record = await queryGet("SELECT * FROM attendance WHERE id = ?", [id]);
    res.status(201).json({ success: true, data: record });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.post("/bulk", async (req, res) => {
  try {
    const { project_id, date, records } = req.body as { project_id: number; date: string; records: Array<{ labour_id: number; status: string; advance_given?: number; remarks?: string }> };
    if (!project_id || !date || !Array.isArray(records)) {
      return res.status(400).json({ success: false, error: "project_id, date, records required" });
    }
    const now = getPKT();
    const results = [];
    for (const rec of records) {
      const pl = await queryGet<{ daily_wage: number }>(
        "SELECT daily_wage FROM project_labour WHERE labour_id = ? AND project_id = ? AND removed_at IS NULL",
        [rec.labour_id, project_id]
      );
      const dailyWage = pl?.daily_wage ?? 0;
      const wageForDay = rec.status === "present" ? dailyWage : rec.status === "half_day" ? dailyWage / 2 : 0;
      const existing = await queryGet<{ id: number }>(
        "SELECT id FROM attendance WHERE project_id = ? AND labour_id = ? AND date = ?",
        [project_id, rec.labour_id, date]
      );
      if (existing) {
        await dbExec(
          "UPDATE attendance SET status = ?, wage_for_day = ?, advance_given = ?, remarks = ? WHERE id = ?",
          [rec.status, wageForDay, rec.advance_given ?? 0, rec.remarks ?? null, existing.id]
        );
        results.push({ labour_id: rec.labour_id, updated: true });
      } else {
        await dbInsert(
          "INSERT INTO attendance (project_id, labour_id, date, status, wage_for_day, advance_given, remarks, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [project_id, rec.labour_id, date, rec.status, wageForDay, rec.advance_given ?? 0, rec.remarks ?? null, now]
        );
        results.push({ labour_id: rec.labour_id, inserted: true });
      }
    }
    res.json({ success: true, data: results, count: results.length });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.put("/:id", validateBody(insertAttendanceSchema.partial()), async (req, res) => {
  try {
    const record = await queryGet<{ id: number; project_id: number; labour_id: number; overtime_hours: number; overtime_pay: number }>(
      "SELECT * FROM attendance WHERE id = ?", [req.params.id]
    );
    if (!record) return res.status(404).json({ success: false, error: "Record not found" });
    const { status, advance_given, remarks, overtime_hours } = req.body as Record<string, unknown>;
    const updates: string[] = [];
    const vals: unknown[] = [];
    if (status !== undefined || overtime_hours !== undefined) {
      const pl = await queryGet<{ daily_wage: number }>(
        "SELECT daily_wage FROM project_labour WHERE labour_id = ? AND project_id = ? AND removed_at IS NULL",
        [record.labour_id, record.project_id]
      );
      const dailyWage = pl?.daily_wage ?? 0;
      const currentStatus = status !== undefined ? (status as string) : 
        (await queryGet<{ status: string }>("SELECT status FROM attendance WHERE id = ?", [record.id]))?.status ?? "present";
      const baseWageForDay = currentStatus === "present" ? dailyWage : currentStatus === "half_day" ? dailyWage / 2 : 0;
      const otHours = overtime_hours !== undefined ? Math.max(0, parseFloat(String(overtime_hours)) || 0) : (record.overtime_hours ?? 0);
      const labourProfile = await queryGet<{ overtime_rate_per_hour: number }>(
        "SELECT overtime_rate_per_hour FROM labour WHERE id = ?", [record.labour_id]
      );
      const otRate = labourProfile?.overtime_rate_per_hour ?? 0;
      const overtimePay = currentStatus !== "absent" ? otHours * otRate : 0;
      const wageForDay = baseWageForDay + overtimePay;
      updates.push("status = ?", "wage_for_day = ?", "overtime_hours = ?", "overtime_pay = ?");
      vals.push(currentStatus, wageForDay, otHours, overtimePay);
    }
    if (advance_given !== undefined) { updates.push("advance_given = ?"); vals.push(advance_given); }
    if (remarks !== undefined) { updates.push("remarks = ?"); vals.push(remarks); }
    if (updates.length === 0) return res.status(400).json({ success: false, error: "Nothing to update" });
    vals.push(req.params.id);
    await dbExec(`UPDATE attendance SET ${updates.join(", ")} WHERE id = ?`, vals);
    const updated = await queryGet("SELECT * FROM attendance WHERE id = ?", [req.params.id]);
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
      "DELETE FROM attendance WHERE project_id = ? AND date = ?",
      [project_id, date]
    );
    res.json({ success: true, count });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.delete("/:id", async (req, res) => {
  try {
    await dbExec("DELETE FROM attendance WHERE id = ?", [req.params.id]);
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
    const labour = await queryAll(
      `SELECT l.id, pl.daily_wage FROM labour l
       JOIN project_labour pl ON pl.labour_id = l.id AND pl.project_id = ? AND pl.removed_at IS NULL
       ORDER BY l.id ASC`,
      [project_id]
    );
    const results = [];
    for (const l of labour as Array<{ id: number; daily_wage: number }>) {
      const existing = await queryGet<{ id: number }>(
        "SELECT id FROM attendance WHERE project_id = ? AND labour_id = ? AND date = ?",
        [project_id, l.id, date]
      );
      if (existing) {
        await dbExec(
          "UPDATE attendance SET status = 'present', wage_for_day = ? WHERE id = ?",
          [l.daily_wage ?? 0, existing.id]
        );
        results.push({ labour_id: l.id, updated: true });
      } else {
        await dbInsert(
          "INSERT INTO attendance (project_id, labour_id, date, status, wage_for_day, created_at) VALUES (?, ?, ?, 'present', ?, ?)",
          [project_id, l.id, date, l.daily_wage ?? 0, now]
        );
        results.push({ labour_id: l.id, inserted: true });
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
    const labour = await queryAll(
      `SELECT l.id FROM labour l
       JOIN project_labour pl ON pl.labour_id = l.id AND pl.project_id = ? AND pl.removed_at IS NULL
       ORDER BY l.id ASC`,
      [project_id]
    );
    const results = [];
    for (const l of labour as Array<{ id: number }>) {
      const existing = await queryGet<{ id: number }>(
        "SELECT id FROM attendance WHERE project_id = ? AND labour_id = ? AND date = ?",
        [project_id, l.id, date]
      );
      if (existing) {
        await dbExec(
          "UPDATE attendance SET status = 'absent', wage_for_day = 0 WHERE id = ?",
          [existing.id]
        );
        results.push({ labour_id: l.id, updated: true });
      } else {
        await dbInsert(
          "INSERT INTO attendance (project_id, labour_id, date, status, wage_for_day, created_at) VALUES (?, ?, ?, 'absent', 0, ?)",
          [project_id, l.id, date, now]
        );
        results.push({ labour_id: l.id, inserted: true });
      }
    }
    res.json({ success: true, data: results, count: results.length });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

export default router;
