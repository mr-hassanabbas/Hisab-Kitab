import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { useRoute, Link } from "wouter";
import { ArrowLeft, Users, Plus, Trash2, MapPin, User, Phone, Calendar, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/hooks/use-auth";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const PKR = (n: unknown) => `PKR ${Number(n || 0).toLocaleString("en-PK")}`;

export default function ProjectDetail() {
  const { t } = useLanguage();
  const { isAdmin } = useAuth();
  const [, params] = useRoute("/projects/:id");
  const id = params?.id;
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showAssign, setShowAssign] = useState(false);
  const [assignForm, setAssignForm] = useState({ labour_id: "", daily_wage: "" });
  const [showAssignMason, setShowAssignMason] = useState(false);
  const [assignMasonForm, setAssignMasonForm] = useState({ mason_id: "", daily_wage: "" });
  const [activeTab, setActiveTab] = useState<"overview" | "labour" | "mason" | "links" >("overview");

  const { data, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => fetchApi(`/projects/${id}`),
    enabled: !!id,
  });

  const { data: labourData } = useQuery({
    queryKey: ["labour-for-project", id],
    queryFn: () => fetchApi(`/labour?project_id=${id}`),
    enabled: !!id,
  });

  const { data: allLabourData } = useQuery({
    queryKey: ["labour-all"],
    queryFn: () => fetchApi("/labour?active=1"),
    enabled: showAssign,
  });

  const { data: masonData } = useQuery({
    queryKey: ["mason-for-project", id],
    queryFn: () => fetchApi(`/mason?project_id=${id}`),
    enabled: !!id,
  });

  const { data: allMasonData } = useQuery({
    queryKey: ["mason-all"],
    queryFn: () => fetchApi("/mason?active=1"),
    enabled: showAssignMason,
  });

  const allLabourDataList: Record<string, unknown>[] = allLabourData?.data ?? [];
  const selectedLabour = allLabourDataList.find((l) => String(l.id) === assignForm.labour_id) as Record<string, any> | undefined;

  const assignMutation = useMutation({
    mutationFn: (d: { labour_id: string; daily_wage: string }) => {
      const wageValue = d.daily_wage?.trim();
      return fetchApi(`/labour/${d.labour_id}/assign`, {
        method: "POST",
        body: JSON.stringify({
          project_id: id,
          daily_wage: wageValue === "" ? undefined : parseFloat(wageValue),
        }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["labour-for-project", id] });
      setShowAssign(false); setAssignForm({ labour_id: "", daily_wage: "" });
      toast({ title: t("assigned_success") });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: (labourId: number) =>
      fetchApi(`/labour/${labourId}/assign/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["labour-for-project", id] });
      toast({ title: t("removed_success") });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const assignMasonMutation = useMutation({
    mutationFn: (d: { mason_id: string; daily_wage: string }) => {
      const wageValue = d.daily_wage?.trim();
      return fetchApi(`/mason/${d.mason_id}/assign`, {
        method: "POST",
        body: JSON.stringify({
          project_id: id,
          daily_wage: wageValue === "" ? undefined : parseFloat(wageValue),
        }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mason-for-project", id] });
      setShowAssignMason(false); setAssignMasonForm({ mason_id: "", daily_wage: "" });
      toast({ title: t("assigned_success") });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const removeMasonMutation = useMutation({
    mutationFn: (masonId: number) =>
      fetchApi(`/mason/${masonId}/remove`, { method: "POST", body: JSON.stringify({ project_id: Number(id) }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mason-for-project", id] });
      toast({ title: t("removed_success") });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="p-6"><div className="h-40 bg-muted animate-pulse rounded-xl" /></div>;

  const project = data?.data;
  const stats = project?.stats ?? {};
  const assigned: Record<string, unknown>[] = labourData?.data ?? [];
  const unassigned = allLabourDataList.filter((l) => !assigned.find((a) => a.id === l.id));

  const assignedMason: Record<string, unknown>[] = masonData?.data ?? [];
  const allMasonDataList: Record<string, unknown>[] = allMasonData?.data ?? [];
  const unassignedMason = allMasonDataList.filter((m) => !assignedMason.find((a) => a.id === m.id));
  const selectedMason = allMasonDataList.find((m) => String(m.id) === assignMasonForm.mason_id) as Record<string, any> | undefined;

  if (!project) return <div className="p-6 text-muted-foreground">{t("no_data")}</div>;

  const balance = (Number(stats.total_received ?? 0)) - (Number(stats.total_wages ?? 0) + Number(stats.total_expenses ?? 0) + Number(stats.total_materials ?? 0) + Number(stats.total_equipment ?? 0));

  const TABS = [
    { id: "overview" as const, label: t("overview") },
    { id: "labour"   as const, label: `${t("labour")} (${assigned.length})` },
    { id: "mason"    as const, label: `${t("mason")} (${assignedMason.length})` },
    { id: "links"    as const, label: t("quick_links") },
  ];

  // Translate status for project
  const statusLabel = (s: string) => {
    if (s === "running") return t("running");
    if (s === "completed") return t("completed");
    if (s === "paused") return t("paused");
    return s;
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Link href="/projects" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-foreground truncate">{project.name}</h1>
          <div className="text-xs text-muted-foreground font-mono">{project.project_code}</div>
        </div>
        <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0",
          project.status === "running" ? "bg-green-100 text-green-700" :
          project.status === "completed" ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700"
        )}>{statusLabel(project.status)}</span>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-4 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ─────────────────────────────────────────────── */}
      {activeTab === "overview" && <>
        {/* Project Info */}
        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="w-4 h-4 flex-shrink-0" />
              <div><div className="text-xs text-muted-foreground">{t("owner_name")}</div><div className="text-foreground font-medium">{project.owner_name}</div></div>
            </div>
            {project.owner_phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="w-4 h-4 flex-shrink-0" />
                <div><div className="text-xs text-muted-foreground">{t("owner_phone")}</div><div className="text-foreground font-medium">{project.owner_phone}</div></div>
              </div>
            )}
            {project.owner_cnic && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="w-4 h-4 flex-shrink-0" />
                <div><div className="text-xs text-muted-foreground">{t("owner_cnic")}</div><div className="text-foreground font-medium">{project.owner_cnic}</div></div>
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <div><div className="text-xs text-muted-foreground">{t("location")}</div><div className="text-foreground font-medium">{project.location}</div></div>
            </div>
            {project.agreement_amount && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <DollarSign className="w-4 h-4 flex-shrink-0" />
                <div><div className="text-xs text-muted-foreground">{t("agreement")}</div><div className="text-foreground font-medium">{PKR(project.agreement_amount)}</div></div>
              </div>
            )}
            {project.start_date && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-4 h-4 flex-shrink-0" />
                <div><div className="text-xs text-muted-foreground">{t("start_date")}</div><div className="text-foreground font-medium">{project.start_date}</div></div>
              </div>
            )}
            {project.expected_end && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-4 h-4 flex-shrink-0" />
                <div><div className="text-xs text-muted-foreground">{t("expected_end")}</div><div className="text-foreground font-medium">{project.expected_end}</div></div>
              </div>
            )}
          </div>
        </div>

        {/* Financial Summary */}
        {isAdmin && (
          <div className="bg-card border border-border rounded-xl p-4 mb-4">
            <h2 className="font-semibold text-foreground text-sm mb-3">{t("summary")}</h2>
            {project.agreement_amount ? (
              <div className="space-y-3 mb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <div className="text-xs text-muted-foreground">{t("received")}</div>
                    <div className="text-foreground font-semibold">{PKR(stats.total_received ?? 0)} {t("payment_received_of")} {PKR(project.agreement_amount)}</div>
                  </div>
                  <div className="text-xs font-medium text-muted-foreground">{Math.round(Math.min(100, (Number(stats.total_received ?? 0) / Number(project.agreement_amount)) * 100))}%</div>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-200 overflow-hidden">
                  <div className="h-full bg-[#F59E0B] transition-all" style={{ width: `${Math.min(100, project.agreement_amount ? ((Number(stats.total_received ?? 0) / Number(project.agreement_amount)) * 100) : 0)}%` }} />
                </div>
              </div>
            ) : (
              <div className="mb-4 text-sm text-muted-foreground">{t("set_agreement_track")}</div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: t("labour_wages"), value: stats.total_wages ?? 0, color: "text-orange-600" },
                { label: t("expenses_title"), value: stats.total_expenses ?? 0, color: "text-red-600" },
                { label: t("materials_title"), value: stats.total_materials ?? 0, color: "text-blue-600" },
                { label: t("equipment_title"), value: stats.total_equipment ?? 0, color: "text-purple-600" },
                { label: t("received"), value: stats.total_received ?? 0, color: "text-green-600" },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center p-2 rounded-lg bg-muted/50">
                  <div className={cn("text-lg font-bold", color)}>{PKR(value)}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            {/* Recharts Visual Breakdown */}
            {((Number(stats.total_wages ?? 0) + Number(stats.total_expenses ?? 0) + Number(stats.total_materials ?? 0) + Number(stats.total_equipment ?? 0)) > 0) && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="text-xs font-semibold text-foreground mb-3">{t("cost_distribution" as any) || "Cost Distribution & Budget Curve"}</div>
                <div className="grid md:grid-cols-2 gap-4 items-center">
                  <div className="h-44 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: t("labour_wages"), value: Number(stats.total_wages ?? 0), fill: "#F97316" },
                            { name: t("expenses_title"), value: Number(stats.total_expenses ?? 0), fill: "#EF4444" },
                            { name: t("materials_title"), value: Number(stats.total_materials ?? 0), fill: "#3B82F6" },
                            { name: t("equipment_title"), value: Number(stats.total_equipment ?? 0), fill: "#A855F7" },
                          ].filter((d) => d.value > 0)}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={65}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        />
                        <Tooltip formatter={(v: number) => PKR(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="h-44 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[
                          { name: t("received"), amount: Number(stats.total_received ?? 0), fill: "#22C55E" },
                          { name: t("total_cost"), amount: (Number(stats.total_wages ?? 0) + Number(stats.total_expenses ?? 0) + Number(stats.total_materials ?? 0) + Number(stats.total_equipment ?? 0)), fill: "#EF4444" },
                          ...(project.agreement_amount ? [{ name: t("agreement"), amount: Number(project.agreement_amount), fill: "#3B82F6" }] : []),
                        ]}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                        <Tooltip formatter={(v: number) => PKR(v)} />
                        <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                          {[
                            <Cell key="0" fill="#22C55E" />,
                            <Cell key="1" fill="#EF4444" />,
                            <Cell key="2" fill="#3B82F6" />,
                          ]}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            <div className={cn("mt-3 p-3 rounded-lg text-center text-sm font-semibold", balance >= 0 ? "bg-green-50 text-green-700 dark:bg-green-900/20" : "bg-red-50 text-red-700 dark:bg-red-900/20")}>
              {t("balance")}: {PKR(Math.abs(balance))} {balance >= 0 ? t("surplus") : t("deficit")}
            </div>
          </div>
        )}
      </>}

      {/* ── Labour Tab ───────────────────────────────────────────────── */}
      {activeTab === "labour" && <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-foreground text-sm flex items-center gap-2">
            <Users className="w-4 h-4" /> {t("assigned_labour")} ({assigned.length})
          </h2>
          <Button size="sm" variant="outline" onClick={() => setShowAssign(true)} data-testid="btn-assign-labour">
            <Plus className="w-3.5 h-3.5 mr-1" /> {t("assign" as any)}
          </Button>
        </div>
        {assigned.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">{t("no_workers")}</div>
        ) : (
          <div className="space-y-2">
            {assigned.map((l: Record<string, unknown>) => (
              <div key={String(l.id)} className="flex items-center justify-between py-2 border-b border-border last:border-0" data-testid={`row-labour-${l.id}`}>
                <div>
                  <div className="font-medium text-foreground text-sm">{String(l.name)}</div>
                  <div className="text-xs text-muted-foreground">{l.project_wage ? `${PKR(l.project_wage)}${t("per_day")}` : l.daily_wage ? `${PKR(l.daily_wage)}${t("per_day")}` : "—"}</div>
                </div>
                <button onClick={() => confirm(t("remove_labour_q")) && removeMutation.mutate(l.id as number)}
                  className="text-muted-foreground hover:text-destructive transition-colors p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>}

      {/* ── Mason Tab ────────────────────────────────────────────────── */}
      {activeTab === "mason" && <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-foreground text-sm flex items-center gap-2">
            <Users className="w-4 h-4" /> {t("assigned_mason")} ({assignedMason.length})
          </h2>
          <Button size="sm" variant="outline" onClick={() => setShowAssignMason(true)} data-testid="btn-assign-mason">
            <Plus className="w-3.5 h-3.5 mr-1" /> {t("assign" as any)}
          </Button>
        </div>
        {assignedMason.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">{t("no_workers")}</div>
        ) : (
          <div className="space-y-2">
            {assignedMason.map((m: Record<string, unknown>) => (
              <div key={String(m.id)} className="flex items-center justify-between py-2 border-b border-border last:border-0" data-testid={`row-mason-${m.id}`}>
                <div>
                  <div className="font-medium text-foreground text-sm">{String(m.name)}</div>
                  <div className="text-xs text-muted-foreground">{m.project_wage ? `${PKR(m.project_wage)}${t("per_day")}` : m.daily_wage ? `${PKR(m.daily_wage)}${t("per_day")}` : "—"}</div>
                </div>
                <button onClick={() => confirm(t("remove_mason_q")) && removeMasonMutation.mutate(m.id as number)}
                  className="text-muted-foreground hover:text-destructive transition-colors p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>}

      {/* ── Quick Links Tab ───────────────────────────────────────────── */}
      {activeTab === "links" && <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {[
          { href: `/attendance?project_id=${id}`, label: `📋 ${t("attendance")}` },
          { href: `/expenses?project_id=${id}`, label: `🧾 ${t("expenses")}` },
          { href: `/materials?project_id=${id}`, label: `🧱 ${t("materials")}` },
          { href: `/equipment?project_id=${id}`, label: `🏗️ ${t("equipment")}` },
          { href: `/payments?project_id=${id}`, label: `💰 ${t("payments")}` },
          { href: `/diary?project_id=${id}`, label: `📓 ${t("diary")}` },
        ].map(({ href, label }) => (
          <Link key={href} href={href}>
            <a className="block text-center p-4 rounded-xl bg-card border border-border text-sm font-medium text-foreground hover:bg-muted/50 hover:border-primary/40 transition-colors">
              {label}
            </a>
          </Link>
        ))}
      </div>}

      <Dialog open={showAssign} onOpenChange={setShowAssign}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("assign_labour_title")}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">{t("select_labour")}</label>
              <select data-testid="select-assign-labour" value={assignForm.labour_id} onChange={(e) => setAssignForm((f) => ({ ...f, labour_id: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none">
                <option value="">{t("select_option")}</option>
                {unassigned.map((l: Record<string, unknown>) => (
                  <option key={String(l.id)} value={String(l.id)}>{String(l.name)} {l.daily_wage ? `(${PKR(l.daily_wage)}${t("per_day")})` : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">{t("project_wage_opt")}</label>
              <input data-testid="input-assign-wage" type="number" value={assignForm.daily_wage}
                onChange={(e) => setAssignForm((f) => ({ ...f, daily_wage: e.target.value }))}
                placeholder={selectedLabour?.daily_wage ? `${t("leave_empty_default")}: Rs. ${selectedLabour.daily_wage}${t("per_day")}` : t("leave_empty_default")}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              {selectedLabour?.daily_wage && (
                <p className="text-xs text-muted-foreground mt-1">{t("leave_empty_default")}: Rs. {selectedLabour.daily_wage}{t("per_day")}</p>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowAssign(false)}>{t("cancel")}</Button>
              <Button className="flex-1" onClick={() => assignMutation.mutate(assignForm)} disabled={assignMutation.isPending || !assignForm.labour_id} data-testid="btn-confirm-assign">
                {assignMutation.isPending ? t("assigning") : t("assign" as any)}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAssignMason} onOpenChange={setShowAssignMason}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("assign_mason_title")}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">{t("select_mason")}</label>
              <select data-testid="select-assign-mason" value={assignMasonForm.mason_id} onChange={(e) => setAssignMasonForm((f) => ({ ...f, mason_id: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none">
                <option value="">{t("select_option")}</option>
                {unassignedMason.map((m: Record<string, unknown>) => (
                  <option key={String(m.id)} value={String(m.id)}>{String(m.name)} {m.daily_wage ? `(${PKR(m.daily_wage)}${t("per_day")})` : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">{t("project_wage_opt")}</label>
              <input data-testid="input-assign-mason-wage" type="number" value={assignMasonForm.daily_wage}
                onChange={(e) => setAssignMasonForm((f) => ({ ...f, daily_wage: e.target.value }))}
                placeholder={selectedMason?.daily_wage ? `${t("leave_empty_default")}: Rs. ${selectedMason.daily_wage}${t("per_day")}` : t("leave_empty_default")}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              {selectedMason?.daily_wage && (
                <p className="text-xs text-muted-foreground mt-1">{t("leave_empty_default")}: Rs. {selectedMason.daily_wage}{t("per_day")}</p>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowAssignMason(false)}>{t("cancel")}</Button>
              <Button className="flex-1" onClick={() => assignMasonMutation.mutate(assignMasonForm)} disabled={assignMasonMutation.isPending || !assignMasonForm.mason_id} data-testid="btn-confirm-assign-mason">
                {assignMasonMutation.isPending ? t("assigning") : t("assign" as any)}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
