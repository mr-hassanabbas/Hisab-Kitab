import { useRef, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { useLanguage, setLanguage } from "@/hooks/use-language";
import type { TranslationKey } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Settings as SettingsIcon, Sun, Moon, Monitor, Languages, Lock,
  HardHat, Delete, Download, Upload, AlertTriangle, CheckCircle2, Bell,
  Phone, MessageCircle,
} from "lucide-react";
import { requestNotificationPermission, isPushEnabled, setPushEnabled, sendNotification } from "@/lib/notifications";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export default function Settings() {
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { toast } = useToast();
  const qc = useQueryClient();
  const restoreFileRef = useRef<HTMLInputElement>(null);

  // ── PIN change state ────────────────────────────────────────────
  const [showChangePin, setShowChangePin] = useState(false);
  const [pinStep, setPinStep] = useState<"current" | "new" | "confirm">("current");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinLoading, setPinLoading] = useState(false);

  // ── Clear all data state ───────────────────────────────────────
  const [showClearData, setShowClearData] = useState(false);
  const [clearPin, setClearPin] = useState("");
  const [clearLoading, setClearLoading] = useState(false);

  // ── Backup / Restore state ──────────────────────────────────────
  const [backupLoading, setBackupLoading] = useState(false);
  const [restorePending, setRestorePending] = useState<{
    file: File;
    data: Record<string, unknown[]>;
    exported_at: string;
    errors?: string[];
  } | null>(null);
  const [restoreResult, setRestoreResult] = useState<{ restored: Record<string, number>; errors?: string[] } | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [pushActive, setPushActive] = useState(() => isPushEnabled());


  const handleNotificationToggle = async () => {
    if (pushActive) {
      setPushEnabled(false);
      setPushActive(false);
      toast({ title: t("notifications_disabled") || "Notifications Disabled", description: "Daily 5:00 PM attendance reminders are turned off." });
    } else {
      const granted = await requestNotificationPermission();
      if (granted) {
        setPushActive(true);
        sendNotification("Hisab Kitab Notifications Enabled! 🔔", {
          body: "You will receive daily attendance reminders at 5:00 PM.",
        });
        toast({ title: t("notifications_enabled") || "Notifications Enabled! 🔔", description: "Daily 5:00 PM attendance reminders active." });
      } else {
        toast({ title: t("notification_permission_denied") || "Permission Denied", description: "Please enable notifications in your browser settings.", variant: "destructive" });
      }
    }
  };

  const { data: settingsData } = useQuery({
    queryKey: ["settings"],
    queryFn: () => fetchApi("/settings"),
  });
  const { data: backupStatus } = useQuery({
    queryKey: ["backup-status"],
    queryFn: () => fetchApi("/backup/status"),
  });

  const updateSetting = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      fetchApi(`/settings/${key}`, { method: "PUT", body: JSON.stringify({ value }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["settings"] }); },
  });

  const settings: Record<string, string> = settingsData?.data ?? {};
  const tableCount = Object.keys(backupStatus?.data?.tables ?? {}).length;
  const totalRows = Object.values(backupStatus?.data?.tables ?? {} as Record<string, number>).reduce((s: number, v) => s + Number(v), 0);

  // ── WhatsApp Reminders state ─────────────────────────────────────
  const reminderToggles: { key: string; labelKey: TranslationKey; descKey: TranslationKey }[] = [
    { key: "reminder_morning", labelKey: "reminder_morning_label", descKey: "reminder_morning_desc" },
    { key: "reminder_thursday", labelKey: "reminder_thursday_label", descKey: "reminder_thursday_desc" },
    { key: "reminder_evening", labelKey: "reminder_evening_label", descKey: "reminder_evening_desc" },
  ];

  const reminderOn = (key: string) => settings[key] !== "0";
  const toggleReminder = (key: string) => {
    const next = settings[key] !== "0" ? "0" : "1";
    updateSetting.mutate({ key, value: next });
  };

  const [phone, setPhone] = useState("");
  const [phoneSaved, setPhoneSaved] = useState(false);
  useEffect(() => {
    if (!phone && settings["reminder_phone"]) setPhone(settings["reminder_phone"]);
  }, [settings, phone]);

  const savePhone = () => {
    const normalized = phone.replace(/\D/g, "");
    if (normalized.length < 10) {
      toast({ title: t("reminder_phone_invalid") || "Invalid phone number", variant: "destructive" });
      return;
    }
    updateSetting.mutate(
      { key: "reminder_phone", value: normalized.startsWith("92") ? normalized : `92${normalized.replace(/^0/, "")}` },
      { onSuccess: () => { setPhoneSaved(true); setTimeout(() => setPhoneSaved(false), 1500); } }
    );
  };

  const handleLangChange = (lang: string) => {
    setLanguage(lang as "en" | "ur");
    updateSetting.mutate({ key: "default_language", value: lang });
    toast({ title: lang === "en" ? t("lang_changed") : t("lang_changed_ur") });
  };

  const handleThemeChange = (t_val: "light" | "dark" | "system") => {
    setTheme(t_val);
    updateSetting.mutate({ key: "default_theme", value: t_val });
    const label = t_val === "light" ? t("light") : t_val === "dark" ? t("dark") : t("system");
    toast({ title: `${t("theme_changed")} ${label}` });
  };

  // ── PIN helpers ─────────────────────────────────────────────────
  const getPinStep = () => {
    if (pinStep === "current") return currentPin;
    if (pinStep === "new") return newPin;
    return confirmPin;
  };

  const handlePinDigit = (d: string) => {
    const cur = getPinStep();
    if (cur.length >= 4) return;
    const next = cur + d;
    if (pinStep === "current") { setCurrentPin(next); if (next.length === 4) setPinStep("new"); }
    else if (pinStep === "new") { setNewPin(next); if (next.length === 4) setPinStep("confirm"); }
    else { setConfirmPin(next); }
  };

  const handlePinDelete = () => {
    if (pinStep === "current") setCurrentPin((p) => p.slice(0, -1));
    else if (pinStep === "new") setNewPin((p) => p.slice(0, -1));
    else setConfirmPin((p) => p.slice(0, -1));
  };

  const handleConfirmRestore = async () => {
    if (!restorePending) return;
    setRestoreLoading(true);
    setRestoreResult(null);
    try {
      const res = await fetchApi("/backup/restore", {
        method: "POST",
        body: JSON.stringify({ data: restorePending.data }),
      });
      if (res.restored) {
        setRestoreResult({ restored: res.restored as Record<string, number>, errors: res.errors as string[] });
        qc.invalidateQueries();
        toast({ title: t("restore_complete"), description: t("restore_complete_desc") });
      } else {
        toast({ title: t("restore_failed"), variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: t("restore_failed"), description: e.message, variant: "destructive" });
    } finally {
      setRestoreLoading(false);
      setRestorePending(null);
    }
  };

  const handleClearData = async () => {
    if (clearPin.length !== 4) return;
    setClearLoading(true);
    try {
      const res = await fetchApi("/settings/clear-data", {
        method: "POST",
        body: JSON.stringify({ pin: clearPin }),
      });
      if (res.success) {
        toast({ title: t("data_cleared"), description: t("data_cleared_desc") });
        setShowClearData(false);
        qc.invalidateQueries();
      } else {
        toast({ title: t("wrong_pin"), variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: t("clear_failed"), description: e.message, variant: "destructive" });
    } finally {
      setClearLoading(false);
      setClearPin("");
    }
  };

  const handleExportBackup = async () => {
    setBackupLoading(true);
    try {
      const res = await fetchApi("/backup/export");
      const blob = new Blob([JSON.stringify(res, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hisab-kitab-backup-${new Date().toISOString().substring(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: t("backup_downloaded") });
    } catch (e: any) {
      toast({ title: t("export_failed"), description: e.message, variant: "destructive" });
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestoreFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed.data || typeof parsed.data !== "object") {
        toast({ title: t("invalid_file"), variant: "destructive" });
        return;
      }
      setRestorePending({
        file,
        data: parsed.data as Record<string, unknown[]>,
        exported_at: String(parsed.exported_at ?? "unknown"),
      });
    } catch {
      toast({ title: t("invalid_file"), variant: "destructive" });
    } finally {
      if (restoreFileRef.current) restoreFileRef.current.value = "";
    }
  };

  const handlePinSubmit = async () => {
    if (confirmPin !== newPin) {
      toast({ title: t("pins_no_match"), variant: "destructive" });
      setConfirmPin("");
      return;
    }
    setPinLoading(true);
    try {
      const res = await fetchApi("/settings/change-pin", {
        method: "POST",
        body: JSON.stringify({ current_pin: currentPin, new_pin: newPin }),
      });
      if (res.success) {
        toast({ title: t("pin_changed") });
        setShowChangePin(false);
        setPinStep("current");
        setCurrentPin("");
        setNewPin("");
        setConfirmPin("");
      } else {
        toast({ title: t("wrong_pin"), variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: t("error"), description: e.message, variant: "destructive" });
    } finally {
      setPinLoading(false);
    }
  };

  useEffect(() => {
    if (confirmPin.length === 4 && pinStep === "confirm") {
      handlePinSubmit();
    }
  }, [confirmPin, pinStep]);

  const pinDisplayLabels: Record<string, string> = {
    current: t("current_pin"),
    new: t("new_pin"),
    confirm: t("confirm_pin"),
  };

  const resolvedThemeLabel = () => {
    if (resolvedTheme === "light") return t("light");
    if (resolvedTheme === "dark") return t("dark");
    return resolvedTheme;
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-foreground mb-6">{t("settings")}</h1>

      {/* Profile */}
      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
            <HardHat className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <div className="font-semibold text-foreground">{user?.name ?? "—"}</div>
            <div className="text-sm text-muted-foreground">{user?.mobile ?? "—"}</div>
          </div>
        </div>
        <button
          data-testid="btn-change-pin"
          onClick={() => { setShowChangePin(true); setCurrentPin(""); setNewPin(""); setConfirmPin(""); setPinStep("current"); }}
          className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-medium transition-colors font-semibold"
        >
          <Lock className="w-4 h-4" /> {t("change_pin")}
        </button>
      </div>

      {/* Language */}
      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Languages className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold text-foreground text-sm">{t("language")}</h2>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(["en", "ur"] as const).map((lang) => {
            const currentLang = localStorage.getItem("hk_lang") ?? settings.default_language ?? "en";
            return (
              <button
                key={lang}
                data-testid={`btn-lang-${lang}`}
                onClick={() => handleLangChange(lang)}
                className={cn(
                  "py-3 rounded-lg border text-sm font-semibold transition-colors",
                  currentLang === lang ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground hover:bg-muted"
                )}
              >
                {lang === "en" ? "English" : "اردو (Urdu)"}
              </button>
            );
          })}
        </div>
      </div>

      {/* Theme */}
      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Sun className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold text-foreground text-sm">{t("theme")}</h2>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: "light", label: t("light"), icon: Sun },
            { value: "dark", label: t("dark"), icon: Moon },
            { value: "system", label: t("system"), icon: Monitor },
          ].map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              data-testid={`btn-theme-${value}`}
              onClick={() => handleThemeChange(value as any)}
              className={cn(
                "py-3 rounded-lg border flex flex-col items-center gap-1.5 text-xs font-semibold transition-colors",
                theme === value ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground hover:bg-muted"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">{t("currently")} <strong>{resolvedThemeLabel()}</strong> {t("mode")}</p>
      </div>

      {/* Push Notifications */}
      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-muted-foreground" />
            <div>
              <h2 className="font-semibold text-foreground text-sm">{t("push_notifications") || "Push Notifications & Reminders"}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{t("attendance_reminder_sub") || "Daily 5:00 PM alert to mark attendance"}</p>
            </div>
          </div>
          <button
            data-testid="btn-toggle-notifications"
            onClick={handleNotificationToggle}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
              pushActive
                ? "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700"
                : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
            )}
          >
            {pushActive ? t("active") || "Active ✓" : t("enable") || "Enable"}
          </button>
        </div>
      </div>

      {/* WhatsApp Reminders */}
      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Phone className="w-4 h-4 text-emerald-500" />
          <h2 className="font-semibold text-foreground text-sm">{t("whatsapp_reminders") || "WhatsApp Reminders"}</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">{t("whatsapp_reminders_sub") || "Automatic WhatsApp alerts for daily tasks"}</p>

        <div className="space-y-3">
          {reminderToggles.map((r) => (
            <div key={r.key} className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-foreground">{t(r.labelKey) || r.labelKey}</div>
                <div className="text-xs text-muted-foreground">{t(r.descKey) || r.descKey}</div>
              </div>
              <button
                data-testid={`btn-toggle-${r.key}`}
                onClick={() => toggleReminder(r.key)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex-shrink-0",
                  reminderOn(r.key)
                    ? "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700"
                    : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                )}
              >
                {reminderOn(r.key) ? t("active") || "Active ✓" : t("disabled") || "Disabled"}
              </button>
            </div>
          ))}

          {/* Phone number */}
          <div className="pt-2 border-t border-border">
            <div className="flex items-center gap-2 mb-2">
              <MessageCircle className="w-4 h-4 text-[#25D366]" />
              <div>
                <div className="text-sm font-medium text-foreground">{t("reminder_phone_label") || "WhatsApp Number"}</div>
                <div className="text-xs text-muted-foreground">{t("reminder_phone_desc") || "Where reminders will be sent"}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0300 1234567"
                inputMode="tel"
                className="flex-1 h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <Button
                onClick={savePhone}
                className="h-10 px-4 text-xs font-semibold"
                disabled={!phone || phoneSaved}
              >
                {phoneSaved ? t("saved") || "Saved ✓" : t("save") || "Save"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Backup & Restore */}
      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Download className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold text-foreground text-sm">{t("backup_restore")}</h2>
        </div>
        {backupStatus?.data && (
          <p className="text-xs text-muted-foreground mb-4">
            {tableCount} {t("tables")} · {Number(totalRows).toLocaleString()} {t("total_records")}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          {/* Export */}
          <button
            data-testid="btn-export-backup"
            onClick={handleExportBackup}
            disabled={backupLoading}
            className="flex flex-col items-center gap-2 py-4 px-3 rounded-xl border border-border bg-background hover:bg-muted transition-colors text-center disabled:opacity-50"
          >
            <Download className="w-5 h-5 text-green-600" />
            <div>
              <div className="text-sm font-semibold text-foreground">{backupLoading ? t("exporting") : t("export_all")}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{t("download_json")}</div>
            </div>
          </button>

          {/* Restore */}
          <button
            data-testid="btn-restore-backup"
            onClick={() => restoreFileRef.current?.click()}
            className="flex flex-col items-center gap-2 py-4 px-3 rounded-xl border border-border bg-background hover:bg-muted transition-colors text-center"
          >
            <Upload className="w-5 h-5 text-orange-500" />
            <div>
              <div className="text-sm font-semibold text-foreground">{t("restore_backup")}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{t("load_json")}</div>
            </div>
          </button>
        </div>
        <input
          ref={restoreFileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleRestoreFileSelect}
        />

        {/* Restore success result */}
        {restorePending && (
          <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
              <span className="text-sm font-medium text-green-700 dark:text-green-400">{t("restore_complete")}</span>
            </div>
            <div className="text-xs text-green-600 dark:text-green-500 space-y-0.5">
              {Object.entries(restorePending.data).map(([table, rows]) => (
                <div key={table}>{table}: {Array.isArray(rows) ? rows.length : 0} {t("rows")}</div>
              ))}
            </div>
            {restorePending.errors && restorePending.errors.length > 0 && (
              <div className="mt-2 text-xs text-orange-600">{t("warnings")} {restorePending.errors.join(", ")}</div>
            )}
          </div>
        )}
      </div>

      {/* App Info */}
      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <h2 className="font-semibold text-foreground text-sm mb-3">{t("about")}</h2>
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex justify-between"><span>{t("app_name")}</span><span className="text-foreground">{t("app_name")}</span></div>
          <div className="flex justify-between"><span>{t("app_version")}</span><span className="text-foreground">1.0.0</span></div>
          <div className="flex justify-between"><span>{t("timezone")}</span><span className="text-foreground">{t("timezone_val")}</span></div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-card border border-destructive/20 rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <h2 className="font-semibold text-foreground text-sm">{t("danger_zone")}</h2>
        </div>
        <button
          data-testid="btn-clear-data"
          onClick={() => setShowClearData(true)}
          className="w-full py-3 rounded-xl border border-destructive/30 text-destructive text-sm font-semibold hover:bg-destructive/5 transition-colors"
        >
          {t("clear_all_data")}
        </button>
      </div>

      {/* Logout */}
      <button
        data-testid="btn-logout"
        onClick={() => { if (confirm(t("logout_confirm"))) logout(); }}
        className="w-full py-3 rounded-xl border border-destructive/30 text-destructive text-sm font-semibold hover:bg-destructive/5 transition-colors"
      >
        {t("logout")}
      </button>

      {/* Change PIN Dialog */}
      <Dialog open={showChangePin} onOpenChange={(o) => { if (!o) setShowChangePin(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t("change_pin")}</DialogTitle></DialogHeader>
          <div className="mt-4">
            <p className="text-sm text-muted-foreground text-center mb-4">{pinDisplayLabels[pinStep]}</p>
            <div className="flex justify-center gap-3 mb-6">
              {[0,1,2,3].map((i) => {
                const cur = getPinStep();
                return (
                  <div key={i} className={cn("w-11 h-11 rounded-full border-2 flex items-center justify-center", cur.length > i ? "border-primary bg-primary" : "border-border bg-background")}>
                    {cur.length > i && <div className="w-3 h-3 rounded-full bg-primary-foreground" />}
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((d, i) => (
                d === "" ? <div key={i} /> :
                d === "⌫" ? (
                  <button key={i} onClick={handlePinDelete}
                    className="h-13 py-3 rounded-xl bg-muted text-foreground flex items-center justify-center hover:bg-muted/70 active:scale-95 transition-all">
                    <Delete className="w-5 h-5" />
                  </button>
                ) : (
                  <button key={i} onClick={() => handlePinDigit(d)} disabled={pinLoading}
                    className="h-13 py-3 rounded-xl bg-muted text-foreground text-xl font-semibold hover:bg-primary/10 active:scale-95 transition-all">
                    {d}
                  </button>
                )
              ))}
            </div>
            {pinLoading && <p className="text-center text-xs text-muted-foreground mt-3">{t("changing_pin")}</p>}
            <Button variant="outline" className="w-full mt-4" onClick={() => setShowChangePin(false)}>{t("cancel")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Clear All Data Dialog */}
      <Dialog open={showClearData} onOpenChange={(o) => { if (!o && !clearLoading) { setShowClearData(false); setClearPin(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-destructive">{t("clear_data_title")}</DialogTitle></DialogHeader>
          <div className="mt-2">
            <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700 dark:text-red-400">
                <strong>{t("clear_data_warn1")}</strong>{" "}
                {t("clear_data_warn2")}{" "}
                {t("clear_data_warn3")}
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center mb-4">
              {t("clear_data_pin")}
            </p>
            <div className="flex justify-center gap-3 mb-6">
              {[0,1,2,3].map((i) => (
                <div key={i} className={cn("w-11 h-11 rounded-full border-2 flex items-center justify-center",
                  clearPin.length > i ? "border-destructive bg-destructive" : "border-border bg-background")}>
                  {clearPin.length > i && <div className="w-3 h-3 rounded-full bg-white" />}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((d, i) => (
                d === "" ? <div key={i} /> :
                d === "⌫" ? (
                  <button key={i} onClick={() => setClearPin((p) => p.slice(0, -1))} disabled={clearLoading}
                    className="h-13 py-3 rounded-xl bg-muted text-foreground flex items-center justify-center hover:bg-muted/70 active:scale-95 transition-all">
                    <Delete className="w-5 h-5" />
                  </button>
                ) : (
                  <button key={i} disabled={clearLoading || clearPin.length >= 4}
                    onClick={() => { const next = clearPin + d; setClearPin(next); }}
                    className="h-13 py-3 rounded-xl bg-muted text-foreground text-xl font-semibold hover:bg-destructive/10 active:scale-95 transition-all">
                    {d}
                  </button>
                )
              ))}
            </div>
            {clearLoading && <p className="text-center text-xs text-muted-foreground mb-3">{t("clearing_data")}</p>}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setShowClearData(false); setClearPin(""); }} disabled={clearLoading}>{t("cancel")}</Button>
              <Button
                className="flex-1 bg-destructive hover:bg-destructive/90 text-white font-semibold"
                onClick={handleClearData}
                disabled={clearLoading || clearPin.length !== 4}
                data-testid="btn-confirm-clear"
              >
                {clearLoading ? t("clearing_data") : t("yes_clear_all")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation Dialog */}
      <Dialog open={!!restorePending} onOpenChange={(o) => { if (!o && !restoreLoading) setRestorePending(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t("confirm_restore")}</DialogTitle></DialogHeader>
          <div className="mt-2">
            <div className="flex items-start gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800 mb-4">
              <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-orange-700 dark:text-orange-400">
                <strong>{t("restore_warn1")}</strong>.
                {t("restore_warn2")}
              </div>
            </div>
            {restorePending && (
              <div className="text-xs text-muted-foreground mb-4 space-y-1">
                <div><span className="font-semibold">{t("file_label")}</span> {restorePending.file.name}</div>
                <div><span className="font-semibold">{t("backup_date")}</span> {restorePending.exported_at}</div>
                <div><span className="font-semibold">{t("tables_label")}</span> {Object.keys(restorePending.data).length}</div>
                <div><span className="font-semibold">{t("records_label")}</span> {Object.values(restorePending.data).reduce((s, r) => s + r.length, 0).toLocaleString()}</div>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setRestorePending(null)} disabled={restoreLoading}>
                {t("cancel")}
              </Button>
              <Button
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                onClick={handleConfirmRestore}
                disabled={restoreLoading}
                data-testid="btn-confirm-restore"
              >
                {restoreLoading ? t("restoring") : t("yes_restore")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
