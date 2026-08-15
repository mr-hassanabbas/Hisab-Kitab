import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { useSearch } from "wouter";
import {
  CalendarCheck, CheckCircle, XCircle, Clock,
  ChevronDown, ChevronUp, Receipt, Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/use-language";

const PKR = (n: unknown) => `PKR ${Number(n || 0).toLocaleString("en-PK")}`;

type Status = "present" | "absent" | "half_day" | null;

interface AttendanceRow {
  id: number; name: string; daily_wage: number; project_wage: number;
  today_status: Status; wage_for_day: number; advance_given: number;
  attendance_id?: number; attendance_remarks?: string;
  overtime_hours?: number; overtime_pay?: number;
  overtime_rate_per_hour?: number;
}

const EXPENSE_CATEGORIES = ["Food", "Transport", "Fuel", "Tools", "Safety", "Other"];

// ─── Per-project accordion panel ───────────────────────────────────────────
function ProjectPanel({
  project,
  date,
  isOpen,
  onToggle,
}: {
  project: Record<string, unknown>;
  date: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useLanguage();

  const STATUS_OPTS = [
    { value: "present",  label: t("present"),  icon: CheckCircle, color: "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700" },
    { value: "half_day", label: t("half"),     icon: Clock,        color: "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700" },
    { value: "absent",   label: t("absent"),   icon: XCircle,      color: "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700" },
  ] as const;

  const [advances, setAdvances]           = useState<Record<number, string>>({});
  const [wages, setWages]                 = useState<Record<number, string>>({});
  const [remarks, setRemarks]             = useState<Record<number, string>>({});
  const [overtimeHours, setOvertimeHours] = useState<Record<number, string>>({});
  const [overtimeRate, setOvertimeRate]   = useState<Record<number, string>>({});
  const [pendingStatus, setPendingStatus] = useState<Record<number, Status>>({}); 
  const [rowSaving, setRowSaving]         = useState<Record<number, boolean>>({});
  const [savingAll, setSavingAll]         = useState(false);

  // Quick-expense inline form
  const [showExpense, setShowExpense]   = useState(false);
  const [expAmt, setExpAmt]             = useState("");
  const [expCat, setExpCat]             = useState("Food");
  const [expDesc, setExpDesc]           = useState("");
  const [expSaving, setExpSaving]       = useState(false);

  const projectId = String(project.id);

  const { data: todayData, refetch } = useQuery({
    queryKey: ["attendance-today", projectId, date],
    queryFn:  () => fetchApi(`/attendance/today?project_id=${projectId}&date=${date}`),
    enabled:  isOpen,
  });

  const rows: AttendanceRow[] = (todayData?.data ?? []).map((r: Record<string, unknown>) => ({
    ...r,
    today_status: (r.today_status as Status) || null,
  }));

  const presentCount = rows.filter((r) => r.today_status === "present").length;
  const halfCount    = rows.filter((r) => r.today_status === "half_day").length;
  const absentCount  = rows.filter((r) => r.today_status === "absent").length;
  const unmarkedCount = rows.length - presentCount - halfCount - absentCount;

  const saveMutation = useMutation({
    mutationFn: async ({ row, status }: { row: AttendanceRow; status: Status }) => {
      if (!status) return;
      const parsedAdvance = parseFloat(advances[row.id] ?? String(row.advance_given ?? 0)) || 0;
      if (parsedAdvance < 0) {
        throw new Error(t("invalid_advance") || "Advance cannot be negative");
      }
      const otHours = parseFloat(overtimeHours[row.id] ?? String(row.overtime_hours ?? 0)) || 0;
      const otRate  = parseFloat(overtimeRate[row.id]  ?? String(row.overtime_rate_per_hour ?? 0)) || 0;
      if (otHours < 0) throw new Error("Overtime hours cannot be negative");
      if (otRate  < 0) throw new Error("Overtime rate cannot be negative");
      if (otHours > 0 && otRate === 0) throw new Error("Enter rate (PKR/hr) when overtime hours > 0");
      const body = {
        project_id: parseInt(projectId),
        labour_id: row.id,
        date,
        status,
        advance_given: parsedAdvance,
        overtime_hours: otHours,
        wage_for_day: wages[row.id] !== undefined ? (wages[row.id] === "" ? null : parseFloat(wages[row.id])) : undefined,
        attendance_remarks: remarks[row.id] !== undefined ? remarks[row.id] : undefined,
      };
      return row.attendance_id
        ? fetchApi(`/attendance/${row.attendance_id}`, { method: "PUT",  body: JSON.stringify(body) })
        : fetchApi("/attendance",                       { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: () => refetch(),
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const markAttendance = async (row: AttendanceRow, status: Status) => {
    setRowSaving((s) => ({ ...s, [row.id]: true }));
    setPendingStatus((p) => ({ ...p, [row.id]: status }));
    try {
      await saveMutation.mutateAsync({ row, status });
      const statusText = status === "half_day" ? t("half_day") : status === "present" ? t("present") : t("absent");
      toast({ title: `${row.name} → ${statusText}` });
    } finally {
      setRowSaving((s) => ({ ...s, [row.id]: false }));
      setPendingStatus((p) => ({ ...p, [row.id]: null }));
    }
  };

  const saveAll = async () => {
    const toSave = rows.filter((r) => r.today_status || pendingStatus[r.id]);
    if (!toSave.length) {
      toast({ title: t("no_attendance"), description: t("mark_first") });
      return;
    }
    setSavingAll(true);
    let saved = 0;
    for (const row of toSave) {
      const status = pendingStatus[row.id] ?? row.today_status;
      if (status) { await saveMutation.mutateAsync({ row, status }); saved++; }
    }
    setSavingAll(false);
    toast({ title: t("saved_workers").replace("{n}", String(saved)) });
  };

  const [markAllBusy, setMarkAllBusy] = useState(false);

  const markAllPresent = async () => {
    setMarkAllBusy(true);
    try {
      const res = await fetchApi("/attendance/today/make-all-present", {
        method: "POST",
        body: JSON.stringify({ project_id: parseInt(projectId), date }),
      });
      toast({ title: t("mark_all_present"), description: `${res?.count ?? 0} marked present` });
      await refetch();
    } catch (e) {
      toast({ title: t("error"), description: (e as Error).message, variant: "destructive" });
    } finally {
      setMarkAllBusy(false);
      setPendingStatus({});
    }
  };

  const clearAllPending = async () => {
    setMarkAllBusy(true);
    try {
      const res = await fetchApi(`/attendance/today?project_id=${projectId}&date=${date}`, { method: "DELETE" });
      toast({ title: t("clear_all"), description: `${res?.count ?? 0} records cleared` });
      await refetch();
    } catch (e) {
      toast({ title: t("error"), description: (e as Error).message, variant: "destructive" });
    } finally {
      setMarkAllBusy(false);
      setPendingStatus({});
    }
  };

  const addExpense = async () => {
    if (!expAmt || parseFloat(expAmt) <= 0) return;
    setExpSaving(true);
    try {
      await fetchApi("/expenses", {
        method: "POST",
        body: JSON.stringify({
          project_id: parseInt(projectId),
          date,
          category: expCat,
          description: expDesc || t("daily_category_expense").replace("{cat}", expCat),
          amount: parseFloat(expAmt),
        }),
      });
      qc.invalidateQueries({ queryKey: ["expenses"] });
      toast({ title: t("expense_added_toast"), description: `${PKR(expAmt)} — ${expCat}` });
      setExpAmt(""); setExpDesc(""); setShowExpense(false);
    } catch (e) {
      toast({ title: t("error"), description: (e as Error).message, variant: "destructive" });
    } finally {
      setExpSaving(false);
    }
  };

  const categoryLabel = (cat: string) => {
    const key = cat.toLowerCase();
    if (["food", "transport", "fuel", "tools", "safety", "other"].includes(key)) {
      return t(key as any);
    }
    return cat; // fallback to original category name
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Accordion header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <CalendarCheck className="w-4 h-4 text-primary" />
          </div>
          <div className="text-left min-w-0">
            <div className="font-semibold text-foreground text-sm truncate">{String(project.name)}</div>
            <div className="text-xs text-muted-foreground">{String(project.project_code)}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {rows.length > 0 && (
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <span className="text-green-600 font-medium">{presentCount}P</span>
              <span className="text-yellow-600 font-medium">{halfCount}H</span>
              <span className="text-red-600 font-medium">{absentCount}A</span>
              {unmarkedCount > 0 && <span className="text-muted-foreground">{unmarkedCount}?</span>}
            </div>
          )}
          {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded content */}
      {isOpen && (
        <div className="border-t border-border">
          {rows.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {t("no_workers")}
            </div>
          ) : (
            <>
              {/* Stats bar */}
              <div className="flex items-center gap-3 mx-4 my-3 p-2.5 bg-muted/40 rounded-lg text-xs font-medium">
                <span className="text-green-600">{presentCount} {t("present")}</span>
                <span className="text-yellow-600">{halfCount} {t("half")}</span>
                <span className="text-red-600">{absentCount} {t("absent")}</span>
                {unmarkedCount > 0 && <span className="text-muted-foreground">· {unmarkedCount} {t("unmarked")}</span>}
              </div>

              {rows.length > 0 && (
                <div className="flex gap-2 px-4 mb-3">
                  <Button size="sm" variant="outline" className="flex-1 text-xs font-medium" onClick={markAllPresent} disabled={markAllBusy}>{markAllBusy ? t("saving") : t("mark_all_present")}</Button>
                  <Button size="sm" variant="outline" className="flex-1 text-xs font-medium" onClick={clearAllPending} disabled={markAllBusy}>{markAllBusy ? t("saving") : t("clear_all")}</Button>
                </div>
              )}

              {/* Worker rows */}
              <div className="px-4 space-y-2 pb-2">
                {rows.map((row: AttendanceRow) => {
                  const currentStatus = row.today_status;
                  return (
                    <div
                      key={row.id}
                      className={cn("bg-background border rounded-xl p-3.5 transition-all", currentStatus ? "border-primary/30" : "border-border")}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2.5">
                        <div>
                          <div className="font-semibold text-foreground text-sm">{row.name}</div>
                          <div className="text-xs text-muted-foreground">{PKR(row.project_wage || row.daily_wage)}{t("per_day")}</div>
                        </div>
                        {currentStatus && (
                          <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium",
                            currentStatus === "present"  ? "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700" :
                            currentStatus === "half_day" ? "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700" :
                                                          "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700"
                          )}>
                            {currentStatus === "half_day" ? t("half_day") : currentStatus === "present" ? t("present") : t("absent")}
                          </span>
                        )}
                      </div>

                      <div className="flex gap-1.5 mb-2.5">
                        {STATUS_OPTS.map(({ value, label, color }) => (
                          <button
                            key={value}
                            onClick={() => markAttendance(row, value as Status)}
                            disabled={rowSaving[row.id]}
                            className={cn(
                              "flex-1 py-1.5 rounded-lg border text-xs font-semibold transition-all",
                              currentStatus === value ? color : "border-border text-muted-foreground hover:bg-muted/50"
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      {currentStatus !== "absent" && (
                        <div className="space-y-2 mt-2">
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-muted-foreground whitespace-nowrap min-w-[80px]">{t("advance")}:</label>
                            <input
                              type="number"
                              value={advances[row.id] ?? (row.advance_given > 0 ? String(row.advance_given) : "")}
                              onChange={(e) => setAdvances((a) => ({ ...a, [row.id]: e.target.value }))}
                              onBlur={() => { if (currentStatus) markAttendance(row, currentStatus); }}
                              placeholder="0"
                              className="flex-1 px-2 py-1 rounded border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-muted-foreground whitespace-nowrap min-w-[80px]">{t("custom_wage")}:</label>
                            <input
                              type="number"
                              value={wages[row.id] ?? (row.wage_for_day ? String(row.wage_for_day) : "")}
                              onChange={(e) => setWages((a) => ({ ...a, [row.id]: e.target.value }))}
                              onBlur={() => { if (currentStatus) markAttendance(row, currentStatus); }}
                              placeholder={t("leave_empty_default")}
                              className="flex-1 px-2 py-1 rounded border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                            />
                          </div>
                          {/* ── Overtime ───────────────────────────────────── */}
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-amber-600 font-medium whitespace-nowrap min-w-[80px]">OT hrs:</label>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={overtimeHours[row.id] ?? (row.overtime_hours ? String(row.overtime_hours) : "")}
                              onChange={(e) => setOvertimeHours((a) => ({ ...a, [row.id]: e.target.value }))}
                              onBlur={() => { if (currentStatus) markAttendance(row, currentStatus); }}
                              placeholder="0"
                              className="flex-1 px-2 py-1 rounded border border-amber-200 bg-background text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-amber-600 font-medium whitespace-nowrap min-w-[80px]">OT rate/hr:</label>
                            <input
                              type="number"
                              min="0"
                              value={overtimeRate[row.id] ?? (row.overtime_rate_per_hour ? String(row.overtime_rate_per_hour) : "")}
                              onChange={(e) => setOvertimeRate((a) => ({ ...a, [row.id]: e.target.value }))}
                              onBlur={() => { if (currentStatus) markAttendance(row, currentStatus); }}
                              placeholder="PKR/hr"
                              className="flex-1 px-2 py-1 rounded border border-amber-200 bg-background text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
                            />
                          </div>
                          {/* Show computed overtime total when both are filled */}
                          {(() => {
                            const h = parseFloat(overtimeHours[row.id] ?? String(row.overtime_hours ?? 0)) || 0;
                            const r = parseFloat(overtimeRate[row.id] ?? String(row.overtime_rate_per_hour ?? 0)) || 0;
                            return h > 0 && r > 0 ? (
                              <div className="text-xs text-amber-600 font-medium pl-[88px]">= PKR {(h * r).toLocaleString("en-PK")} overtime</div>
                            ) : null;
                          })()}
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-muted-foreground whitespace-nowrap min-w-[80px]">{t("remarks")}:</label>
                            <input
                              type="text"
                              value={remarks[row.id] ?? (row.attendance_remarks || "")}
                              onChange={(e) => setRemarks((a) => ({ ...a, [row.id]: e.target.value }))}
                              onBlur={() => { if (currentStatus) markAttendance(row, currentStatus); }}
                              placeholder={t("optional_remarks")}
                              className="flex-1 px-2 py-1 rounded border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Footer: Save All + Quick Expense */}
              <div className="px-4 pb-4 pt-2 space-y-2">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 font-semibold"
                    onClick={saveAll}
                    disabled={savingAll}
                  >
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    {savingAll ? t("saving") : `${t("save_all")} (${rows.filter(r => r.today_status || pendingStatus[r.id]).length})`}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="font-semibold"
                    onClick={() => setShowExpense((v) => !v)}
                  >
                    <Receipt className="w-3.5 h-3.5 mr-1.5" />
                    {t("add_quick_expense")}
                  </Button>
                </div>

                {/* Inline quick-expense form */}
                {showExpense && (
                  <div className="p-3 bg-muted/40 rounded-xl border border-border space-y-2">
                    <div className="text-xs font-semibold text-foreground">{t("quick_expense")}</div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={expAmt}
                        onChange={(e) => setExpAmt(e.target.value)}
                        placeholder={t("amount_pkr")}
                        className="flex-1 px-2 py-1.5 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                      <select
                        value={expCat}
                        onChange={(e) => setExpCat(e.target.value)}
                        className="px-2 py-1.5 rounded-lg border border-input bg-background text-xs focus:outline-none"
                      >
                        {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
                      </select>
                    </div>
                    <input
                      type="text"
                      value={expDesc}
                      onChange={(e) => setExpDesc(e.target.value)}
                      placeholder={t("expense_for")}
                      className="w-full px-2 py-1.5 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => setShowExpense(false)}>{t("cancel")}</Button>
                      <Button size="sm" className="flex-1 text-xs font-semibold" onClick={addExpense} disabled={expSaving || !expAmt}>
                        {expSaving ? t("adding") : t("add_expense")}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────
export default function Attendance() {
  const search = useSearch();
  const { t } = useLanguage();
  const params = new URLSearchParams(search);
  const presetProjectId = params.get("project_id") ?? "";

  const [date, setDate] = useState(() =>
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" })
  );
  const [openProjects, setOpenProjects] = useState<Set<string>>(new Set());

  const { data: projectsData } = useQuery({
    queryKey: ["projects-running"],
    queryFn:  () => fetchApi("/projects?status=running&limit=100"),
  });

  const projects: Record<string, unknown>[] = projectsData?.data ?? [];

  // Auto-open preset project or first project
  useEffect(() => {
    if (projects.length === 0) return;
    if (openProjects.size === 0) {
      const first = presetProjectId || String(projects[0].id);
      setOpenProjects(new Set([first]));
    }
  }, [projects]);

  const toggleProject = (id: string) => {
    setOpenProjects((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const isToday = date === new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h1 className="text-xl font-bold text-foreground">{t("labour_attendance")}</h1>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground">{t("date_label")}</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            max={new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" })}
          />
          {!isToday && (
            <span className="text-xs text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full">{t("past_date")}</span>
          )}
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CalendarCheck className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">{t("no_running_projects")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <ProjectPanel
              key={String(project.id)}
              project={project}
              date={date}
              isOpen={openProjects.has(String(project.id))}
              onToggle={() => toggleProject(String(project.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
