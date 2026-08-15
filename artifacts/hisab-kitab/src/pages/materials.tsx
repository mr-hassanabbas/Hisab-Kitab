import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { useSearch } from "wouter";
import { Plus, Package, Trash2, Edit, MoreVertical, ChevronDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";

const PKR = (n: unknown) => `PKR ${Number(n || 0).toLocaleString("en-PK")}`;

interface MaterialForm {
  project_id: string; date: string; material_type: string; description: string;
  quantity: string; unit: string; rate_per_unit: string; supplier: string; notes: string;
}

const MATERIAL_TYPES = ["Cement", "Bricks", "Sand", "Gravel", "Steel", "Iron", "Paint", "Tiles", "Wood", "Pipes", "Wire", "Other"];
const UNITS = ["Bags", "Pieces", "Kg", "Tons", "Cubic Feet", "Cubic Meters", "Liters", "Feet", "Meters", "Loads"];

const emptyForm: MaterialForm = {
  project_id: "", date: new Date().toISOString().split("T")[0],
  material_type: "", description: "", quantity: "", unit: "Bags", rate_per_unit: "", supplier: "", notes: "",
};

export default function Materials() {
  const { t } = useLanguage();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const presetProjectId = params.get("project_id") ?? "";
  const qc = useQueryClient();
  const { toast } = useToast();

  const [showForm, setShowForm]           = useState(false);
  const [editId, setEditId]               = useState<number | null>(null);
  const [form, setForm]                   = useState<MaterialForm>({ ...emptyForm, project_id: presetProjectId });
  const [filterProject, setFilterProject] = useState(presetProjectId);
  const [searchText, setSearchText]       = useState("");

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
    queryKey: ["materials", filterProject],
    queryFn:  ({ pageParam = 1 }) => fetchApi(`/materials?page=${pageParam}&limit=30${filterProject ? `&project_id=${filterProject}` : ""}`),
    getNextPageParam: (lastPage) => {
      const p = lastPage.pagination;
      return p.page < p.totalPages ? p.page + 1 : undefined;
    },
    initialPageParam: 1,
  });

  const saveMutation = useMutation({
    mutationFn: (d: MaterialForm) => {
      const qty = parseFloat(d.quantity);
      const rate = parseFloat(d.rate_per_unit);
      if (isNaN(qty) || qty <= 0 || isNaN(rate) || rate <= 0) {
        throw new Error(t("invalid_qty_rate") || "Quantity and rate must be greater than zero");
      }
      const body = {
        ...d,
        quantity: qty,
        rate_per_unit: rate,
        total_cost: qty * rate,
      };
      return editId
        ? fetchApi(`/materials/${editId}`, { method: "PUT",  body: JSON.stringify(body) })
        : fetchApi("/materials",           { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["materials"] });
      setShowForm(false); setEditId(null); setForm(emptyForm);
      toast({ title: editId ? t("material_updated") : t("material_added") });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetchApi(`/materials/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["materials"] }); toast({ title: t("material_deleted") }); },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const projects: Record<string, unknown>[]  = projectsData?.data ?? [];
  const allMaterials: Record<string, unknown>[] = data?.pages.flatMap((p) => p.data) ?? [];

  // Client-side text search across type, description, supplier
  const materials = useMemo(() => {
    if (!searchText.trim()) return allMaterials;
    const q = searchText.toLowerCase();
    return allMaterials.filter((m) =>
      String(m.material_type ?? "").toLowerCase().includes(q) ||
      String(m.description ?? "").toLowerCase().includes(q) ||
      String(m.supplier ?? "").toLowerCase().includes(q)
    );
  }, [allMaterials, searchText]);

  const total = materials.reduce((s, m) => s + Number(m.total_cost ?? 0), 0);

  const openEdit = (m: Record<string, unknown>) => {
    setEditId(m.id as number);
    setForm({
      project_id: String(m.project_id), date: String(m.date),
      material_type: String(m.material_type), description: String(m.description ?? ""),
      quantity: String(m.quantity), unit: String(m.unit),
      rate_per_unit: String(m.rate_per_unit), supplier: String(m.supplier ?? ""), notes: String(m.notes ?? ""),
    });
    setShowForm(true);
  };

  const materialTypeLabel = (type: string) => {
    const key = type.toLowerCase();
    if (["cement", "bricks", "sand", "gravel", "steel", "iron", "paint", "tiles", "wood", "pipes", "wire", "other"].includes(key)) {
      return t(key as any);
    }
    return type;
  };

  const unitLabel = (unit: string) => {
    const key = unit.toLowerCase().replace(" ", "_");
    if (["bags", "pieces", "kg", "tons", "cubic_feet", "cubic_meters", "liters", "feet", "meters", "loads"].includes(key)) {
      return t(key as any);
    }
    return unit;
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-foreground">{t("materials_title")}</h1>
        <Button
          size="sm"
          onClick={() => { setEditId(null); setForm({ ...emptyForm, project_id: filterProject }); setShowForm(true); }}
          data-testid="btn-add-material"
        >
          <Plus className="w-4 h-4 mr-1" /> {t("add_material")}
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-2 flex-wrap">
        {/* Project filter */}
        <div className="relative flex-1 min-w-40">
          <select
            data-testid="select-project-filter"
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

        {/* Text search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={t("search_materials")}
            className="w-full pl-9 pr-8 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          {searchText && (
            <button
              onClick={() => setSearchText("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {materials.length > 0 && (
        <div className="p-3 bg-muted/50 rounded-lg mb-4 text-sm flex items-center justify-between font-medium">
          <span>{t("total_cost_label")} <strong className="text-foreground">{PKR(total)}</strong> · {materials.length} {t("entries")}</span>
          {searchText && allMaterials.length !== materials.length && (
            <span className="text-xs text-muted-foreground">({t("filtered_from")} {allMaterials.length})</span>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : materials.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">{searchText ? `${t("no_results_for")} "${searchText}"` : t("no_materials")}</p>
          {searchText && (
            <button onClick={() => setSearchText("")} className="text-xs text-primary mt-1 hover:underline">{t("clear_search")}</button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {materials.map((m: Record<string, unknown>) => (
            <div
              key={String(m.id)}
              className="bg-card border border-border rounded-xl p-4 flex items-start justify-between gap-3"
              data-testid={`row-material-${m.id}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-foreground text-sm">{materialTypeLabel(String(m.material_type))}</span>
                  <span className="text-xs text-muted-foreground">{String(m.date)}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {Number(m.quantity)} {unitLabel(String(m.unit))} @ {PKR(m.rate_per_unit)} = <strong className="text-foreground">{PKR(m.total_cost)}</strong>
                </div>
                {!!m.description && (
                  <div className="text-xs text-muted-foreground mt-0.5">{String(m.description)}</div>
                )}
                {!!m.supplier && (
                  <div className="text-xs text-muted-foreground mt-0.5">{t("supplier")}: {String(m.supplier)}</div>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="text-muted-foreground hover:text-foreground p-1"><MoreVertical className="w-4 h-4" /></button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEdit(m)}><Edit className="w-4 h-4 mr-2" />{t("edit")}</DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => confirm(t("delete_material_confirm")) && deleteMutation.mutate(m.id as number)}
                    className="text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />{t("delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? t("edit_material") : t("add_material")}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">{t("project_required")}</label>
              <select
                data-testid="select-project"
                value={form.project_id}
                onChange={(e) => setForm((f) => ({ ...f, project_id: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
              >
                <option value="">{t("select_project")}</option>
                {projects.map((p: Record<string, unknown>) => (
                  <option key={String(p.id)} value={String(p.id)}>{String(p.name)}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{t("date")}</label>
                <input
                  type="date" value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{t("material_type")} *</label>
                <select
                  value={form.material_type}
                  onChange={(e) => setForm((f) => ({ ...f, material_type: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
                >
                  <option value="">{t("select_option")}</option>
                  {MATERIAL_TYPES.map((t_item) => <option key={t_item} value={t_item}>{materialTypeLabel(t_item)}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{t("quantity")} *</label>
                <input
                  type="number" value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{t("unit")}</label>
                <select
                  value={form.unit}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
                >
                  {UNITS.map((u) => <option key={u} value={u}>{unitLabel(u)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{t("unit_price")}</label>
                <input
                  type="number" value={form.rate_per_unit}
                  onChange={(e) => setForm((f) => ({ ...f, rate_per_unit: e.target.value }))}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
                />
              </div>
            </div>
            {form.quantity && form.rate_per_unit && (
              <div className="p-2.5 bg-primary/10 rounded-lg text-sm font-medium text-primary text-center">
                {t("total_label")} {PKR(parseFloat(form.quantity) * parseFloat(form.rate_per_unit))}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">{t("supplier")}</label>
              <input
                type="text" value={form.supplier}
                onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
                placeholder={t("supplier_name")}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">{t("description")}</label>
              <input
                type="text" value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder={t("additional_details")}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm); }}>{t("cancel")}</Button>
              <Button
                className="flex-1"
                onClick={() => saveMutation.mutate(form)}
                disabled={saveMutation.isPending}
                data-testid="btn-save-material"
              >
                {saveMutation.isPending ? t("saving") : editId ? t("update") : t("add")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
