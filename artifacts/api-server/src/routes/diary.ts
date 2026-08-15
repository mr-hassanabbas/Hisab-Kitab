import { Router } from "express";
import { validateBody } from "../lib/validate.js";
import { insertDiarySchema } from "@workspace/db/schema";

import { queryGet, queryAll, dbExec, dbInsert, getPKT, getPKTDate } from "../lib/db.js";

const router = Router();

// SELECT helper that aliases extra_notes → notes for the frontend
const SELECT_COLS = `id, project_id, date, note,
  COALESCE(work_summary, note) as work_summary,
  weather,
  extra_notes as notes,
  created_at`;

router.get("/", async (req, res) => {
  try {
    const { project_id, date, start_date, end_date, page: pageStr, limit: limitStr } = req.query as Record<string, string>;
    const page = Math.max(1, parseInt(pageStr || "1"));
    const limit = Math.max(1, Math.min(100, parseInt(limitStr || "30")));
    const offset = (page - 1) * limit;

    let baseSql = "FROM daily_diary WHERE 1=1";
    const params: unknown[] = [];
    if (project_id) { baseSql += " AND project_id = ?"; params.push(project_id); }
    if (date) { baseSql += " AND date = ?"; params.push(date); }
    if (start_date) { baseSql += " AND date >= ?"; params.push(start_date); }
    if (end_date) { baseSql += " AND date <= ?"; params.push(end_date); }

    const countRes = await queryGet<{ count: string }>(`SELECT COUNT(*) as count ${baseSql}`, params);
    const total = parseInt(countRes?.count ?? "0");

    const rows = await queryAll(`SELECT ${SELECT_COLS} ${baseSql} ORDER BY date DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    res.json({
      success: true,
      data: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.get("/today", async (req, res) => {
  try {
    const { project_id } = req.query as Record<string, string>;
    if (!project_id) return res.status(400).json({ success: false, error: "project_id required" });
    const today = getPKTDate();
    const row = await queryGet(`SELECT ${SELECT_COLS} FROM daily_diary WHERE project_id = ? AND date = ?`, [project_id, today]);
    res.json({ success: true, data: row, date: today });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.get("/:id", async (req, res) => {
  try {
    const row = await queryGet(`SELECT ${SELECT_COLS} FROM daily_diary WHERE id = ?`, [req.params.id]);
    if (!row) return res.status(404).json({ success: false, error: "Diary entry not found" });
    res.json({ success: true, data: row });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.post("/", validateBody(insertDiarySchema), async (req, res) => {
  try {
    const { project_id, date, work_summary, weather, notes, note } = req.body as Record<string, unknown>;
    const summary = (work_summary ?? note) as string | undefined;
    if (!project_id || !summary) {
      return res.status(400).json({ success: false, error: "project_id and work_summary required" });
    }
    const diaryDate = (date ?? getPKTDate()) as string;
    const now = getPKT();

    const existing = await queryGet<{ id: number }>(
      "SELECT id FROM daily_diary WHERE project_id = ? AND date = ?",
      [project_id, diaryDate]
    );
    if (existing) {
      await dbExec(
        "UPDATE daily_diary SET note = ?, work_summary = ?, weather = ?, extra_notes = ? WHERE id = ?",
        [summary, summary, weather ?? null, notes ?? null, existing.id]
      );
      const updated = await queryGet(`SELECT ${SELECT_COLS} FROM daily_diary WHERE id = ?`, [existing.id]);
      return res.json({ success: true, data: updated, updated: true });
    }
    const { id } = await dbInsert(
      "INSERT INTO daily_diary (project_id, date, note, work_summary, weather, extra_notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [project_id, diaryDate, summary, summary, weather ?? null, notes ?? null, now]
    );
    const row = await queryGet(`SELECT ${SELECT_COLS} FROM daily_diary WHERE id = ?`, [id]);
    res.status(201).json({ success: true, data: row });
  } catch (e) { res.status(500).json({ success: false, error: `Server error: ${(e as Error).message}` }); }
});

router.put("/:id", validateBody(insertDiarySchema.partial()), async (req, res) => {
  try {
    const row = await queryGet("SELECT id FROM daily_diary WHERE id = ?", [req.params.id]);
    if (!row) return res.status(404).json({ success: false, error: "Diary entry not found" });
    const { work_summary, weather, notes, note, date } = req.body as Record<string, string | undefined>;
    const summary = work_summary ?? note;
    const setClauses: string[] = [];
    const vals: unknown[] = [];
    if (summary !== undefined) { setClauses.push("note = ?", "work_summary = ?"); vals.push(summary, summary); }
    if (weather !== undefined) { setClauses.push("weather = ?"); vals.push(weather); }
    if (notes !== undefined) { setClauses.push("extra_notes = ?"); vals.push(notes); }
    if (date !== undefined) { setClauses.push("date = ?"); vals.push(date); }
    if (setClauses.length === 0) return res.status(400).json({ success: false, error: "Nothing to update" });
    vals.push(req.params.id);
    await dbExec(`UPDATE daily_diary SET ${setClauses.join(", ")} WHERE id = ?`, vals);
    const updated = await queryGet(`SELECT ${SELECT_COLS} FROM daily_diary WHERE id = ?`, [req.params.id]);
    res.json({ success: true, data: updated });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.delete("/:id", async (req, res) => {
  try {
    await dbExec("DELETE FROM daily_diary WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: "Diary entry deleted" });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

export default router;
