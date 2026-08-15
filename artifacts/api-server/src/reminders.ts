import cron from "node-cron";
import { queryAll, dbExec } from "./lib/db.js";

const MANAGER_PHONE = "923104900363";

const storeReminder = async (url: string, message: string, type: string) => {
  await dbExec(
    `INSERT INTO reminders (message, whatsapp_url, type, created_at, opened)
     VALUES (?, ?, ?, now(), 0)`,
    [message, url, type]
  );
};

const sendWhatsAppReminder = async (message: string, type: string) => {
  const encoded = encodeURIComponent(message);
  const url = `https://wa.me/${MANAGER_PHONE}?text=${encoded}`;
  await storeReminder(url, message, type);
  console.log(`[Reminder] ${type} triggered at`, new Date());
};

// ─── HELPER: Get reminder settings from database ─────────
const getReminderSettings = async () => {
  const result = await queryAll<{ key: string; value: string }>(
    `SELECT key, value FROM settings WHERE key IN
     ('reminder_morning', 'reminder_thursday', 'reminder_evening', 'reminder_phone')`
  );
  const map: Record<string, string> = {};
  result.forEach((row) => {
    map[row.key] = row.value;
  });
  return {
    morningAttendance: map["reminder_morning"] !== "0",
    thursdayPayment: map["reminder_thursday"] !== "0",
    eveningReminder: map["reminder_evening"] !== "0",
    phone: map["reminder_phone"] || MANAGER_PHONE,
  };
};

// ─── REMINDER SCHEDULE ───────────────────────────────────

// Morning attendance reminder — 9:00 PM daily
// Reason: contractor arrives at site around 8am
cron.schedule(
  "0 21 * * *",
  async () => {
    const settings = await getReminderSettings();
    if (!settings.morningAttendance) return;

    sendWhatsAppReminder(
      "السلام علیکم محمد ارشد صاحب 🏗️\n\n" +
        "صبح بخیر! آج کی حاضری لگانے کا وقت ہو گیا ہے۔\n" +
        "براہ کرم Hisab Kitab کھول کر حاضری لگائیں۔\n\n" +
        "📱 Hisab Kitab — حساب کتاب",
      "morning_attendance"
    );
  },
  { timezone: "Asia/Karachi" }
);

// Thursday weekly payment reminder — Thursday 9:00 PM
cron.schedule(
  "0 21 * * 4",
  async () => {
    const settings = await getReminderSettings();
    if (!settings.thursdayPayment) return;

    sendWhatsAppReminder(
      "السلام علیکم محمد ارشد صاحب 💰\n\n" +
        "آج جمعرات ہے — مزدوروں کی ہفتہ وار ادائیگی کا وقت ہے۔\n" +
        "Hisab Kitab کھولیں اور تنخواہ ادا کریں۔\n\n" +
        "📱 Hisab Kitab — حساب کتاب",
      "weekly_payment"
    );
  },
  { timezone: "Asia/Karachi" }
);

// ─── MAIN EVENING REMINDER — 9:00 PM ─────────────────────
cron.schedule(
  "0 21 * * *",
  async () => {
    const settings = await getReminderSettings();
    if (!settings.eveningReminder) return;

    const today = new Date().toLocaleDateString("ur-PK", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Karachi",
    });

    sendWhatsAppReminder(
      "السلام علیکم محمد ارشد صاحب 🌙\n\n" +
        `آج ${today} کا حساب مکمل کریں:\n\n` +
        "✅ حاضری لگائی؟\n" +
        "✅ اخراجات ریکارڈ کیے؟\n" +
        "✅ مٹیریل نوٹ کیا؟\n" +
        "✅ ڈائری لکھی؟\n\n" +
        "سب کام مکمل کر کے بیک اپ لینا نہ بھولیں۔\n\n" +
        "📱 Hisab Kitab — حساب کتاب",
      "evening_checklist"
    );
  },
  { timezone: "Asia/Karachi" }
);

export { sendWhatsAppReminder, getReminderSettings };