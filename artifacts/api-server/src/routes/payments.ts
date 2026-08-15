import { Router } from "express";
import { validateBody } from "../lib/validate.js";
import { insertOwnerPaymentSchema } from "@workspace/db/schema";

import { queryGet, queryAll, dbExec, dbInsert, getPKT, getPKTDate } from "../lib/db.js";

const router = Router();

// ============ OWNER PAYMENTS ============

router.get("/owner", async (req, res) => {
  try {
    const { project_id, start_date, end_date, page: pageStr, limit: limitStr } = req.query as Record<string, string>;
    const page = Math.max(1, parseInt(pageStr || "1"));
    const limit = Math.max(1, Math.min(100, parseInt(limitStr || "30")));
    const offset = (page - 1) * limit;

    let baseSql = "FROM owner_payments WHERE 1=1";
    const params: unknown[] = [];
    if (project_id) { baseSql += " AND project_id = ?"; params.push(project_id); }
    if (start_date) { baseSql += " AND date >= ?"; params.push(start_date); }
    if (end_date) { baseSql += " AND date <= ?"; params.push(end_date); }

    const countRes = await queryGet<{ count: string }>(`SELECT COUNT(*) as count ${baseSql}`, params);
    const total = parseInt(countRes?.count ?? "0");

    const rows = await queryAll(`SELECT * ${baseSql} ORDER BY date DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    const totalRec = await queryGet<{ sum: string }>(
      "SELECT COALESCE(SUM(amount), 0) as sum FROM owner_payments" + (project_id ? " WHERE project_id = $1" : ""),
      project_id ? [project_id] : []
    );
    res.json({
      success: true,
      data: rows,
      total_received: parseFloat(totalRec?.sum ?? "0"),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.post("/owner", validateBody(insertOwnerPaymentSchema), async (req, res) => {
  try {
    const { project_id, date, amount, payment_method = "cash", receipt_photo, notes } = req.body as Record<string, unknown>;
    if (!project_id || !date || amount === undefined) {
      return res.status(400).json({ success: false, error: "project_id, date, amount required" });
    }
    const now = getPKT();
    const { id } = await dbInsert(
      "INSERT INTO owner_payments (project_id, date, amount, payment_method, receipt_photo, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [project_id, date, parseFloat(String(amount)), payment_method, receipt_photo ?? null, notes ?? null, now]
    );
    const row = await queryGet("SELECT * FROM owner_payments WHERE id = ?", [id]);
    res.status(201).json({ success: true, data: row });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.put("/owner/:id", validateBody(insertOwnerPaymentSchema.partial()), async (req, res) => {
  try {
    const row = await queryGet("SELECT id FROM owner_payments WHERE id = ?", [req.params.id]);
    if (!row) return res.status(404).json({ success: false, error: "Payment not found" });
    const fields = ["date", "amount", "payment_method", "receipt_photo", "notes"];
    const setClauses: string[] = [];
    const vals: unknown[] = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) { setClauses.push(`${f} = ?`); vals.push(req.body[f]); }
    }
    if (setClauses.length === 0) return res.status(400).json({ success: false, error: "Nothing to update" });
    vals.push(req.params.id);
    await dbExec(`UPDATE owner_payments SET ${setClauses.join(", ")} WHERE id = ?`, vals);
    const updated = await queryGet("SELECT * FROM owner_payments WHERE id = ?", [req.params.id]);
    res.json({ success: true, data: updated });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.delete("/owner/:id", async (req, res) => {
  try {
    await dbExec("DELETE FROM owner_payments WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: "Payment deleted" });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

// ============ WEEKLY PAYMENTS ============

router.get("/weekly", async (req, res) => {
  try {
    const { project_id, labour_id, week_start, is_paid, limit = "100", offset = "0" } = req.query as Record<string, string>;
    let sql = `SELECT wp.*, l.name as labour_name, l.phone as labour_phone
               FROM weekly_payments wp JOIN labour l ON l.id = wp.labour_id WHERE 1=1`;
    const params: unknown[] = [];
    if (project_id) { sql += " AND wp.project_id = ?"; params.push(project_id); }
    if (labour_id) { sql += " AND wp.labour_id = ?"; params.push(labour_id); }
    if (week_start) { sql += " AND wp.week_start = ?"; params.push(week_start); }
    if (is_paid !== undefined) { sql += " AND wp.is_paid = ?"; params.push(is_paid); }
    sql += " ORDER BY wp.week_start DESC LIMIT ? OFFSET ?";
    params.push(parseInt(limit), parseInt(offset));
    const rows = await queryAll<Record<string, unknown>>(sql, params);
    const parsed = rows.map((r) => ({ ...r, breakdown: r.breakdown ? JSON.parse(String(r.breakdown)) : [] }));
    res.json({ success: true, data: parsed });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.post("/weekly/generate", async (req, res) => {
  try {
    const { project_id, week_start, week_end } = req.body as { project_id: number; week_start: string; week_end: string };
    if (!project_id || !week_start || !week_end) {
      return res.status(400).json({ success: false, error: "project_id, week_start, week_end required" });
    }
    // Labourers assigned to the selected project (may also work on other projects)
    const assigned = await queryAll<{ id: number }>(
      "SELECT l.id FROM project_labour pl JOIN labour l ON l.id = pl.labour_id WHERE pl.project_id = ? AND pl.removed_at IS NULL",
      [project_id]
    );
    const now = getPKT();

    // Previous week range (7 days before week_start)
    const prevWeekEnd = new Date(week_start);
    prevWeekEnd.setDate(prevWeekEnd.getDate() - 1);
    const prevWeekEndStr = prevWeekEnd.toISOString().split("T")[0];
    const prevWeekStart = new Date(prevWeekEnd);
    prevWeekStart.setDate(prevWeekEnd.getDate() - 6);
    const prevWeekStartStr = prevWeekStart.toISOString().split("T")[0];

    // Carry-forward: previous week's unpaid remaining across ALL projects for each labourer
    const prevPayments = await queryAll<{ labour_id: number; bal: number }>(
      `SELECT labour_id, COALESCE(SUM(CASE WHEN is_paid = 0 AND remaining > 0 THEN remaining ELSE 0 END), 0) as bal
       FROM weekly_payments WHERE week_start = ? GROUP BY labour_id`,
      [prevWeekStartStr]
    );
    const prevBalMap: Record<number, number> = {};
    for (const pp of prevPayments) prevBalMap[pp.labour_id] = Number(pp.bal ?? 0);

    const results = [];

    for (const l of assigned) {
      // Attendance across ALL projects for this labourer in the week
      const attendance = await queryAll<{ project_id: number; project_name: string; status: string; advance_given: number; wage_for_day: number }>(
        `SELECT a.project_id, p.name as project_name, a.status, a.advance_given, a.wage_for_day
         FROM attendance a JOIN projects p ON p.id = a.project_id
         WHERE a.labour_id = ? AND a.date >= ? AND a.date <= ?
         ORDER BY a.project_id, a.date`,
        [l.id, week_start, week_end]
      );

      // Per-project breakdown
      const byProject: Record<string, { project_id: number; project_name: string; days_worked: number; half_days: number; total_earned: number; advance_total: number }> = {};
      let daysWorked = 0;
      let halfDays = 0;
      let advanceTotal = 0;
      let totalEarned = 0;
      for (const a of attendance) {
        const key = String(a.project_id);
        if (!byProject[key]) {
          byProject[key] = { project_id: a.project_id, project_name: a.project_name, days_worked: 0, half_days: 0, total_earned: 0, advance_total: 0 };
        }
        const b = byProject[key];
        if (a.status === "present") { daysWorked += 1; b.days_worked += 1; }
        else if (a.status === "half_day") { daysWorked += 0.5; halfDays += 1; b.days_worked += 0.5; b.half_days += 1; }
        b.total_earned += Number(a.wage_for_day ?? 0);
        b.advance_total += Number(a.advance_given ?? 0);
        advanceTotal += Number(a.advance_given ?? 0);
        totalEarned += Number(a.wage_for_day ?? 0);
      }
      const breakdown = Object.values(byProject);

      const previousBalance = prevBalMap[l.id] ?? 0;
      const remaining = totalEarned - advanceTotal - previousBalance;

      const existing = await queryGet(
        "SELECT id FROM weekly_payments WHERE project_id = ? AND labour_id = ? AND week_start = ?",
        [project_id, l.id, week_start]
      );
      if (existing) {
        await dbExec(
          "UPDATE weekly_payments SET days_worked=?, half_days=?, total_earned=?, advance_total=?, previous_balance=?, remaining=?, breakdown=? WHERE project_id=? AND labour_id=? AND week_start=?",
          [daysWorked, halfDays, totalEarned, advanceTotal, previousBalance, remaining, JSON.stringify(breakdown), project_id, l.id, week_start]
        );
        results.push({ labour_id: l.id, updated: true });
      } else {
        await dbInsert(
          "INSERT INTO weekly_payments (project_id, labour_id, week_start, week_end, days_worked, half_days, total_earned, advance_total, previous_balance, amount_paid, remaining, is_paid, breakdown, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?, ?)",
          [project_id, l.id, week_start, week_end, daysWorked, halfDays, totalEarned, advanceTotal, previousBalance, remaining, JSON.stringify(breakdown), now]
        );
        results.push({ labour_id: l.id, created: true });
      }
    }
    const payments = await queryAll<Record<string, unknown>>(
      `SELECT wp.*, l.name as labour_name FROM weekly_payments wp JOIN labour l ON l.id=wp.labour_id WHERE wp.project_id=? AND wp.week_start=?`,
      [project_id, week_start]
    );
    const parsed = payments.map((p) => ({ ...p, breakdown: p.breakdown ? JSON.parse(String(p.breakdown)) : [] }));
    res.json({ success: true, data: parsed, count: results.length });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.put("/weekly/:id/pay", async (req, res) => {
  try {
    const { amount_paid, remarks } = req.body as { amount_paid: number; remarks?: string };
    const wp = await queryGet<{ total_earned: number; advance_total: number; previous_balance: number }>(
      "SELECT * FROM weekly_payments WHERE id = ?", [req.params.id]
    );
    if (!wp) return res.status(404).json({ success: false, error: "Payment not found" });
    const remaining = (wp.total_earned ?? 0) - (wp.advance_total ?? 0) - (wp.previous_balance ?? 0) - (amount_paid ?? 0);
    await dbExec(
      "UPDATE weekly_payments SET amount_paid = ?, remaining = ?, is_paid = 1, paid_at = ?, remarks = ? WHERE id = ?",
      [amount_paid, remaining, getPKT(), remarks ?? null, req.params.id]
    );
    const updated = await queryGet("SELECT * FROM weekly_payments WHERE id = ?", [req.params.id]);
    res.json({ success: true, data: updated });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.put("/weekly/:id", async (req, res) => {
  try {
    const row = await queryGet("SELECT id FROM weekly_payments WHERE id = ?", [req.params.id]);
    if (!row) return res.status(404).json({ success: false, error: "Payment not found" });
    const fields = ["days_worked", "half_days", "total_earned", "advance_total", "previous_balance", "amount_paid", "remaining", "is_paid", "paid_at", "remarks"];
    const setClauses: string[] = [];
    const vals: unknown[] = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) { setClauses.push(`${f} = ?`); vals.push(req.body[f]); }
    }
    if (setClauses.length === 0) return res.status(400).json({ success: false, error: "Nothing to update" });
    vals.push(req.params.id);
    await dbExec(`UPDATE weekly_payments SET ${setClauses.join(", ")} WHERE id = ?`, vals);
    const updated = await queryGet("SELECT * FROM weekly_payments WHERE id = ?", [req.params.id]);
    res.json({ success: true, data: updated });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

export default router;
