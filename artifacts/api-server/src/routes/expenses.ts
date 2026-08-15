import { Router } from "express";
import { validateBody } from "../lib/validate.js";
import { insertExpenseSchema } from "@workspace/db/schema";

import { queryGet, queryAll, dbExec, dbInsert, getPKT, getPKTDate } from "../lib/db.js";

const EXPENSE_CATEGORIES = ["Food","Transport","Tools","Fuel","Labour (Extra)","Repair","Safety","Office","Utility","Other"];
const router = Router();

// Map DB row → frontend shape (description / paid_to / notes)
function toFrontend(row: Record<string, unknown>) {
  return {
    ...row,
    description: row.custom_name ?? "",
    paid_to: row.custom_name ?? "",
    notes: row.remarks ?? "",
  };
}

router.get("/", async (req, res) => {
  try {
    const { project_id, date, start_date, end_date, category, page: pageStr, limit: limitStr } = req.query as Record<string, string>;
    const page = Math.max(1, parseInt(pageStr || "1"));
    const limit = Math.max(1, Math.min(100, parseInt(limitStr || "30")));
    const offset = (page - 1) * limit;

    let baseSql = "FROM daily_expenses WHERE 1=1";
    const params: unknown[] = [];
    if (project_id) { baseSql += " AND project_id = ?"; params.push(project_id); }
    if (date) { baseSql += " AND date = ?"; params.push(date); }
    if (start_date) { baseSql += " AND date >= ?"; params.push(start_date); }
    if (end_date) { baseSql += " AND date <= ?"; params.push(end_date); }
    if (category) { baseSql += " AND category = ?"; params.push(category); }

    const countRes = await queryGet<{ count: string }>(`SELECT COUNT(*) as count ${baseSql}`, params);
    const total = parseInt(countRes?.count ?? "0");

    const rows = await queryAll<Record<string, unknown>>(`SELECT * ${baseSql} ORDER BY date DESC, id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    const totalAmt = await queryGet<{ sum: string }>(
      "SELECT COALESCE(SUM(amount), 0) as sum FROM daily_expenses WHERE 1=1" +
      (project_id ? " AND project_id = $1" : ""),
      project_id ? [project_id] : []
    );
    res.json({
      success: true,
      data: rows.map(toFrontend),
      total_amount: parseFloat(totalAmt?.sum ?? "0"),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.get("/summary", async (req, res) => {
  try {
    const { project_id, start_date, end_date } = req.query as Record<string, string>;
    if (!project_id) return res.status(400).json({ success: false, error: "project_id required" });
    let sql = "SELECT category, COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM daily_expenses WHERE project_id = ?";
    const params: unknown[] = [project_id];
    if (start_date) { sql += " AND date >= ?"; params.push(start_date); }
    if (end_date) { sql += " AND date <= ?"; params.push(end_date); }
    sql += " GROUP BY category ORDER BY total DESC";
    const rows = await queryAll(sql, params);
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.get("/:id", async (req, res) => {
  try {
    const row = await queryGet<Record<string, unknown>>("SELECT * FROM daily_expenses WHERE id = ?", [req.params.id]);
    if (!row) return res.status(404).json({ success: false, error: "Expense not found" });
    res.json({ success: true, data: toFrontend(row) });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.post("/", validateBody(insertExpenseSchema), async (req, res) => {
  try {
    const { project_id, date, category, description, paid_to, amount, notes } = req.body as Record<string, unknown>;
    if (!project_id || !date || !category || amount === undefined) {
      return res.status(400).json({ success: false, error: "project_id, date, category, amount required" });
    }
    if (!EXPENSE_CATEGORIES.includes(category as string)) {
      return res.status(400).json({ success: false, error: `category must be one of: ${EXPENSE_CATEGORIES.join(", ")}` });
    }
    const now = getPKT();
    const { id } = await dbInsert(
      "INSERT INTO daily_expenses (project_id, date, category, custom_name, amount, remarks, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [project_id, date, category, (description ?? paid_to) ?? null, parseFloat(String(amount)), notes ?? null, now]
    );
    const row = await queryGet<Record<string, unknown>>("SELECT * FROM daily_expenses WHERE id = ?", [id]);
    res.status(201).json({ success: true, data: toFrontend(row!) });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.put("/:id", validateBody(insertExpenseSchema.partial()), async (req, res) => {
  try {
    const row = await queryGet("SELECT id FROM daily_expenses WHERE id = ?", [req.params.id]);
    if (!row) return res.status(404).json({ success: false, error: "Expense not found" });
    const { description, paid_to, notes, amount } = req.body as Record<string, unknown>;
    const setClauses: string[] = [];
    const vals: unknown[] = [];
    const label = description ?? paid_to;
    if (label !== undefined) { setClauses.push("custom_name = ?"); vals.push(label); }
    if (amount !== undefined) { setClauses.push("amount = ?"); vals.push(parseFloat(String(amount))); }
    if (notes !== undefined) { setClauses.push("remarks = ?"); vals.push(notes); }
    for (const f of ["date", "category"]) {
      if (req.body[f] !== undefined) { setClauses.push(`${f} = ?`); vals.push(req.body[f]); }
    }
    if (setClauses.length === 0) return res.status(400).json({ success: false, error: "Nothing to update" });
    vals.push(req.params.id);
    await dbExec(`UPDATE daily_expenses SET ${setClauses.join(", ")} WHERE id = ?`, vals);
    const updated = await queryGet<Record<string, unknown>>("SELECT * FROM daily_expenses WHERE id = ?", [req.params.id]);
    res.json({ success: true, data: toFrontend(updated!) });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.delete("/:id", async (req, res) => {
  try {
    await dbExec("DELETE FROM daily_expenses WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: "Expense deleted" });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

export default router;
