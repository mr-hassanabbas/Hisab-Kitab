import { Router } from "express";
import { queryAll, dbExec } from "../lib/db.js";
import { authenticate } from "../middlewares/auth.js";

const router = Router();

// Return reminders from the last 10 minutes not yet opened
router.get("/pending", authenticate, async (req, res) => {
  try {
    const rows = await queryAll<{
      id: number;
      message: string;
      whatsapp_url: string;
      type: string;
      created_at: string;
      opened: number;
    }>(
      `SELECT id, message, whatsapp_url, type, created_at, opened
       FROM reminders
       WHERE opened = 0
         AND created_at >= now() - interval '10 minutes'
       ORDER BY created_at DESC`
    );
    res.json({
      success: true,
      reminders: rows.map((r) => ({
        id: r.id,
        message: r.message,
        whatsappUrl: r.whatsapp_url,
        type: r.type,
        createdAt: r.created_at,
        opened: r.opened === 1,
      })),
    });
  } catch (e) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// Mark a reminder as opened
router.put("/:id/opened", authenticate, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ success: false, error: "Invalid id" });
    await dbExec("UPDATE reminders SET opened = 1 WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});

export default router;