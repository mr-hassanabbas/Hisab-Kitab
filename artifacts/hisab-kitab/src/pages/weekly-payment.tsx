import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { Wallet, ChevronDown, CheckCircle, Share2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/use-language";

const PKR = (n: unknown) => `PKR ${Number(n || 0).toLocaleString("en-PK")}`;

function getThursdayWeek(date = new Date()) {
  const day = date.getDay();
  const diff = (day >= 4 ? day - 4 : day + 3);
  const thu = new Date(date);
  thu.setDate(date.getDate() - diff);
  const wed = new Date(thu);
  wed.setDate(thu.getDate() + 6);
  return {
    start: thu.toISOString().split("T")[0],
    end: wed.toISOString().split("T")[0],
  };
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });
}

export default function WeeklyPayment() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [projectId, setProjectId] = useState("");
  const [week, setWeek] = useState(() => getThursdayWeek());

  const { data: projectsData } = useQuery({ queryKey: ["projects"], queryFn: () => fetchApi("/projects?status=running&limit=100") });

  const { data: paymentData, refetch } = useQuery({
    queryKey: ["weekly-payments", projectId, week.start],
    queryFn: () => fetchApi(`/payments/weekly?project_id=${projectId}&week_start=${week.start}`),
    enabled: !!projectId,
  });

  const { data: attendanceData } = useQuery({
    queryKey: ["attendance-week", projectId, week.start, week.end],
    queryFn: () => fetchApi(`/attendance?project_id=${projectId}&start_date=${week.start}&end_date=${week.end}&limit=500`),
    enabled: !!projectId,
  });

  const markPaidMutation = useMutation({
    mutationFn: ({ id, is_paid }: { id: number; is_paid: boolean }) =>
      fetchApi(`/payments/weekly/${id}`, { method: "PUT", body: JSON.stringify({ is_paid, paid_at: is_paid ? new Date().toISOString() : null }) }),
    onSuccess: () => { refetch(); toast({ title: t("payment_status_updated") }); },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      fetchApi("/payments/weekly/generate", {
        method: "POST",
        body: JSON.stringify({ project_id: parseInt(projectId), week_start: week.start, week_end: week.end }),
      }),
    onSuccess: () => { refetch(); toast({ title: t("weekly_generated") }); },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const projects: Record<string, unknown>[] = projectsData?.data ?? [];
  const payments: Record<string, unknown>[] = paymentData?.data ?? [];
  const totalDue = payments.reduce((s, p) => s + Number(p.net_payable ?? p.remaining ?? 0), 0);
  const totalPaid = payments.filter((p) => p.is_paid).reduce((s, p) => s + Number(p.net_payable ?? p.remaining ?? 0), 0);
  const selectedProject = projects.find((p) => String(p.id) === projectId);

  const handleWhatsAppShare = () => {
    if (!payments.length) return;
    const projectName = selectedProject ? String(selectedProject.name) : t("project");
    const lines = [
      t("wa_title"),
      `🏗️ ${projectName}`,
      `${t("wa_week")} ${formatDate(week.start)} ${t("to")} ${formatDate(week.end)}`,
      ``,
      ...payments.map((p) => {
        const prevBal = Number(p.previous_balance ?? 0);
        const netPay = Number(p.remaining ?? 0);
        let line = `• ${String(p.labour_name)}: ${PKR(netPay)}`;
        if (prevBal > 0) line += ` (${t("wa_incl_prev")} ${PKR(prevBal)})`;
        if (p.is_paid) line += ` ✅`;
        return line;
      }),
      ``,
      `${t("wa_total_due")} ${PKR(totalDue)}`,
      `${t("wa_paid")} ${PKR(totalPaid)}`,
      `${t("wa_pending")} ${PKR(totalDue - totalPaid)}`,
    ];
    const text = lines.join("\n");
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-foreground mb-5">{t("labour_weekly_payments_title")}</h1>

      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-medium text-foreground mb-1">{t("project")}</label>
          <div className="relative">
            <select data-testid="select-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}
              className="w-full pl-3 pr-8 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none appearance-none">
              <option value="">{t("select_project")}</option>
              {projects.map((p: Record<string, unknown>) => <option key={String(p.id)} value={String(p.id)}>{String(p.name)}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">{t("week_start")}</label>
          <input data-testid="input-week-start" type="date" value={week.start}
            onChange={(e) => {
              const d = new Date(e.target.value);
              const end = new Date(d); end.setDate(d.getDate() + 6);
              setWeek({ start: e.target.value, end: end.toISOString().split("T")[0] });
            }}
            className="px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
      </div>

      {projectId && (
        <div className="text-xs text-muted-foreground mb-4">
          {t("week_label")} <strong className="text-foreground">{week.start}</strong> {t("to")} <strong className="text-foreground">{week.end}</strong>
        </div>
      )}

      {projectId && (
        <div className="flex gap-3 mb-4 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="btn-fetch-data">
            {t("fetch_data")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} data-testid="btn-generate-payments">
            {generateMutation.isPending ? t("generating") : t("generate")}
          </Button>
          {payments.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleWhatsAppShare} className="text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-900/20">
              <MessageCircle className="w-4 h-4 mr-1.5" />
              {t("share_whatsapp")}
            </Button>
          )}
        </div>
      )}

      {payments.length > 0 && (
        <div className="p-3 bg-muted/50 rounded-lg mb-4 flex gap-4 text-sm flex-wrap">
          <span>{t("total_due")} <strong className="text-foreground">{PKR(totalDue)}</strong></span>
          <span>{t("paid_label")} <strong className="text-green-600">{PKR(totalPaid)}</strong></span>
          <span>{t("pending_label")} <strong className="text-orange-600">{PKR(totalDue - totalPaid)}</strong></span>
        </div>
      )}

      {!projectId ? (
        <div className="text-center py-16 text-muted-foreground">
          <Wallet className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">{t("no_weekly_project")}</p>
        </div>
      ) : payments.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {t("no_weekly_data")}
        </div>
      ) : (
        <div className="space-y-2">
          {payments.map((p: Record<string, unknown>) => {
            const prevBal = Number(p.previous_balance ?? 0);
            const totalEarned = Number(p.total_earned ?? 0);
            const advTotal = Number(p.advance_total ?? 0);
            const netPay = Number(p.remaining ?? 0);
            const breakdown: Array<{ project_name: string; days_worked: number; total_earned: number; advance_total: number }> =
              Array.isArray(p.breakdown) ? p.breakdown : [];
            return (
              <div key={String(p.id)} className={cn("bg-card border rounded-xl p-4", p.is_paid ? "border-green-300 dark:border-green-700" : "border-border")} data-testid={`row-payment-${p.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-foreground text-sm">{String(p.labour_name)}</div>
                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      <div>
                        {Number(p.days_worked ?? p.total_days)} {t("days")} · {t("earned_label")} {PKR(totalEarned)}
                        {advTotal > 0 && <span className="text-red-500"> − {t("advance_label")} {PKR(advTotal)}</span>}
                      </div>
                      {prevBal > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-xs font-medium">
                            {t("prev_balance")} −{PKR(prevBal)}
                          </span>
                        </div>
                      )}
                      {breakdown.length > 1 && (
                        <div className="mt-1.5 pt-1.5 border-t border-border/60">
                          <div className="text-[11px] font-semibold text-muted-foreground mb-1">{t("per_project_breakdown")}</div>
                          <div className="space-y-0.5">
                            {breakdown.map((b, bi) => (
                              <div key={bi} className="flex items-center justify-between text-[11px]">
                                <span className="text-muted-foreground truncate pr-2">{b.project_name}</span>
                                <span className="text-foreground font-medium flex-shrink-0">
                                  {Number(b.days_worked ?? 0)} {t("days")} · {PKR(b.total_earned)}
                                  {Number(b.advance_total ?? 0) > 0 && <span className="text-red-500"> −{PKR(b.advance_total)}</span>}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-foreground">{PKR(netPay)}</div>
                    <div className="text-xs text-muted-foreground">{t("pay_today")}</div>
                    <button
                      data-testid={`btn-mark-paid-${p.id}`}
                      onClick={() => markPaidMutation.mutate({ id: p.id as number, is_paid: !p.is_paid })}
                      className={cn(
                        "text-xs px-2.5 py-1 rounded-full font-medium mt-1.5 transition-colors",
                        p.is_paid ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
                      )}
                    >
                      {p.is_paid ? t("tick_paid") : t("mark_paid")}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {payments.length > 0 && (
        <p className="text-xs text-muted-foreground mt-4 text-center">
          {t("whatsapp_note")}
        </p>
      )}
    </div>
  );
}
