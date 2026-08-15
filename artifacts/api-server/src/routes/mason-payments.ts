import { Router } from "express";
import { queryGet, queryAll, dbExec, dbInsert, getPKT } from "../lib/db.js";

const router = Router();

// ============ MASON WEEKLY PAYMENTS ============

router.get("/weekly", async (req, res) => {
  try {
    const { project_id, mason_id, week_start, is_paid, limit = "100", offset = "0" } = req.query as Record<string, string>;
    let sql = `SELECT wp.*, m.name as mason_name, m.phone as mason_phone
               FROM mason_weekly_payments wp JOIN mason m ON m.id = wp.mason_id WHERE 1=1`;
    const params: unknown[] = [];
    if (project_id) { sql += " AND wp.project_id = ?"; params.push(project_id); }
    if (mason_id) { sql += " AND wp.mason_id = ?"; params.push(mason_id); }
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
    // Masons assigned to the selected project (may also work on other projects)
    const assigned = await queryAll<{ id: number }>(
      "SELECT m.id FROM project_mason pm JOIN mason m ON m.id = pm.mason_id WHERE pm.project_id = ? AND pm.removed_at IS NULL",
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

    // Carry-forward: previous week's unpaid remaining across ALL projects for each mason
    const prevPayments = await queryAll<{ mason_id: number; bal: number }>(
      `SELECT mason_id, COALESCE(SUM(CASE WHEN is_paid = 0 AND remaining > 0 THEN remaining ELSE 0 END), 0) as bal
       FROM mason_weekly_payments WHERE week_start = ? GROUP BY mason_id`,
      [prevWeekStartStr]
    );
    const prevBalMap: Record<number, number> = {};
    for (const pp of prevPayments) prevBalMap[pp.mason_id] = Number(pp.bal ?? 0);

    const results = [];

    for (const m of assigned) {
      // Attendance across ALL projects for this mason in the week
      const attendance = await queryAll<{ project_id: number; project_name: string; status: string; advance_given: number; wage_for_day: number }>(
        `SELECT a.project_id, p.name as project_name, a.status, a.advance_given, a.wage_for_day
         FROM mason_attendance a JOIN projects p ON p.id = a.project_id
         WHERE a.mason_id = ? AND a.date >= ? AND a.date <= ?
         ORDER BY a.project_id, a.date`,
        [m.id, week_start, week_end]
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

      const previousBalance = prevBalMap[m.id] ?? 0;
      const remaining = totalEarned - advanceTotal - previousBalance;

      const existing = await queryGet(
        "SELECT id FROM mason_weekly_payments WHERE project_id = ? AND mason_id = ? AND week_start = ?",
        [project_id, m.id, week_start]
      );
      if (existing) {
        await dbExec(
          "UPDATE mason_weekly_payments SET days_worked=?, half_days=?, total_earned=?, advance_total=?, previous_balance=?, remaining=?, breakdown=? WHERE project_id=? AND mason_id=? AND week_start=?",
          [daysWorked, halfDays, totalEarned, advanceTotal, previousBalance, remaining, JSON.stringify(breakdown), project_id, m.id, week_start]
        );
        results.push({ mason_id: m.id, updated: true });
      } else {
        await dbInsert(
          "INSERT INTO mason_weekly_payments (project_id, mason_id, week_start, week_end, days_worked, half_days, total_earned, advance_total, previous_balance, amount_paid, remaining, is_paid, breakdown, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?, ?)",
          [project_id, m.id, week_start, week_end, daysWorked, halfDays, totalEarned, advanceTotal, previousBalance, remaining, JSON.stringify(breakdown), now]
        );
        results.push({ mason_id: m.id, created: true });
      }
    }
    const payments = await queryAll<Record<string, unknown>>(
      `SELECT wp.*, m.name as mason_name FROM mason_weekly_payments wp JOIN mason m ON m.id=wp.mason_id WHERE wp.project_id=? AND wp.week_start=?`,
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
      "SELECT * FROM mason_weekly_payments WHERE id = ?", [req.params.id]
    );
    if (!wp) return res.status(404).json({ success: false, error: "Payment not found" });
    const remaining = (wp.total_earned ?? 0) - (wp.advance_total ?? 0) - (wp.previous_balance ?? 0) - (amount_paid ?? 0);
    await dbExec(
      "UPDATE mason_weekly_payments SET amount_paid = ?, remaining = ?, is_paid = 1, paid_at = ?, remarks = ? WHERE id = ?",
      [amount_paid, remaining, getPKT(), remarks ?? null, req.params.id]
    );
    const updated = await queryGet("SELECT * FROM mason_weekly_payments WHERE id = ?", [req.params.id]);
    res.json({ success: true, data: updated });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.put("/weekly/:id", async (req, res) => {
  try {
    const row = await queryGet("SELECT id FROM mason_weekly_payments WHERE id = ?", [req.params.id]);
    if (!row) return res.status(404).json({ success: false, error: "Payment not found" });
    const fields = ["days_worked", "half_days", "total_earned", "advance_total", "previous_balance", "amount_paid", "remaining", "is_paid", "paid_at", "remarks"];
    const setClauses: string[] = [];
    const vals: unknown[] = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) { setClauses.push(`${f} = ?`); vals.push(req.body[f]); }
    }
    if (setClauses.length === 0) return res.status(400).json({ success: false, error: "Nothing to update" });
    vals.push(req.params.id);
    await dbExec(`UPDATE mason_weekly_payments SET ${setClauses.join(", ")} WHERE id = ?`, vals);
    const updated = await queryGet("SELECT * FROM mason_weekly_payments WHERE id = ?", [req.params.id]);
    res.json({ success: true, data: updated });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

export default router;
