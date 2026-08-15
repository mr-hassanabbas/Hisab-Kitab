import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

// Register Service Worker for PWA
registerSW({ immediate: true });
import App from "./App";
import "./index.css";
import { initAttendanceReminderScheduler } from "./lib/notifications";

// Initialize 5:00 PM attendance reminder scheduler
initAttendanceReminderScheduler();

createRoot(document.getElementById("root")!).render(<App />);
