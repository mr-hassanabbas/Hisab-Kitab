import { useRef, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { useSearch } from "wouter";
import { Plus, CreditCard, Trash2, Edit, MoreVertical, ChevronDown, Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { compressImage } from "@/lib/imageCompression";

const PKR = (n: unknown) => `PKR ${Number(n || 0).toLocaleString("en-PK")}`;

interface PaymentForm {
  project_id: string; date: string; amount: string; payment_method: string; notes: string;
  receipt_photo: string;
}

const METHODS = ["Cash", "Cheque", "Bank Transfer", "JazzCash", "EasyPaisa"];

const emptyForm: PaymentForm = {
  project_id: "", date: new Date().toISOString().split("T")[0], amount: "", payment_method: "Cash", notes: "", receipt_photo: ""
};

// Use shared compressImage

export default function Payments() {
  const { t } = useLanguage();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const presetProjectId = params.get("project_id") ?? "";
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<PaymentForm>({ ...emptyForm, project_id: presetProjectId });
  const [filterProject, setFilterProject] = useState(presetProjectId);
  const [photoLoading, setPhotoLoading] = useState(false);

  // Guide direct-link pre-fill (?action=new)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("action") === "new") {
      setEditId(null);
      setForm({ ...emptyForm, project_id: presetProjectId });
      setShowForm(true);
    }
  }, []);

  const { data: projectsData } = useQuery({ queryKey: ["projects"], queryFn: () => fetchApi("/projects?limit=100") });

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["owner-payments", filterProject],
    queryFn: ({ pageParam = 1 }) => fetchApi(`/payments/owner?page=${pageParam}&limit=30${filterProject ? `&project_id=${filterProject}` : ""}`),
    getNextPageParam: (lastPage) => {
      const p = lastPage.pagination;
      return p.page < p.totalPages ? p.page + 1 : undefined;
    },
    initialPageParam: 1,
  });

  const saveMutation = useMutation({
    mutationFn: (d: PaymentForm) => {
      const amt = parseFloat(d.amount);
      if (isNaN(amt) || amt <= 0) {
        throw new Error(t("invalid_amount") || "Amount must be greater than zero");
      }
      const body = { ...d, amount: amt, receipt_photo: d.receipt_photo || null };
      return editId ? fetchApi(`/payments/owner/${editId}`, { method: "PUT", body: JSON.stringify(body) })
        : fetchApi("/payments/owner", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["owner-payments"] }); setShowForm(false); setEditId(null); setForm(emptyForm); toast({ title: editId ? t("payment_updated") : t("payment_added") }); },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetchApi(`/payments/owner/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["owner-payments"] }); toast({ title: t("payment_deleted") }); },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const projects: Record<string, unknown>[] = projectsData?.data ?? [];
  const payments: Record<string, unknown>[] = data?.pages.flatMap((p) => p.data) ?? [];
  const total = Number(data?.pages[0]?.total_received ?? payments.reduce((s, p) => s + Number(p.amount ?? 0), 0));

  const METHOD_COLORS: Record<string, string> = {
    Cash: "bg-green-100 text-green-700", Cheque: "bg-blue-100 text-blue-700",
    "Bank Transfer": "bg-purple-100 text-purple-700", JazzCash: "bg-orange-100 text-orange-700",
    EasyPaisa: "bg-teal-100 text-teal-700",
  };

  const openEdit = (p: Record<string, unknown>) => {
    setEditId(p.id as number);
    setForm({
      project_id: String(p.project_id), date: String(p.date), amount: String(p.amount),
      payment_method: String(p.payment_method), notes: String(p.notes ?? ""),
      receipt_photo: String(p.receipt_photo ?? ""),
    });
    setShowForm(true);
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoLoading(true);
    try {
      const res = await compressImage(file);
      toast({ title: `Photo compressed from ${(res.originalSizeKB / 1024).toFixed(1)}MB to ${Math.round(res.compressedSizeKB)}KB` });
      setForm((f) => ({ ...f, receipt_photo: res.dataUrl }));
    } catch {
      toast({ title: t("error"), description: t("image_load_error"), variant: "destructive" });
    } finally {
      setPhotoLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const closeForm = () => { setShowForm(false); setEditId(null); setForm(emptyForm); };

  const methodLabel = (method: string) => {
    const key = method.toLowerCase().replace(" ", "_");
    if (["cash", "cheque", "bank_transfer", "jazzcash", "easypaisa"].includes(key)) {
      return t(key as any);
    }
    return method;
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-foreground">{t("owner_payments")}</h1>
        <Button size="sm" onClick={() => { setEditId(null); setForm({ ...emptyForm, project_id: filterProject }); setShowForm(true); }} data-testid="btn-add-payment">
          <Plus className="w-4 h-4 mr-1" /> {t("add_payment")}
        </Button>
      </div>

      <div className="mb-4">
        <div className="relative">
          <select data-testid="select-project-filter" value={filterProject} onChange={(e) => setFilterProject(e.target.value)}
            className="w-full pl-3 pr-8 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none appearance-none">
            <option value="">{t("all_projects")}</option>
            {projects.map((p: Record<string, unknown>) => <option key={String(p.id)} value={String(p.id)}>{String(p.name)}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {payments.length > 0 && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg mb-4 text-sm border border-green-200 dark:border-green-800 font-medium">
          {t("total_received")} <strong className="text-green-700 dark:text-green-400">{PKR(total)}</strong> · {payments.length} {t("payments_count")}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-14 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : payments.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">{t("no_payments")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {payments.map((p: Record<string, unknown>) => {
            const receiptPhoto = typeof p.receipt_photo === "string" ? p.receipt_photo : "";
            return (
              <div key={String(p.id)} className="bg-card border border-border rounded-xl p-4 flex items-start justify-between gap-3" data-testid={`row-payment-${p.id}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${METHOD_COLORS[String(p.payment_method)] || "bg-muted text-muted-foreground"}`}>{methodLabel(String(p.payment_method))}</span>
                    <span className="text-xs text-muted-foreground">{String(p.date)}</span>
                    {receiptPhoto && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">{t("receipt_badge")}</span>
                    )}
                  </div>
                  {!!p.notes && <div className="text-xs text-muted-foreground mt-0.5">{String(p.notes)}</div>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-bold text-green-600 dark:text-green-400">{PKR(Number(p.amount ?? 0))}</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="text-muted-foreground hover:text-foreground p-1"><MoreVertical className="w-4 h-4" /></button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(p)}><Edit className="w-4 h-4 mr-2" />{t("edit")}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => confirm(t("delete_payment_confirm")) && deleteMutation.mutate(p.id as number)} className="text-destructive"><Trash2 className="w-4 h-4 mr-2" />{t("delete")}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hasNextPage && (
        <div className="mt-4 flex justify-center pb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="w-full sm:w-auto"
          >
            {isFetchingNextPage ? t("loading") : t("load_more") || "Load More"}
          </Button>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoSelect}
      />

      <Dialog open={showForm} onOpenChange={(o) => { if (!o) closeForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? t("edit_payment") : t("add_payment_received")}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">{t("project_required")}</label>
              <select data-testid="select-project" value={form.project_id} onChange={(e) => setForm((f) => ({ ...f, project_id: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none">
                <option value="">{t("select_project")}</option>
                {projects.map((p: Record<string, unknown>) => <option key={String(p.id)} value={String(p.id)}>{String(p.name)}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{t("date")}</label>
                <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{t("amount_pkr")} *</label>
                <input data-testid="input-amount" type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">{t("payment_method")}</label>
              <select value={form.payment_method} onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none">
                {METHODS.map((m) => <option key={m} value={m}>{methodLabel(m)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">{t("notes")}</label>
              <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} placeholder={t("any_notes")}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none" />
            </div>

            {/* Receipt Photo */}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">{t("receipt_photo")}</label>
              {form.receipt_photo ? (
                <div className="relative inline-block">
                  <img src={form.receipt_photo} alt={t("receipt_alt")} className="h-28 w-auto rounded-lg object-cover border border-border" />
                  <button
                    onClick={() => setForm((f) => ({ ...f, receipt_photo: "" }))}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center text-xs hover:opacity-90"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={photoLoading}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-input bg-muted/30 text-sm text-muted-foreground hover:bg-muted/50 transition-colors w-full"
                >
                  <Camera className="w-4 h-4" />
                  {photoLoading ? t("compressing") : t("take_photo")}
                </button>
              )}
              <p className="text-xs text-muted-foreground mt-1">{t("image_compressed")}</p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={closeForm}>{t("cancel")}</Button>
              <Button className="flex-1" onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} data-testid="btn-save-payment">
                {saveMutation.isPending ? t("saving") : editId ? t("update") : t("add_payment")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
