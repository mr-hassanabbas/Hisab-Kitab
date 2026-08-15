import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { useRoute, Link } from "wouter";
import { ArrowLeft, Phone, MapPin, User, Calendar, CheckCircle, XCircle, Clock, TrendingUp, Plus, X, Briefcase } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const PKR = (n: unknown) => `PKR ${Number(n || 0).toLocaleString("en-PK")}`;

export default function LabourDetail() {
  const { t } = useLanguage();
  const [, params] = useRoute("/labour/:id");
  const id = params?.id;
  const qc = useQueryClient();
  const { toast } = useToast();

  const [assignProject, setAssignProject] = useState("");
  const [assignWage, setAssignWage] = useState("");
  const [assignDate, setAssignDate] = useState(() => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" }));

  const STATUS_CONFIG = {
    present: { label: t("present"), color: "#16A34A", bg: "bg-green-50 dark:bg-green-900/20", text: "text-green-700 dark:text-green-400", dot: "bg-green-500" },
    half_day: { label: t("half_day"), color: "#D97706", bg: "bg-yellow-50 dark:bg-yellow-900/20", text: "text-yellow-700 dark:text-yellow-400", dot: "bg-yellow-500" },
    absent: { label: t("absent"), color: "#DC2626", bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-700 dark:text-red-400", dot: "bg-red-500" },
  };

  const { data, isLoading } = useQuery({
    queryKey: ["labour-detail", id],
    queryFn: () => fetchApi(`/labour/${id}`),
    enabled: !!id,
  });

  const { data: projectsData } = useQuery({
    queryKey: ["projects"],
    queryFn: () => fetchApi("/projects?limit=100"),
  });

  const assignMutation = useMutation({
    mutationFn: () =>
      fetchApi(`/labour/${id}/assign`, {
        method: "POST",
        body: JSON.stringify({
          project_id: parseInt(assignProject),
          daily_wage: assignWage ? parseFloat(assignWage) : undefined,
          assigned_at: assignDate,
        }),
      }),
    onSuccess: () => {
      toast({ title: t("assigned_success") });
      setAssignProject(""); setAssignWage("");
      qc.invalidateQueries({ queryKey: ["labour-detail", id] });
      qc.invalidateQueries({ queryKey: ["labour"] });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: (projectId: string) =>
      fetchApi(`/labour/${id}/remove`, { method: "POST", body: JSON.stringify({ project_id: parseInt(projectId) }) }),
    onSuccess: () => {
      toast({ title: t("removed_success") });
      qc.invalidateQueries({ queryKey: ["labour-detail", id] });
      qc.invalidateQueries({ queryKey: ["labour"] });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        {[1,2,3].map((i) => <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />)}
      </div>
    );
  }

  const labour = data?.data;
  if (!labour) return <div className="p-6 text-muted-foreground">{t("no_data")}</div>;

  const summary = labour.attendance_summary ?? {};
  const history: Record<string, unknown>[] = labour.history ?? [];
  const attHistory: Record<string, unknown>[] = labour.attendance_history ?? [];
  const fin = labour.financial_summary ?? {};

  const projects: Record<string, unknown>[] = projectsData?.data ?? [];
  const assignments: Record<string, unknown>[] = history.filter((h) => !h.removed_at);
  const assignedProjectIds = new Set(assignments.map((a) => String(a.project_id)));

  const presentDays = Number(summary.present_days ?? 0);
  const halfDays = Number(summary.half_days ?? 0);
  const absentDays = Number(summary.absent_days ?? 0);

  const pieData = [
    { name: t("present"), value: presentDays, color: "#16A34A" },
    { name: t("half_day"), value: halfDays, color: "#D97706" },
    { name: t("absent"), value: absentDays, color: "#DC2626" },
  ].filter((d) => d.value > 0);

  const totalEarned = Number(fin.total_earned ?? 0);
  const totalPaid = Number(fin.total_paid ?? 0);
  const totalRemaining = Number(fin.total_remaining ?? 0);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <Link href="/labour" className="text-muted-foreground hover:text-foreground p-1">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-foreground">{labour.name}</h1>
          <span className={cn(
            "text-xs px-2 py-0.5 rounded-full",
            labour.is_active ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"
          )}>
            {labour.is_active ? t("active") : t("inactive")}
          </span>
        </div>
      </div>

      {/* Personal Info */}
      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <h2 className="font-semibold text-foreground text-sm mb-3">{"Personal Information"}</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            { icon: Phone, label: t("phone"), value: labour.phone },
            { icon: User, label: t("fathers_name"), value: labour.fathers_name },
            { icon: MapPin, label: t("village_city"), value: labour.village },
            { icon: User, label: t("cnic"), value: labour.cnic },
            { icon: Calendar, label: t("joining_date"), value: labour.joining_date },
            { icon: TrendingUp, label: t("daily_wage"), value: labour.daily_wage ? PKR(labour.daily_wage) + t("per_day") : null },
          ].filter((item) => item.value).map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-2">
              <Icon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="text-foreground font-medium">{String(value)}</div>
              </div>
            </div>
          ))}
        </div>
        {labour.remarks && (
          <div className="mt-3 p-2.5 bg-muted/50 rounded-lg text-sm text-muted-foreground">{String(labour.remarks)}</div>
        )}
      </div>

      {/* Financial Summary */}
      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <h2 className="font-semibold text-foreground text-sm mb-3">{t("summary")}</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
            <div className="text-sm font-bold text-blue-700 dark:text-blue-400">{PKR(totalEarned)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{t("total_earned")}</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
            <div className="text-sm font-bold text-green-700 dark:text-green-400">{PKR(totalPaid)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{t("paid_label")}</div>
          </div>
          <div className={cn(
            "text-center p-3 rounded-lg",
            totalRemaining > 0 ? "bg-orange-50 dark:bg-orange-900/20" : "bg-muted"
          )}>
            <div className={cn("text-sm font-bold", totalRemaining > 0 ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground")}>
              {PKR(totalRemaining)}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">{t("pending_label")}</div>
          </div>
        </div>
      </div>

      {/* Attendance Summary + Chart */}
      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <h2 className="font-semibold text-foreground text-sm mb-3">{"Attendance Breakdown"}</h2>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
            <CheckCircle className="w-5 h-5 text-green-600 mx-auto mb-1" />
            <div className="text-lg font-bold text-green-700 dark:text-green-400">{presentDays}</div>
            <div className="text-xs text-muted-foreground">{t("present")}</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
            <Clock className="w-5 h-5 text-yellow-600 mx-auto mb-1" />
            <div className="text-lg font-bold text-yellow-700 dark:text-yellow-400">{halfDays}</div>
            <div className="text-xs text-muted-foreground">{t("half_days")}</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
            <XCircle className="w-5 h-5 text-red-600 mx-auto mb-1" />
            <div className="text-lg font-bold text-red-700 dark:text-red-400">{absentDays}</div>
            <div className="text-xs text-muted-foreground">{t("absent")}</div>
          </div>
        </div>

        {/* Donut chart */}
        {pieData.length > 0 && (
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={72}
                  paddingAngle={3}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [`${value} ${t("days")}`, name]}
                  contentStyle={{ fontSize: "12px", borderRadius: "8px" }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => <span style={{ fontSize: "12px" }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Attendance History */}
      {attHistory.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <h2 className="font-semibold text-foreground text-sm mb-3">
            {t("daily_attendance")}
            <span className="text-muted-foreground font-normal ml-1.5 text-xs">({attHistory.length} {t("entries")})</span>
          </h2>
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {attHistory.map((a: Record<string, unknown>, i) => {
              const status = String(a.status) as keyof typeof STATUS_CONFIG;
              const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.absent;
              return (
                <div key={i} className={cn("flex items-center justify-between px-3 py-2 rounded-lg", cfg.bg)}>
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full flex-shrink-0", cfg.dot)} />
                    <span className="text-xs font-medium text-foreground">{String(a.date)}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-24">{String(a.project_name ?? "")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs font-medium", cfg.text)}>{cfg.label}</span>
                    {Number(a.wage_for_day ?? 0) > 0 && (
                      <span className="text-xs text-muted-foreground">{PKR(a.wage_for_day)}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Assign to Project */}
      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <h2 className="font-semibold text-foreground text-sm mb-3 flex items-center gap-1.5">
          <Briefcase className="w-4 h-4 text-muted-foreground" />
          {t("assign_project")}
        </h2>

        {/* Assign form */}
        <div className="space-y-2.5">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t("project")}</label>
            <select
              value={assignProject}
              onChange={(e) => setAssignProject(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
            >
              <option value="">{t("select_project")}</option>
              {projects
                .filter((p) => !assignedProjectIds.has(String(p.id)))
                .map((p) => <option key={String(p.id)} value={String(p.id)}>{String(p.name)}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">{t("project_wage_opt")}</label>
              <input
                type="number"
                value={assignWage}
                onChange={(e) => setAssignWage(e.target.value)}
                placeholder={String(labour.daily_wage ?? "")}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">{t("assigned_date")}</label>
              <input
                type="date"
                value={assignDate}
                onChange={(e) => setAssignDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
          </div>
          <Button
            size="sm"
            className="w-full font-semibold"
            onClick={() => {
              if (!assignProject) { toast({ title: t("select_project_first") }); return; }
              assignMutation.mutate();
            }}
            disabled={assignMutation.isPending || !assignProject}
            data-testid="btn-assign-project"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            {assignMutation.isPending ? t("assigning") : t("assign_project")}
          </Button>
        </div>

        {/* Current assignments list */}
        <div className="mt-4">
          <div className="text-xs font-semibold text-muted-foreground mb-2">{t("current_assignments")}</div>
          {assignments.length === 0 ? (
            <div className="text-center py-5 text-muted-foreground text-sm">{t("no_assignments")}</div>
          ) : (
            <div className="space-y-2">
              {assignments.map((a, i) => (
                <div key={i} className="flex items-center justify-between gap-2 bg-muted/40 rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{String(a.project_name)}</div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-mono">{String(a.project_code)}</span>
                      {Number(a.project_wage ?? 0) > 0 && ` · ${t("project_wage_label")} ${PKR(a.project_wage)}${t("per_day")}`}
                      {a.assigned_at ? ` · ${String(a.assigned_at).substring(0, 10)}` : null}
                    </div>
                  </div>
                  <button
                    onClick={() => removeMutation.mutate(String(a.project_id))}
                    disabled={removeMutation.isPending}
                    data-testid={`btn-remove-assignment-${a.project_id}`}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-md text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 dark:text-red-400 font-medium flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" /> {t("remove")}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Project History */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h2 className="font-semibold text-foreground text-sm mb-3">{"Project History"}</h2>
        {history.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">{t("no_data")}</div>
        ) : (
          <div className="space-y-3">
            {history.map((h: Record<string, unknown>, i: number) => (
              <div key={i} className="flex items-start justify-between py-2 border-b border-border last:border-0">
                <div>
                  <div className="font-medium text-foreground text-sm">{String(h.project_name)}</div>
                  <div className="text-xs text-muted-foreground font-mono">{String(h.project_code)}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {String(h.assigned_at ?? "").substring(0, 10)}
                    {h.removed_at ? ` → ${String(h.removed_at).substring(0, 10)}` : ` → ${t("present")}`}
                  </div>
                </div>
                <div className="text-sm font-medium text-foreground">
                  {h.project_wage ? PKR(h.project_wage) + t("per_day") : "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
