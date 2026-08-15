import { Router } from "express";
import { queryGet, queryAll, dbExec, dbInsert, getPKT } from "../lib/db.js";

const EQUIPMENT_TYPES = ["Excavator","Crane","Concrete Mixer","Concrete Pump","Compactor","Generator","Scaffolding","Bulldozer","Loader","Truck","Water Pump","Drill","Other"];
const router = Router();

// Map DB row → frontend shape
function toFrontend(row: Record<string, unknown>) {
  return {
    ...row,
    equipment_name: row.name,
    operator_name: row.custom_name ?? "",
    rental_days: row.quantity ?? 1,
    daily_rate: row.condition_note ? parseFloat(String(row.condition_note)) : 0,
    total_cost: row.price ?? 0,
    date: row.purchase_date ?? "",
  };
}

router.get("/", async (req, res) => {
  try {
    const { project_id, active } = req.query as Record<string, string>;
    let sql = "SELECT * FROM equipment WHERE 1=1";
    const params: unknown[] = [];
    if (project_id) { sql += " AND project_id = ?"; params.push(project_id); }
    if (active !== undefined) { sql += " AND is_active = ?"; params.push(active); }
    sql += " ORDER BY created_at DESC";
    const rows = await queryAll<Record<string, unknown>>(sql, params);
    res.json({ success: true, data: rows.map(toFrontend) });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.get("/:id", async (req, res) => {
  try {
    const row = await queryGet<Record<string, unknown>>("SELECT * FROM equipment WHERE id = ?", [req.params.id]);
    if (!row) return res.status(404).json({ success: false, error: "Equipment not found" });
    res.json({ success: true, data: toFrontend(row) });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.post("/", async (req, res) => {
  try {
    const { project_id, equipment_name, operator_name, rental_days = 1, daily_rate, total_cost, date, notes, remarks } = req.body as Record<string, unknown>;
    if (!project_id || !equipment_name || daily_rate === undefined) {
      return res.status(400).json({ success: false, error: "project_id, equipment_name, daily_rate required" });
    }
    const days = parseFloat(String(rental_days));
    const rate = parseFloat(String(daily_rate));
    const computedTotal = total_cost !== undefined ? parseFloat(String(total_cost)) : days * rate;
    const now = getPKT();
    const { id } = await dbInsert(
      "INSERT INTO equipment (project_id, name, custom_name, quantity, price, condition_note, purchase_date, remarks, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)",
      [project_id, equipment_name, operator_name ?? null, days, computedTotal, String(rate), date ?? null, (notes ?? remarks) ?? null, now]
    );
    const row = await queryGet<Record<string, unknown>>("SELECT * FROM equipment WHERE id = ?", [id]);
    res.status(201).json({ success: true, data: toFrontend(row!) });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.put("/:id", async (req, res) => {
  try {
    const row = await queryGet("SELECT id FROM equipment WHERE id = ?", [req.params.id]);
    if (!row) return res.status(404).json({ success: false, error: "Equipment not found" });
    const { equipment_name, operator_name, rental_days, daily_rate, total_cost, date, notes, remarks, is_active } = req.body as Record<string, unknown>;
    const setClauses: string[] = [];
    const vals: unknown[] = [];
    if (equipment_name !== undefined) { setClauses.push("name = ?"); vals.push(equipment_name); }
    if (operator_name !== undefined) { setClauses.push("custom_name = ?"); vals.push(operator_name); }
    if (rental_days !== undefined) { setClauses.push("quantity = ?"); vals.push(parseFloat(String(rental_days))); }
    if (daily_rate !== undefined) { setClauses.push("condition_note = ?"); vals.push(String(daily_rate)); }
    if (total_cost !== undefined) { setClauses.push("price = ?"); vals.push(parseFloat(String(total_cost))); }
    else if (rental_days !== undefined && daily_rate !== undefined) {
      setClauses.push("price = ?"); vals.push(parseFloat(String(rental_days)) * parseFloat(String(daily_rate)));
    }
    if (date !== undefined) { setClauses.push("purchase_date = ?"); vals.push(date); }
    if ((notes ?? remarks) !== undefined) { setClauses.push("remarks = ?"); vals.push(notes ?? remarks); }
    if (is_active !== undefined) { setClauses.push("is_active = ?"); vals.push(is_active); }
    if (setClauses.length === 0) return res.status(400).json({ success: false, error: "Nothing to update" });
    vals.push(req.params.id);
    await dbExec(`UPDATE equipment SET ${setClauses.join(", ")} WHERE id = ?`, vals);
    const updated = await queryGet<Record<string, unknown>>("SELECT * FROM equipment WHERE id = ?", [req.params.id]);
    res.json({ success: true, data: toFrontend(updated!) });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.delete("/:id", async (req, res) => {
  try {
    await dbExec("UPDATE equipment SET is_active = 0 WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: "Equipment deactivated" });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

export default router;
