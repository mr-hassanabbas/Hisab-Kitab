import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { useLanguage } from "@/hooks/use-language";
import { Link } from "wouter";
import {
  FolderKanban, Users, CalendarCheck, TrendingUp,
  Plus, ArrowRight, Wallet, BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Cell } from "recharts";

function StatCard({ icon: Icon, label, value, color, href }: {
  icon: React.ElementType; label: string; value: string | number; color: string; href: string;
}) {
  return (
    <Link href={href} className="block bg-card border border-border rounded-xl p-5 hover:shadow-md transition-all group">
      <div className="flex items-start justify-between mb-3">
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", color)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="text-2xl font-bold text-foreground mb-0.5">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </Link>
  );
}

export default function Dashboard() {
  const { t } = useLanguage();

  const { data: projectsData } = useQuery({
    queryKey: ["projects"],
    queryFn:  () => fetchApi("/projects?limit=100"),
  });

  const { data: labourData } = useQuery({
    queryKey: ["labour"],
    queryFn:  () => fetchApi("/labour?active=1"),
  });

  const { data: todayAttendance } = useQuery({
    queryKey: ["attendance-today-dash"],
    queryFn: async () => {
      const projects = projectsData?.data ?? [];
      if (!projects.length) return null;
      const today = new Date().toISOString().slice(0, 10);
      return fetchApi(`/attendance?date=${today}`);
    },
    enabled: !!projectsData,
  });

  const { data: diaryData } = useQuery({
    queryKey: ["diary-recent"],
    queryFn:  () => fetchApi("/diary?limit=5"),
  });

  const { data: expensesData } = useQuery({
    queryKey: ["expenses-recent"],
    queryFn:  () => fetchApi("/expenses?limit=5"),
  });

  const { data: attendanceData } = useQuery({
    queryKey: ["attendance-recent"],
    queryFn:  () => fetchApi("/attendance?limit=5"),
  });

  const projects          = projectsData?.data ?? [];
  const activeProjects    = projects.filter((p: Record<string, unknown>) => p.status === "running").length;
  const completedProjects = projects.filter((p: Record<string, unknown>) => p.status === "completed").length;
  const totalLabour       = labourData?.data?.length ?? 0;
  const presentToday      = (todayAttendance?.data ?? []).filter(
    (l: Record<string, unknown>) => l.status === "present" || l.status === "half_day"
  ).length ?? 0;

  // ── Merged Recent Activity ────────────────────────────────────────
  type ActivityItem = {
    id: string;
    type: "diary" | "expense" | "attendance";
    date: string;
    label: string;
    sub: string;
    href: string;
  };

  const rawActivity: ActivityItem[] = [
    ...((diaryData?.data ?? []) as Record<string, unknown>[]).map((e) => ({
      id:    `diary-${e.id}`,
      type:  "diary" as const,
      date:  String(e.date ?? ""),
      label: String(e.work_summary ?? e.note ?? "").slice(0, 60),
      sub:   "Diary entry",
      href:  "/diary",
    })),
    ...((expensesData?.data ?? []) as Record<string, unknown>[]).map((e) => ({
      id:    `expense-${e.id}`,
      type:  "expense" as const,
      date:  String(e.date ?? ""),
      label: `${e.category} — PKR ${Number(e.amount ?? 0).toLocaleString("en-PK")}`,
      sub:   String(e.description ?? "Expense"),
      href:  "/expenses",
    })),
    ...((attendanceData?.data ?? []) as Record<string, unknown>[]).map((e) => ({
      id:    `att-${e.id}`,
      type:  "attendance" as const,
      date:  String(e.date ?? ""),
      label: `${e.labour_name ?? "Attendance"} — ${String(e.status ?? "").replace("_", " ")}`,
      sub:   `${e.project_name ?? ""}${e.advance_given ? ` · Advance PKR ${Number(e.advance_given).toLocaleString("en-PK")}` : ""}`,
      href:  "/attendance",
    })),
  ];

  const recentActivity = rawActivity
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .slice(0, 5);

  const ACTIVITY_ICON: Record<ActivityItem["type"], string> = {
    diary: "📓",
    expense: "🧾",
    attendance: "📋",
  };

  const today = new Date().toLocaleDateString("en-PK", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    timeZone: "Asia/Karachi",
  });

  const QUICK_ACTIONS = [
    { href: "/attendance",      label: t("mark_attendance"), icon: CalendarCheck, color: "text-blue-500"   },
    { href: "/expenses",        label: t("add_expense"),     icon: TrendingUp,    color: "text-orange-500" },
    { href: "/labour",          label: t("add_labour"),      icon: Users,         color: "text-purple-500" },
    { href: "/diary",           label: t("diary_entry"),     icon: FolderKanban,  color: "text-green-500"  },
    { href: "/weekly-payment",  label: t("weekly_payments"), icon: Wallet,        color: "text-amber-500"  },
    { href: "/reports",         label: t("view_reports"),    icon: BarChart3,     color: "text-sky-500"    },
  ];

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t("dashboard")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{today}</p>
        </div>
        <Link
          href="/projects"
          className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          <Plus className="w-4 h-4" /> {t("new_project")}
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard icon={FolderKanban} label={t("active_projects")} value={activeProjects}    color="bg-blue-500"   href="/projects"    />
        <StatCard icon={FolderKanban} label={t("completed")}       value={completedProjects}  color="bg-green-500"  href="/projects"    />
        <StatCard icon={Users}        label={t("total_labour")}    value={totalLabour}        color="bg-purple-500" href="/labour"      />
        <StatCard icon={CalendarCheck} label={t("present_today")}  value={presentToday}       color="bg-amber-500"  href="/attendance"  />
      </div>

      {/* Main content grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Active Projects */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground text-sm">{t("active_projects")}</h2>
            <Link href="/projects" className="text-xs text-primary hover:underline">{t("view_all")}</Link>
          </div>
          {projects.filter((p: Record<string, unknown>) => p.status === "running").length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <FolderKanban className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{t("no_active_projects")}</p>
              <Link href="/projects" className="text-xs text-primary mt-1 block hover:underline">{t("add_first_project")}</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {projects
                .filter((p: Record<string, unknown>) => p.status === "running")
                .slice(0, 5)
                .map((p: Record<string, unknown>) => (
                  <Link
                    key={String(p.id)}
                    href={`/projects/${p.id}`}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-colors group"
                    data-testid={`card-project-${p.id}`}
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-foreground text-sm truncate">{String(p.name)}</div>
                      <div className="text-xs text-muted-foreground">{String(p.project_code)} · {String(p.location)}</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground text-sm">{t("recent_activity")}</h2>
            <Link href="/diary" className="text-xs text-primary hover:underline">{t("view_diary")}</Link>
          </div>
          {recentActivity.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{t("no_activity")}</p>
              <p className="text-xs mt-1">{t("activity_sub")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-start gap-3 border-l-2 border-primary/30 pl-3 hover:opacity-80 transition-opacity"
                  data-testid={`activity-${item.id}`}
                >
                  <span className="text-base leading-none mt-0.5">{ACTIVITY_ICON[item.type]}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground line-clamp-1">{item.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.date}{item.sub ? ` · ${item.sub}` : ""}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Expense Breakdown & Trends Chart */}
      <div className="mt-4 bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-foreground text-sm flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-500" />
            {t("expense_trends") || "Recent Expense Visual Breakdown"}
          </h2>
          <Link href="/reports" className="text-xs text-primary hover:underline">{t("view_reports")}</Link>
        </div>

        {((expensesData?.data ?? []) as Record<string, unknown>[]).length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p className="text-xs">{t("no_expense_chart_data") || "No expense data recorded yet for charts"}</p>
          </div>
        ) : (
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={
                Object.entries(
                  ((expensesData?.data ?? []) as Record<string, unknown>[]).reduce((acc: Record<string, number>, e) => {
                    const cat = String(e.category ?? "Expense");
                    acc[cat] = (acc[cat] || 0) + Number(e.amount ?? 0);
                    return acc;
                  }, {})
                ).map(([name, amount]) => ({ name, amount }))
              }>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: number) => `PKR ${Number(v).toLocaleString("en-PK")}`} />
                <Bar dataKey="amount" fill="#F59E0B" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Quick Actions — 6 buttons in a 2×3 grid */}
      <div className="mt-4 bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground text-sm mb-4">{t("quick_actions")}</h2>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {QUICK_ACTIONS.map(({ href, label, icon: Icon, color }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-2 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-center"
            >
              <Icon className={cn("w-5 h-5", color)} />
              <span className="text-xs font-medium text-foreground leading-tight">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
