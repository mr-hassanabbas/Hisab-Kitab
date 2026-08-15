import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { useSearch } from "wouter";
import { Plus, Receipt, Trash2, Edit, MoreVertical, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/use-language";

const PKR = (n: unknown) => `PKR ${Number(n || 0).toLocaleString("en-PK")}`;

const CATEGORIES = ["Food", "Transport", "Tools", "Fuel", "Labour (Extra)", "Repair", "Safety", "Office", "Utility", "Other"];

const CATEGORY_COLORS: Record<string, string> = {
  Food:      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  Transport: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Fuel:      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  Tools:     "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  Repair:    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  Safety:    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};
const catColor = (c: string) => CATEGORY_COLORS[c] ?? "bg-muted text-muted-foreground";

interface ExpenseForm {
  project_id: string; date: string; category: string;
  description: string; amount: string; paid_to: string; notes: string;
}

const emptyForm: ExpenseForm = {
  project_id: "", date: new Date().toISOString().split("T")[0],
  category: "", description: "", amount: "", paid_to: "", notes: "",
};

export default function Expenses() {
  const { t } = useLanguage();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const presetProjectId = params.get("project_id") ?? "";
  const qc = useQueryClient();
  const { toast } = useToast();

  const [showForm, setShowForm]           = useState(false);
  const [editId, setEditId]               = useState<number | null>(null);
  const [form, setForm]                   = useState<ExpenseForm>({ ...emptyForm, project_id: presetProjectId });
  const [filterProject, setFilterProject] = useState(presetProjectId);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo]     = useState("");

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
    queryKey: ["expenses", filterProject],
    queryFn:  ({ pageParam = 1 }) => fetchApi(`/expenses?page=${pageParam}&limit=30${filterProject ? `&project_id=${filterProject}` : ""}`),
    getNextPageParam: (lastPage) => {
      const p = lastPage.pagination;
      return p.page < p.totalPages ? p.page + 1 : undefined;
    },
    initialPageParam: 1,
  });

  const saveMutation = useMutation({
    mutationFn: (d: ExpenseForm) => {
      const amt = parseFloat(d.amount);
      if (isNaN(amt) || amt <= 0) {
        throw new Error(t("invalid_amount") || "Amount must be greater than zero");
      }
      const body = { ...d, amount: amt };
      return editId
        ? fetchApi(`/expenses/${editId}`, { method: "PUT",  body: JSON.stringify(body) })
        : fetchApi("/expenses",           { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      setShowForm(false); setEditId(null); setForm(emptyForm);
      toast({ title: editId ? t("expense_updated") : t("expense_added") });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetchApi(`/expenses/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["expenses"] }); toast({ title: t("expense_deleted") }); },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const projects: Record<string, unknown>[]  = projectsData?.data ?? [];
  const allExpenses: Record<string, unknown>[] = data?.pages.flatMap((p) => p.data) ?? [];

  // Client-side filtering for category + date range
  const expenses = useMemo(() => {
    return allExpenses.filter((e) => {
      if (filterCategory && e.category !== filterCategory) return false;
      if (filterDateFrom && String(e.date) < filterDateFrom)  return false;
      if (filterDateTo   && String(e.date) > filterDateTo)    return false;
      return true;
    });
  }, [allExpenses, filterCategory, filterDateFrom, filterDateTo]);

  const total = expenses.reduce((s, e) => s + Number(e.amount ?? 0), 0);

  const hasFilters = !!(filterCategory || filterDateFrom || filterDateTo);

  const clearFilters = () => {
    setFilterCategory(""); setFilterDateFrom(""); setFilterDateTo("");
  };

  const openEdit = (e: Record<string, unknown>) => {
    setEditId(e.id as number);
    setForm({
      project_id: String(e.project_id), date: String(e.date),
      category: String(e.category), description: String(e.description ?? ""),
      amount: String(e.amount), paid_to: String(e.paid_to ?? ""), notes: String(e.notes ?? ""),
    });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.project_id) {
      toast({ title: t("project_required"), variant: "destructive" });
      return;
    }
    if (!form.category) {
      toast({ title: t("category_required") || "Category is required", variant: "destructive" });
      return;
    }
    const amt = parseFloat(form.amount);
    if (isNaN(amt) || amt <= 0) {
      toast({ title: t("invalid_amount") || "Amount must be greater than zero", variant: "destructive" });
      return;
    }
    saveMutation.mutate(form);
  };

  const categoryLabel = (cat: string) => {
    const key = cat.toLowerCase().replace(" ", "_").replace("(", "").replace(")", "");
    if (["food", "transport", "tools", "fuel", "labour_extra", "repair", "safety", "office", "utility", "other"].includes(key)) {
      return t(key as any);
    }
    return cat;
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-foreground">{t("expenses_title")}</h1>
        <Button
          size="sm"
          onClick={() => { setEditId(null); setForm({ ...emptyForm, project_id: filterProject }); setShowForm(true); }}
          data-testid="btn-add-expense"
        >
          <Plus className="w-4 h-4 mr-1" /> {t("add_expense_title")}
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-4 space-y-2">
        {/* Row 1: Project + clear */}
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="w-full pl-3 pr-8 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none appearance-none"
            >
              <option value="">{t("all_projects")}</option>
              {projects.map((p: Record<string, unknown>) => (
                <option key={String(p.id)} value={String(p.id)}>{String(p.name)}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-2 py-2 transition-colors"
            >
              <X className="w-3.5 h-3.5" /> {t("clear")}
            </button>
          )}
        </div>

        {/* Row 2: Date range */}
        <div className="flex gap-2 items-center">
          <div className="flex items-center gap-2 flex-1">
            <label className="text-xs text-muted-foreground whitespace-nowrap">{t("from_label")}</label>
            <input
              type="date" value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="flex-1 px-2 py-2 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <div className="flex items-center gap-2 flex-1">
            <label className="text-xs text-muted-foreground whitespace-nowrap">{t("to_label")}</label>
            <input
              type="date" value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="flex-1 px-2 py-2 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
        </div>

        {/* Row 3: Category chips */}
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory((c) => c === cat ? "" : cat)}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                filterCategory === cat
                  ? cn(catColor(cat), "border-transparent")
                  : "border-border text-muted-foreground hover:bg-muted/50"
              )}
            >
              {categoryLabel(cat)}
            </button>
          ))}
        </div>
      </div>

      {(expenses.length > 0 || hasFilters) && (
        <div className="p-3 bg-muted/50 rounded-lg mb-4 text-sm flex items-center justify-between font-medium">
          <span>{t("total_label")} <strong className="text-foreground">{PKR(total)}</strong> · {expenses.length} {t("entries")}</span>
          {hasFilters && allExpenses.length !== expenses.length && (
            <span className="text-xs text-muted-foreground">({t("filtered_from")} {allExpenses.length})</span>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-14 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Receipt className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">{hasFilters ? t("no_expenses_filter") : t("no_expenses")}</p>
          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-primary mt-1 hover:underline">{t("clear_filters")}</button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map((e: Record<string, unknown>) => (
            <div
              key={String(e.id)}
              className="bg-card border border-border rounded-xl p-4 flex items-start justify-between gap-3"
              data-testid={`row-expense-${e.id}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className={cn("text-xs px-2 py-0.5 rounded-full", catColor(String(e.category)))}>{categoryLabel(String(e.category))}</span>
                  <span className="text-xs text-muted-foreground">{String(e.date)}</span>
                </div>
                {!!e.description && <div className="text-sm text-foreground">{String(e.description)}</div>}
                {!!e.paid_to && <div className="text-xs text-muted-foreground">{t("paid_to")}: {String(e.paid_to)}</div>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="font-semibold text-foreground">{PKR(e.amount)}</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="text-muted-foreground hover:text-foreground p-1"><MoreVertical className="w-4 h-4" /></button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(e)}><Edit className="w-4 h-4 mr-2" />{t("edit")}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => confirm(t("delete_expense_confirm")) && deleteMutation.mutate(e.id as number)} className="text-destructive">
                      <Trash2 className="w-4 h-4 mr-2" />{t("delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
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

      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setEditId(null); setForm(emptyForm); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? t("edit_expense") : t("add_expense_title")}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{t("project_required")}</label>
                <select
                  value={form.project_id}
                  onChange={(e) => setForm((f) => ({ ...f, project_id: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
                >
                  <option value="">{t("select_option")}</option>
                  {projects.map((p: Record<string, unknown>) => (
                    <option key={String(p.id)} value={String(p.id)}>{String(p.name)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{t("date")}</label>
                <input
                  type="date" value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{t("category")} *</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
                >
                  <option value="">{t("select_option")}</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{t("amount_pkr")} *</label>
                <input
                  type="number" value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">{t("description")}</label>
              <input
                type="text" value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder={t("expense_for")}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">{t("paid_to")}</label>
              <input
                type="text" value={form.paid_to}
                onChange={(e) => setForm((f) => ({ ...f, paid_to: e.target.value }))}
                placeholder={t("paid_to_placeholder")}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm); }}>{t("cancel")}</Button>
              <Button className="flex-1" onClick={handleSave} disabled={saveMutation.isPending} data-testid="btn-save-expense">
                {saveMutation.isPending ? t("saving") : editId ? t("update") : t("add")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
