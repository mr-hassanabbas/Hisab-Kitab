/**
 * Push Notification Helper for Hisab Kitab
 * Handles Web Push permissions, local reminders, and 5:00 PM attendance alerts.
 */

export function isNotificationSupported(): boolean {
  return "Notification" in window;
}

export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) return "denied";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      localStorage.setItem("hk_push_enabled", "true");
      return true;
    }
  } catch (e) {
    console.error("Permission request failed:", e);
  }
  return false;
}

export function isPushEnabled(): boolean {
  return (
    isNotificationSupported() &&
    Notification.permission === "granted" &&
    localStorage.getItem("hk_push_enabled") === "true"
  );
}

export function setPushEnabled(enabled: boolean): void {
  if (enabled) {
    localStorage.setItem("hk_push_enabled", "true");
  } else {
    localStorage.setItem("hk_push_enabled", "false");
  }
}

export async function sendNotification(
  title: string,
  options?: NotificationOptions & { bodyUrdu?: string }
): Promise<void> {
  if (!isNotificationSupported() || Notification.permission !== "granted") return;

  const defaultOptions: NotificationOptions = {
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    ...options,
  };

  // Add vibrate if supported
  if ("vibrate" in Notification.prototype) {
    (defaultOptions as any).vibrate = [200, 100, 200];
  }

  if (navigator.serviceWorker?.controller) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, defaultOptions);
      return;
    } catch {
      // Fallback to standard Notification API
    }
  }

  try {
    new Notification(title, defaultOptions);
  } catch (e) {
    console.warn("Notification error:", e);
  }
}

// ── Daily 5:00 PM Attendance Reminder Scheduler ──────────────────────
let _timerId: number | null = null;

export function initAttendanceReminderScheduler(): void {
  if (_timerId) clearInterval(_timerId);

  const checkAndNotify = () => {
    if (!isPushEnabled()) return;

    const now = new Date();
    const hours = now.getHours();
    const todayStr = now.toISOString().split("T")[0];
    const lastNotifiedDate = localStorage.getItem("hk_last_attendance_reminder");

    // Remind at 5:00 PM (17:00) or later if not notified today
    if (hours >= 17 && lastNotifiedDate !== todayStr) {
      localStorage.setItem("hk_last_attendance_reminder", todayStr);
      sendNotification("Attendance Reminder — حاضری کی یاد دہانی 📋", {
        body: "Don't forget to mark today's attendance for your workers!\nآج کی حاضری لگانا نہ بھولیں!",
        tag: "attendance-reminder",
      });
    }
  };

  // Check immediately on load
  checkAndNotify();

  // Check every 15 minutes
  _timerId = window.setInterval(checkAndNotify, 15 * 60 * 1000);
}
