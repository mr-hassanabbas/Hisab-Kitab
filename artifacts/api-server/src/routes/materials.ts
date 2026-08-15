import { Router } from "express";
import { validateBody } from "../lib/validate.js";
import { insertMaterialSchema } from "@workspace/db/schema";

import { queryGet, queryAll, dbExec, dbInsert, getPKT } from "../lib/db.js";

const MATERIAL_TYPES = ["cement","sand","steel","bricks","crush","paint","tiles","electric_wire","pvc_pipe","marble","other"];
const router = Router();

// Map DB row → frontend shape (description / rate_per_unit / supplier / notes)
function toFrontend(row: Record<string, unknown>) {
  return {
    ...row,
    description: row.custom_name ?? "",
    rate_per_unit: row.rate ?? 0,
    supplier: row.supplier ?? "",
    notes: row.remarks ?? "",
  };
}

router.get("/", async (req, res) => {
  try {
    const { project_id, date, start_date, end_date, material_type, page: pageStr, limit: limitStr } = req.query as Record<string, string>;
    const page = Math.max(1, parseInt(pageStr || "1"));
    const limit = Math.max(1, Math.min(100, parseInt(limitStr || "30")));
    const offset = (page - 1) * limit;

    let baseSql = "FROM materials WHERE 1=1";
    const params: unknown[] = [];
    if (project_id) { baseSql += " AND project_id = ?"; params.push(project_id); }
    if (date) { baseSql += " AND date = ?"; params.push(date); }
    if (start_date) { baseSql += " AND date >= ?"; params.push(start_date); }
    if (end_date) { baseSql += " AND date <= ?"; params.push(end_date); }
    if (material_type) { baseSql += " AND material_type = ?"; params.push(material_type); }

    const countRes = await queryGet<{ count: string }>(`SELECT COUNT(*) as count ${baseSql}`, params);
    const total = parseInt(countRes?.count ?? "0");

    const rows = await queryAll<Record<string, unknown>>(`SELECT * ${baseSql} ORDER BY date DESC, id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    const totalCost = await queryGet<{ sum: string }>(
      "SELECT COALESCE(SUM(total_cost), 0) as sum FROM materials WHERE project_id = ?",
      project_id ? [project_id] : [0]
    );
    res.json({
      success: true,
      data: rows.map(toFrontend),
      total_cost: parseFloat(totalCost?.sum ?? "0"),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.get("/summary", async (req, res) => {
  try {
    const { project_id, start_date, end_date } = req.query as Record<string, string>;
    if (!project_id) return res.status(400).json({ success: false, error: "project_id required" });
    let sql = "SELECT material_type, COALESCE(SUM(total_cost), 0) as total_cost, COALESCE(SUM(quantity), 0) as total_qty, COUNT(*) as count FROM materials WHERE project_id = ?";
    const params: unknown[] = [project_id];
    if (start_date) { sql += " AND date >= ?"; params.push(start_date); }
    if (end_date) { sql += " AND date <= ?"; params.push(end_date); }
    sql += " GROUP BY material_type ORDER BY total_cost DESC";
    const rows = await queryAll(sql, params);
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.get("/:id", async (req, res) => {
  try {
    const row = await queryGet<Record<string, unknown>>("SELECT * FROM materials WHERE id = ?", [req.params.id]);
    if (!row) return res.status(404).json({ success: false, error: "Material not found" });
    res.json({ success: true, data: toFrontend(row) });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.post("/", validateBody(insertMaterialSchema), async (req, res) => {
  try {
    const { project_id, date, material_type, description, quantity, unit = "bags", rate_per_unit, supplier, notes } = req.body as Record<string, unknown>;
    if (!project_id || !date || !material_type || quantity === undefined || rate_per_unit === undefined) {
      return res.status(400).json({ success: false, error: "project_id, date, material_type, quantity, rate required" });
    }
    const qty = parseFloat(String(quantity));
    const r = parseFloat(String(rate_per_unit));
    const total_cost = qty * r;
    const now = getPKT();
    const { id } = await dbInsert(
      "INSERT INTO materials (project_id, date, material_type, custom_name, quantity, unit, rate, total_cost, supplier, remarks, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [project_id, date, material_type, description ?? null, qty, unit, r, total_cost, supplier ?? null, notes ?? null, now]
    );
    const row = await queryGet<Record<string, unknown>>("SELECT * FROM materials WHERE id = ?", [id]);
    res.status(201).json({ success: true, data: toFrontend(row!) });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.put("/:id", validateBody(insertMaterialSchema.partial()), async (req, res) => {
  try {
    const existing = await queryGet<{ quantity: number; rate: number }>("SELECT * FROM materials WHERE id = ?", [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: "Material not found" });
    const { description, quantity, rate_per_unit, supplier, notes } = req.body as Record<string, unknown>;
    const setClauses: string[] = [];
    const vals: unknown[] = [];
    if (description !== undefined) { setClauses.push("custom_name = ?"); vals.push(description); }
    if (quantity !== undefined) { setClauses.push("quantity = ?"); vals.push(parseFloat(String(quantity))); }
    if (rate_per_unit !== undefined) { setClauses.push("rate = ?"); vals.push(parseFloat(String(rate_per_unit))); }
    if (supplier !== undefined) { setClauses.push("supplier = ?"); vals.push(supplier); }
    if (notes !== undefined) { setClauses.push("remarks = ?"); vals.push(notes); }
    for (const f of ["date", "material_type", "unit"]) {
      if (req.body[f] !== undefined) { setClauses.push(`${f} = ?`); vals.push(req.body[f]); }
    }
    const qty = quantity !== undefined ? parseFloat(String(quantity)) : existing.quantity;
    const r = rate_per_unit !== undefined ? parseFloat(String(rate_per_unit)) : existing.rate;
    setClauses.push("total_cost = ?");
    vals.push(qty * r);
    vals.push(req.params.id);
    await dbExec(`UPDATE materials SET ${setClauses.join(", ")} WHERE id = ?`, vals);
    const updated = await queryGet<Record<string, unknown>>("SELECT * FROM materials WHERE id = ?", [req.params.id]);
    res.json({ success: true, data: toFrontend(updated!) });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.delete("/:id", async (req, res) => {
  try {
    await dbExec("DELETE FROM materials WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: "Material deleted" });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

export default router;
