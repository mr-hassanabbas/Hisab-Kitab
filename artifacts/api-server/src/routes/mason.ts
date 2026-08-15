import { Router } from "express";
import { validateBody } from "../lib/validate.js";
import { insertMasonSchema } from "@workspace/db/schema";

import { queryGet, queryAll, dbExec, dbInsert, getPKT } from "../lib/db.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { active, search, project_id, page: pageStr, limit: limitStr } = req.query as Record<string, string>;
    const page = Math.max(1, parseInt(pageStr || "1"));
    const limit = Math.max(1, Math.min(100, parseInt(limitStr || "50")));
    const offset = (page - 1) * limit;

    let baseSql = "FROM mason WHERE 1=1";
    const params: unknown[] = [];
    if (active !== undefined) { baseSql += " AND is_active = ?"; params.push(active); }
    if (search) {
      const s = `%${search}%`;
      baseSql += " AND (name ILIKE ? OR phone ILIKE ? OR cnic ILIKE ?)";
      params.push(s, s, s);
    }

    let countSql = `SELECT COUNT(*) as count ${baseSql}`;
    let selectSql = `SELECT * ${baseSql}`;

    if (project_id) {
      baseSql = `FROM mason m
                 JOIN project_mason pm ON pm.mason_id = m.id
                 WHERE pm.project_id = ? AND pm.removed_at IS NULL`;
      params.length = 0;
      params.push(project_id);
      if (search) { baseSql += " AND (m.name ILIKE ? OR m.phone ILIKE ?)"; const s = `%${search}%`; params.push(s, s); }
      countSql = `SELECT COUNT(*) as count ${baseSql}`;
      selectSql = `SELECT m.*, pm.daily_wage as project_wage, pm.assigned_at, pm.id as pm_id ${baseSql}`;
    }

    const countRes = await queryGet<{ count: string }>(countSql, params);
    const total = parseInt(countRes?.count ?? "0");

    selectSql += " ORDER BY name ASC LIMIT ? OFFSET ?";
    const mason = await queryAll(selectSql, [...params, limit, offset]);

    res.json({
      success: true,
      data: mason,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.get("/:id", async (req, res) => {
  try {
    const mason = await queryGet("SELECT * FROM mason WHERE id = ?", [req.params.id]);
    if (!mason) return res.status(404).json({ success: false, error: "Mason not found" });

    // Project history
    const history = await queryAll(
      `SELECT pm.project_id, p.name as project_name, p.project_code,
              pm.daily_wage as project_wage, pm.assigned_at, pm.removed_at
       FROM project_mason pm JOIN projects p ON p.id = pm.project_id
       WHERE pm.mason_id = ? ORDER BY pm.assigned_at DESC`,
      [req.params.id]
    );

    // Attendance summary (all projects)
    const summary = await queryGet(
      `SELECT COUNT(*) as total_days,
              SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) as present_days,
              SUM(CASE WHEN status='half_day' THEN 0.5 ELSE 0 END) as half_days,
              SUM(CASE WHEN status='absent' THEN 1 ELSE 0 END) as absent_days
       FROM mason_attendance WHERE mason_id = ?`,
      [req.params.id]
    );

    // Full attendance history with project names (last 90 records)
    const attendance_history = await queryAll(
      `SELECT a.id, a.date, a.status, a.project_id, a.wage_for_day,
              p.name as project_name, p.project_code
       FROM mason_attendance a
       JOIN projects p ON p.id = a.project_id
       WHERE a.mason_id = ?
       ORDER BY a.date DESC
       LIMIT 90`,
      [req.params.id]
    );

    const earned = await queryGet<{ total: string }>(
      `SELECT COALESCE(SUM(COALESCE(a.wage_for_day, 0)), 0) as total
       FROM mason_attendance a
       WHERE a.mason_id = ?`,
      [req.params.id]
    );
    const paid = await queryGet<{ total: string }>(
      "SELECT COALESCE(SUM(amount_paid), 0) as total FROM mason_weekly_payments WHERE mason_id = ?",
      [req.params.id]
    );
    const total_earned = parseFloat(earned?.total ?? "0");
    const total_paid = parseFloat(paid?.total ?? "0");

    res.json({
      success: true,
      data: {
        ...mason,
        history,
        attendance_summary: summary,
        attendance_history,
        financial_summary: {
          total_earned,
          total_paid,
          total_remaining: total_earned - total_paid,
        },
      },
    });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.post("/", validateBody(insertMasonSchema), async (req, res) => {
  try {
    const { name, phone, cnic, fathers_name, village, daily_wage, joining_date, remarks } = req.body as Record<string, string>;
    if (!name) return res.status(400).json({ success: false, error: "name is required" });
    const now = getPKT();
    const { id } = await dbInsert(
      "INSERT INTO mason (name, phone, cnic, fathers_name, village, daily_wage, joining_date, remarks, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)",
      [name, phone ?? null, cnic ?? null, fathers_name ?? null, village ?? null, daily_wage ? parseFloat(daily_wage) : 0, joining_date ?? null, remarks ?? null, now]
    );
    const mason = await queryGet("SELECT * FROM mason WHERE id = ?", [id]);
    res.status(201).json({ success: true, data: mason });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.put("/:id", validateBody(insertMasonSchema.partial()), async (req, res) => {
  try {
    const mason = await queryGet("SELECT id FROM mason WHERE id = ?", [req.params.id]);
    if (!mason) return res.status(404).json({ success: false, error: "Mason not found" });
    const fields = ["name", "phone", "cnic", "fathers_name", "village", "daily_wage", "joining_date", "remarks", "is_active"];
    const setClauses: string[] = [];
    const vals: unknown[] = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) { setClauses.push(`${f} = ?`); vals.push(req.body[f]); }
    }
    if (setClauses.length === 0) return res.status(400).json({ success: false, error: "Nothing to update" });
    vals.push(req.params.id);
    await dbExec(`UPDATE mason SET ${setClauses.join(", ")} WHERE id = ?`, vals);
    const updated = await queryGet("SELECT * FROM mason WHERE id = ?", [req.params.id]);
    res.json({ success: true, data: updated });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.delete("/:id", async (req, res) => {
  try {
    await dbExec("UPDATE mason SET is_active = 0 WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: "Mason deactivated" });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.post("/:id/assign", async (req, res) => {
  try {
    const { project_id, daily_wage, assigned_at } = req.body as { project_id: number; daily_wage?: number; assigned_at?: string };
    if (!project_id) return res.status(400).json({ success: false, error: "project_id required" });
    let wage = daily_wage !== undefined && daily_wage !== null && !Number.isNaN(Number(daily_wage))
      ? parseFloat(String(daily_wage))
      : undefined;
    if (wage === undefined) {
      const masonBase = await queryGet<{ daily_wage: number }>("SELECT daily_wage FROM mason WHERE id = ?", [req.params.id]);
      wage = masonBase?.daily_wage ?? 0;
    }
    const existing = await queryGet(
      "SELECT id FROM project_mason WHERE mason_id = ? AND project_id = ? AND removed_at IS NULL",
      [req.params.id, project_id]
    );
    if (existing) return res.status(400).json({ success: false, error: "Already assigned to this project" });
    const alreadyLeft = await queryGet(
      "SELECT id FROM project_mason WHERE mason_id = ? AND project_id = ?",
      [req.params.id, project_id]
    );
    const now = assigned_at ? `${assigned_at} 00:00:00` : getPKT();
    if (alreadyLeft) {
      await dbExec("UPDATE project_mason SET removed_at = NULL, daily_wage = ?, assigned_at = ? WHERE mason_id = ? AND project_id = ?",
        [wage, now, req.params.id, project_id]);
    } else {
      await dbInsert(
        "INSERT INTO project_mason (project_id, mason_id, daily_wage, assigned_at) VALUES (?, ?, ?, ?)",
        [project_id, req.params.id, wage, now]
      );
    }
    res.json({ success: true, message: "Mason assigned to project" });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.post("/:id/remove", async (req, res) => {
  try {
    const { project_id } = req.body as { project_id: number };
    if (!project_id) return res.status(400).json({ success: false, error: "project_id required" });
    await dbExec(
      "UPDATE project_mason SET removed_at = ? WHERE mason_id = ? AND project_id = ? AND removed_at IS NULL",
      [getPKT(), req.params.id, project_id]
    );
    res.json({ success: true, message: "Mason removed from project" });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

export default router;

