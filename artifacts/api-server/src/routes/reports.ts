import { Router } from "express";
import { queryGet, queryAll, getPKTDate } from "../lib/db.js";
import { requireRole } from "../middlewares/auth.js";

const router = Router();

// Protect all report endpoints - only Admins can export/view financial reports
router.use(requireRole(["admin"]));

router.get("/project/:id", async (req, res) => {
  try {
    const project = await queryGet<Record<string, unknown>>("SELECT * FROM projects WHERE id = ?", [req.params.id]);
    if (!project) return res.status(404).json({ success: false, error: "Project not found" });
    const { start_date, end_date } = req.query as Record<string, string>;
    const sd = start_date ? `AND a.date >= '${start_date}'` : "";
    const ed = end_date ? `AND a.date <= '${end_date}'` : "";
    const sdp = start_date ? `AND date >= '${start_date}'` : "";
    const edp = end_date ? `AND date <= '${end_date}'` : "";

    const labour = await queryAll(
      `SELECT l.name, l.phone, pl.daily_wage,
              COUNT(CASE WHEN a.status='present' THEN 1 END) as present_days,
              COUNT(CASE WHEN a.status='half_day' THEN 1 END) as half_days,
              COUNT(CASE WHEN a.status='absent' THEN 1 END) as absent_days,
              COALESCE(SUM(COALESCE(a.wage_for_day, 0)), 0) as total_wages,
              COALESCE(SUM(a.advance_given), 0) as total_advance,
              COALESCE(SUM(a.overtime_hours), 0) as total_overtime_hours,
              COALESCE(SUM(a.overtime_pay), 0) as total_overtime_pay
       FROM project_labour pl
       JOIN labour l ON l.id = pl.labour_id
       LEFT JOIN attendance a ON a.labour_id = pl.labour_id AND a.project_id = pl.project_id ${sd} ${ed}
       WHERE pl.project_id = ?
       GROUP BY l.id, l.name, l.phone, pl.daily_wage`,
      [req.params.id]
    );

    const expenses = await queryAll(
      `SELECT category, COALESCE(SUM(amount), 0) as total FROM daily_expenses WHERE project_id = ? ${sdp} ${edp} GROUP BY category`,
      [req.params.id]
    );

    const materials = await queryAll(
      `SELECT material_type, COALESCE(SUM(total_cost), 0) as total_cost, COALESCE(SUM(quantity), 0) as total_qty
       FROM materials WHERE project_id = ? ${sdp} ${edp} GROUP BY material_type`,
      [req.params.id]
    );

    const equipment = await queryAll(
      `SELECT name as equipment_name, COALESCE(SUM(price), 0) as total_cost, COALESCE(SUM(quantity), 0) as total_days
       FROM equipment WHERE project_id = ? AND is_active = 1 ${sdp.replace(/AND date/g, "AND purchase_date")} ${edp.replace(/AND date/g, "AND purchase_date")}
       GROUP BY name`,
      [req.params.id]
    );

    const ownerPayments = await queryGet<{ total: string }>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM owner_payments WHERE project_id = ? ${sdp}`,
      [req.params.id]
    );

    const totalWages = labour.reduce((s: number, l: Record<string, unknown>) => s + parseFloat(String(l.total_wages ?? 0)), 0);
    const totalExpenses = expenses.reduce((s: number, e: Record<string, unknown>) => s + parseFloat(String(e.total ?? 0)), 0);
    const totalMaterials = materials.reduce((s: number, m: Record<string, unknown>) => s + parseFloat(String(m.total_cost ?? 0)), 0);
    const totalEquipment = equipment.reduce((s: number, e: Record<string, unknown>) => s + parseFloat(String(e.total_cost ?? 0)), 0);
    const totalReceived = parseFloat(ownerPayments?.total ?? "0");

    res.json({
      success: true,
      data: {
        project,
        period: { start_date: start_date ?? null, end_date: end_date ?? null },
        labour,
        expenses,
        materials,
        equipment,
        financials: {
          agreement_amount: project.agreement_amount ?? 0,
          total_received: totalReceived,
          total_wages: totalWages,
          total_expenses: totalExpenses,
          total_materials: totalMaterials,
          total_equipment: totalEquipment,
          total_cost: totalWages + totalExpenses + totalMaterials + totalEquipment,
          profit: totalReceived - (totalWages + totalExpenses + totalMaterials + totalEquipment),
        }
      }
    });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.get("/dashboard", async (req, res) => {
  try {
    const today = getPKTDate();
    const totalProjects = await queryGet<{ count: string }>("SELECT COUNT(*) as count FROM projects");
    const runningProjects = await queryGet<{ count: string }>("SELECT COUNT(*) as count FROM projects WHERE status = 'running'");
    const totalLabour = await queryGet<{ count: string }>("SELECT COUNT(*) as count FROM labour WHERE is_active = 1");
    const todayAttendance = await queryGet<{ count: string }>(
      "SELECT COUNT(*) as count FROM attendance WHERE date = ? AND status IN ('present','half_day')", [today]
    );
    const totalReceived = await queryGet<{ total: string }>("SELECT COALESCE(SUM(amount), 0) as total FROM owner_payments");
    const pendingPayments = await queryGet<{ count: string; total: string }>(
      "SELECT COUNT(*) as count, COALESCE(SUM(remaining), 0) as total FROM weekly_payments WHERE is_paid = 0"
    );
    const recentProjects = await queryAll(
      "SELECT id, project_code, name, status, owner_name, location FROM projects ORDER BY created_at DESC LIMIT 5"
    );
    res.json({
      success: true,
      data: {
        totalProjects: parseInt(totalProjects?.count ?? "0"),
        runningProjects: parseInt(runningProjects?.count ?? "0"),
        totalLabour: parseInt(totalLabour?.count ?? "0"),
        todayAttendance: parseInt(todayAttendance?.count ?? "0"),
        totalReceived: parseFloat(totalReceived?.total ?? "0"),
        pendingPayments: { count: parseInt(pendingPayments?.count ?? "0"), total: parseFloat(pendingPayments?.total ?? "0") },
        recentProjects,
      }
    });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

export default router;
