import { Router } from "express";
import { queryGet, queryAll, dbExec, dbInsert, getPKT, getPKTDate } from "../lib/db.js";

const router = Router();

function generateProjectCode(year: string, lastCode: string | null): string {
  let seq = 1;
  if (lastCode) {
    const parts = lastCode.split("-");
    if (parts.length === 3) seq = parseInt(parts[2]) + 1;
  }
  return `HK-${year}-${String(seq).padStart(3, "0")}`;
}

router.get("/", async (req, res) => {
  try {
    const { status, search, limit = "50", offset = "0" } = req.query as Record<string, string>;
    let sql = "SELECT * FROM projects WHERE 1=1";
    const params: unknown[] = [];
    if (status) { sql += " AND status = ?"; params.push(status); }
    if (search) {
      const s = `%${search}%`;
      sql += " AND (name ILIKE ? OR owner_name ILIKE ? OR location ILIKE ? OR project_code ILIKE ?)";
      params.push(s, s, s, s);
    }
    sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(parseInt(limit), parseInt(offset));
    const projects = await queryAll(sql, params);
    const total = await queryGet<{ count: string }>("SELECT COUNT(*) as count FROM projects WHERE 1=1" + (status ? " AND status = ?" : ""), status ? [status] : []);
    res.json({ success: true, data: projects, total: parseInt(total?.count ?? "0") });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.get("/:id", async (req, res) => {
  try {
    const project = await queryGet("SELECT * FROM projects WHERE id = ?", [req.params.id]);
    if (!project) return res.status(404).json({ success: false, error: "Project not found" });
    const stats = await getProjectStats(Number(req.params.id));
    res.json({ success: true, data: { ...project, stats } });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.post("/", async (req, res) => {
  try {
    const { name, status = "running", owner_name, owner_phone, owner_cnic, location, site_address, agreement_amount, start_date, expected_end, notes } = req.body as Record<string, string>;
    if (!name || !owner_name || !location) return res.status(400).json({ success: false, error: "name, owner_name, location required" });
    const year = start_date ? start_date.substring(0, 4) : new Date().getFullYear().toString();
    const lastCode = await queryGet<{ project_code: string }>(
      "SELECT project_code FROM projects WHERE project_code LIKE ? ORDER BY project_code DESC LIMIT 1",
      [`HK-${year}-%`]
    );
    const project_code = generateProjectCode(year, lastCode?.project_code ?? null);
    const now = getPKT();
    const { id } = await dbInsert(
      "INSERT INTO projects (project_code, name, status, owner_name, owner_phone, owner_cnic, location, site_address, agreement_amount, start_date, expected_end, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [project_code, name, status, owner_name, owner_phone ?? null, owner_cnic ?? null, location, site_address ?? null, agreement_amount ? parseFloat(agreement_amount) : null, start_date ?? null, expected_end ?? null, notes ?? null, now, now]
    );
    const project = await queryGet("SELECT * FROM projects WHERE id = ?", [id]);
    res.status(201).json({ success: true, data: project });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.put("/:id", async (req, res) => {
  try {
    const project = await queryGet("SELECT id FROM projects WHERE id = ?", [req.params.id]);
    if (!project) return res.status(404).json({ success: false, error: "Project not found" });
    const fields = ["name", "status", "owner_name", "owner_phone", "owner_cnic", "location", "site_address", "agreement_amount", "start_date", "expected_end", "notes"];
    const setClauses: string[] = [];
    const vals: unknown[] = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) { setClauses.push(`${f} = ?`); vals.push(req.body[f]); }
    }
    if (setClauses.length === 0) return res.status(400).json({ success: false, error: "Nothing to update" });
    setClauses.push("updated_at = ?");
    vals.push(getPKT());
    vals.push(req.params.id);
    await dbExec(`UPDATE projects SET ${setClauses.join(", ")} WHERE id = ?`, vals);
    const updated = await queryGet("SELECT * FROM projects WHERE id = ?", [req.params.id]);
    res.json({ success: true, data: updated });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.delete("/:id", async (req, res) => {
  try {
    const project = await queryGet("SELECT id FROM projects WHERE id = ?", [req.params.id]);
    if (!project) return res.status(404).json({ success: false, error: "Project not found" });
    await dbExec("DELETE FROM projects WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: "Project deleted" });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.get("/:id/stats", async (req, res) => {
  try {
    const stats = await getProjectStats(Number(req.params.id));
    res.json({ success: true, data: stats });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.get("/:id/summary", async (req, res) => {
  try {
    const project = await queryGet("SELECT * FROM projects WHERE id = ?", [req.params.id]);
    if (!project) return res.status(404).json({ success: false, error: "Project not found" });
    const stats = await getProjectStats(Number(req.params.id));
    const labourCost = await queryGet<{ total: string }>(
      "SELECT COALESCE(SUM(wage_for_day), 0) as total FROM attendance WHERE project_id = ?", [req.params.id]
    );
    const expenseTotal = await queryGet<{ total: string }>(
      "SELECT COALESCE(SUM(amount), 0) as total FROM daily_expenses WHERE project_id = ?", [req.params.id]
    );
    const materialTotal = await queryGet<{ total: string }>(
      "SELECT COALESCE(SUM(total_cost), 0) as total FROM materials WHERE project_id = ?", [req.params.id]
    );
    res.json({
      success: true,
      data: {
        project,
        stats,
        financials: {
          agreement_amount: (project as Record<string, unknown>).agreement_amount ?? 0,
          received: stats.total_received,
          labour_cost: parseFloat(labourCost?.total ?? "0"),
          expenses: parseFloat(expenseTotal?.total ?? "0"),
          materials: parseFloat(materialTotal?.total ?? "0"),
        }
      }
    });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

async function getProjectStats(projectId: number) {
  const labourCount = await queryGet<{ count: string }>(
    "SELECT COUNT(*) as count FROM project_labour WHERE project_id = ? AND removed_at IS NULL", [projectId]
  );
  const payments = await queryGet<{ total: string }>(
    "SELECT COALESCE(SUM(amount), 0) as total FROM owner_payments WHERE project_id = ?", [projectId]
  );
  const attendance = await queryGet<{ total_days: string; present_days: string; half_days: string }>(
    "SELECT COUNT(*) as total_days, SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) as present_days, SUM(CASE WHEN status='half_day' THEN 0.5 ELSE 0 END) as half_days FROM attendance WHERE project_id = ?",
    [projectId]
  );
  // Labour wages: compute from project_labour daily_wage × attendance
  const wagesRow = await queryGet<{ total: string }>(
    `SELECT COALESCE(SUM(COALESCE(a.wage_for_day, 0)), 0) as total
     FROM attendance a
     WHERE a.project_id = ?`,
    [projectId]
  );
  const expensesRow = await queryGet<{ total: string }>(
    "SELECT COALESCE(SUM(amount), 0) as total FROM daily_expenses WHERE project_id = ?", [projectId]
  );
  const materialsRow = await queryGet<{ total: string }>(
    "SELECT COALESCE(SUM(total_cost), 0) as total FROM materials WHERE project_id = ?", [projectId]
  );
  const equipmentRow = await queryGet<{ total: string }>(
    "SELECT COALESCE(SUM(price), 0) as total FROM equipment WHERE project_id = ? AND is_active = 1", [projectId]
  );
  return {
    labour_count: parseInt(labourCount?.count ?? "0"),
    total_received: parseFloat(payments?.total ?? "0"),
    total_attendance_days: parseInt(attendance?.total_days ?? "0"),
    present_days: parseInt(attendance?.present_days ?? "0"),
    half_days: parseFloat(attendance?.half_days ?? "0"),
    total_wages: parseFloat(wagesRow?.total ?? "0"),
    total_expenses: parseFloat(expensesRow?.total ?? "0"),
    total_materials: parseFloat(materialsRow?.total ?? "0"),
    total_equipment: parseFloat(equipmentRow?.total ?? "0"),
  };
}

export default router;
