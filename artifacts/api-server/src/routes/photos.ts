import { Router } from "express";
import { queryGet, queryAll, dbExec, dbInsert, getPKT, getPKTDate } from "../lib/db.js";

const router = Router();

const CATEGORIES = ["Progress", "Receipt", "Labour", "Owner", "Before", "After", "Other"];

router.get("/", async (req, res) => {
  try {
    const { project_id, category, page: pageStr, limit: limitStr } = req.query as Record<string, string>;
    const page = Math.max(1, parseInt(pageStr || "1"));
    const limit = Math.max(1, Math.min(100, parseInt(limitStr || "30")));
    const offset = (page - 1) * limit;

    let baseSql = "FROM photos WHERE 1=1";
    const params: unknown[] = [];
    if (project_id) { baseSql += " AND project_id = ?"; params.push(project_id); }
    if (category) { baseSql += " AND category = ?"; params.push(category); }

    const countRes = await queryGet<{ count: string }>(`SELECT COUNT(*) as count ${baseSql}`, params);
    const total = parseInt(countRes?.count ?? "0");

    const rows = await queryAll(`SELECT id, project_id, category, caption, date_taken, created_at ${baseSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    res.json({
      success: true,
      data: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

// GET single photo (returns data_url = file_path)
router.get("/:id/data", async (req, res) => {
  try {
    const row = await queryGet<{ file_path: string }>("SELECT file_path FROM photos WHERE id = ?", [req.params.id]);
    if (!row) return res.status(404).json({ success: false, error: "Photo not found" });
    res.json({ success: true, data_url: row.file_path });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

// POST accepts JSON { project_id, data_url, category, caption, date_taken }
router.post("/", async (req, res) => {
  try {
    const { project_id, data_url, category = "Progress", caption, date_taken } = req.body as Record<string, string>;
    if (!project_id) return res.status(400).json({ success: false, error: "project_id required" });
    if (!data_url || !data_url.startsWith("data:")) return res.status(400).json({ success: false, error: "data_url required (must be a data URI)" });
    const cat = CATEGORIES.includes(category) ? category : "Progress";
    const now = getPKT();
    const { id } = await dbInsert(
      "INSERT INTO photos (project_id, file_path, category, caption, date_taken, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [project_id, data_url, cat, caption ?? null, date_taken ?? getPKTDate(), now]
    );
    // Return metadata only (not the data_url) to keep the response small
    const row = await queryGet("SELECT id, project_id, category, caption, date_taken, created_at FROM photos WHERE id = ?", [id]);
    res.status(201).json({ success: true, data: row });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.put("/:id", async (req, res) => {
  try {
    const row = await queryGet("SELECT id FROM photos WHERE id = ?", [req.params.id]);
    if (!row) return res.status(404).json({ success: false, error: "Photo not found" });
    const { caption, category } = req.body as { caption?: string; category?: string };
    const setClauses: string[] = [];
    const vals: unknown[] = [];
    if (caption !== undefined) { setClauses.push("caption = ?"); vals.push(caption); }
    if (category !== undefined && CATEGORIES.includes(category)) { setClauses.push("category = ?"); vals.push(category); }
    if (setClauses.length === 0) return res.status(400).json({ success: false, error: "Nothing to update" });
    vals.push(req.params.id);
    await dbExec(`UPDATE photos SET ${setClauses.join(", ")} WHERE id = ?`, vals);
    const updated = await queryGet("SELECT id, project_id, category, caption, date_taken, created_at FROM photos WHERE id = ?", [req.params.id]);
    res.json({ success: true, data: updated });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

router.delete("/:id", async (req, res) => {
  try {
    await dbExec("DELETE FROM photos WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: "Photo deleted" });
  } catch (e) { res.status(500).json({ success: false, error: "Server error" }); }
});

export default router;
