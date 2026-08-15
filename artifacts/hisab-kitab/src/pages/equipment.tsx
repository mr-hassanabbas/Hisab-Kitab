import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { useSearch } from "wouter";
import { Plus, Wrench, Trash2, Edit, MoreVertical, ChevronDown, Archive, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { cn } from "@/lib/utils";

const PKR = (n: unknown) => `PKR ${Number(n || 0).toLocaleString("en-PK")}`;

const EQUIPMENT_TYPES = ["Excavator", "Crane", "Mixer", "Concrete Pump", "Compactor", "Generator", "Scaffolding", "Bulldozer", "Loader", "Truck", "Other"];

interface EquipmentForm {
  project_id: string; date: string; equipment_name: string; operator_name: string;
  rental_days: string; daily_rate: string; condition: string; notes: string;
}

const emptyForm: EquipmentForm = {
  project_id: "", date: new Date().toISOString().split("T")[0],
  equipment_name: "", operator_name: "", rental_days: "1", daily_rate: "",
  condition: "", notes: "",
};

// Store condition in notes as "[Condition] notes text"
function encodeNotes(condition: string, notes: string): string {
  if (!condition && !notes) return "";
  if (!condition) return notes;
  return notes ? `[${condition}] ${notes}` : `[${condition}]`;
}

function decodeNotes(raw: string): { condition: string; notes: string } {
  const match = raw?.match?.(/^\[([^\]]+)\]\s*(.*)/s);
  if (match) return { condition: match[1], notes: match[2].trim() };
  return { condition: "", notes: raw ?? "" };
}

export default function Equipment() {
  const { t } = useLanguage();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const presetProjectId = params.get("project_id") ?? "";
  const qc = useQueryClient();
  const { toast } = useToast();

  const CONDITIONS = [
    { value: "Good",               label: t("good"),               color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    { value: "Fair",               label: t("fair"),               color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
    { value: "Poor",               label: t("poor"),               color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    { value: "Under Maintenance",  label: t("under_maintenance"),  color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  ];

  const [showForm, setShowForm]           = useState(false);
  const [editId, setEditId]               = useState<number | null>(null);
  const [form, setForm]                   = useState<EquipmentForm>({ ...emptyForm, project_id: presetProjectId });
  const [filterProject, setFilterProject] = useState(presetProjectId);
  const [showArchived, setShowArchived]   = useState(false);

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

  const { data, isLoading } = useQuery({
    queryKey: ["equipment", filterProject, showArchived],
    queryFn:  () => {
      const base = showArchived ? "/equipment" : "/equipment?active=1";
      return fetchApi(filterProject ? `${base}${showArchived ? "?" : "&"}project_id=${filterProject}` : base);
    },
  });

  const saveMutation = useMutation({
    mutationFn: (d: EquipmentForm) => {
      const body = {
        ...d,
        rental_days: parseFloat(d.rental_days),
        daily_rate: parseFloat(d.daily_rate),
        total_cost: parseFloat(d.rental_days) * parseFloat(d.daily_rate),
        notes: encodeNotes(d.condition, d.notes),
      };
      return editId
        ? fetchApi(`/equipment/${editId}`, { method: "PUT",  body: JSON.stringify(body) })
        : fetchApi("/equipment",           { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["equipment"] });
      setShowForm(false); setEditId(null); setForm(emptyForm);
      toast({ title: editId ? t("equipment_updated") : t("equipment_added") });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const archiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: number }) =>
      fetchApi(`/equipment/${id}`, { method: "PUT", body: JSON.stringify({ is_active: active }) }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["equipment"] });
      toast({ title: vars.active ? t("restore_complete") : t("photo_deleted") });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetchApi(`/equipment/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["equipment"] }); toast({ title: t("equipment_deleted") }); },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const projects: Record<string, unknown>[]  = projectsData?.data ?? [];
  const equipment: Record<string, unknown>[] = data?.data ?? [];
  const total = equipment.reduce((s, e) => s + Number(e.total_cost ?? 0), 0);

  const openEdit = (e: Record<string, unknown>) => {
    const { condition, notes } = decodeNotes(String(e.remarks ?? e.notes ?? ""));
    setEditId(e.id as number);
    setForm({
      project_id: String(e.project_id),
      date: String(e.date ?? ""),
      equipment_name: String(e.equipment_name),
      operator_name: String(e.operator_name ?? ""),
      rental_days: String(e.rental_days),
      daily_rate: String(e.daily_rate),
      condition,
      notes,
    });
    setShowForm(true);
  };

  const getCondition = (e: Record<string, unknown>) =>
    decodeNotes(String(e.remarks ?? e.notes ?? "")).condition;

  const equipmentTypeLabel = (name: string) => {
    const key = name.toLowerCase().replace(" ", "_");
    if (["excavator", "crane", "mixer", "concrete_pump", "compactor", "generator", "scaffolding", "bulldozer", "loader", "truck", "other"].includes(key)) {
      return t(key as any);
    }
    return name;
  };

  const conditionLabel = (cond: string) => {
    const match = CONDITIONS.find((c) => c.value === cond);
    return match ? match.label : cond;
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {t("equipment_title")}
          </h1>
        </div>
        <Button size="sm" onClick={() => { setEditId(null); setForm({ ...emptyForm, project_id: filterProject }); setShowForm(true); }} data-testid="btn-add-equipment">
          <Plus className="w-4 h-4 mr-1" /> {t("add_equipment")}
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
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
        <button
          onClick={() => setShowArchived((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors",
            showArchived ? "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700" : "border-border text-muted-foreground hover:bg-muted/50"
          )}
        >
          <Archive className="w-3.5 h-3.5" />
          {showArchived ? t("active") : t("danger_zone")}
        </button>
      </div>

      {equipment.length > 0 && (
        <div className="p-3 bg-muted/50 rounded-lg mb-4 text-sm font-medium">
          {t("total_label")} <strong className="text-foreground">{PKR(total)}</strong> · {equipment.length} {t("entries")}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : equipment.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Wrench className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">{t("no_equipment")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {equipment.map((e: Record<string, unknown>) => {
            const cond = getCondition(e);
            const condMeta = CONDITIONS.find((c) => c.value === cond);
            const isArchived = !e.is_active;
            return (
              <div
                key={String(e.id)}
                className={cn("bg-card border border-border rounded-xl p-4 flex items-start justify-between gap-3", isArchived && "opacity-60")}
                data-testid={`row-equipment-${e.id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="font-semibold text-foreground text-sm">
                      {equipmentTypeLabel(String(e.equipment_name))}
                    </span>
                    {condMeta && (
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", condMeta.color)}>
                        {condMeta.label}
                      </span>
                    )}
                    {isArchived && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {t("danger_zone")}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">{String(e.date)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {Number(e.rental_days)} {t("days")} @ {PKR(e.daily_rate)}{t("per_day")} = <strong className="text-foreground">{PKR(e.total_cost)}</strong>
                  </div>
                  {!!e.operator_name && (
                    <div className="text-xs text-muted-foreground">
                      {t("worker")}: {String(e.operator_name)}
                    </div>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="text-muted-foreground hover:text-foreground p-1">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {!isArchived && (
                      <DropdownMenuItem onClick={() => openEdit(e)}>
                        <Edit className="w-4 h-4 mr-2" />{t("edit")}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => archiveMutation.mutate({ id: e.id as number, active: isArchived ? 1 : 0 })}
                    >
                      {isArchived
                        ? <><RotateCcw className="w-4 h-4 mr-2" />{t("save")}</>
                        : <><Archive className="w-4 h-4 mr-2" />{t("danger_zone")}</>
                      }
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => confirm(t("delete_equipment_confirm")) && deleteMutation.mutate(e.id as number)}
                      className="text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />{t("delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setEditId(null); setForm(emptyForm); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editId ? t("edit_equipment") : t("add_equipment")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {t("project_required")}
              </label>
              <select
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
                <label className="block text-xs font-medium text-foreground mb-1">
                  {t("equipment_title")} *
                </label>
                <select
                  value={form.equipment_name}
                  onChange={(e) => setForm((f) => ({ ...f, equipment_name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
                >
                  <option value="">{t("select_option")}</option>
                  {EQUIPMENT_TYPES.map((type_item) => <option key={type_item} value={type_item}>{equipmentTypeLabel(type_item)}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {t("worker")}
              </label>
              <input
                type="text" value={form.operator_name}
                onChange={(e) => setForm((f) => ({ ...f, operator_name: e.target.value }))}
                placeholder={t("worker")}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  {t("days")}
                </label>
                <input
                  type="number" value={form.rental_days}
                  onChange={(e) => setForm((f) => ({ ...f, rental_days: e.target.value }))}
                  placeholder="1"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  {t("rental_cost")}
                </label>
                <input
                  type="number" value={form.daily_rate}
                  onChange={(e) => setForm((f) => ({ ...f, daily_rate: e.target.value }))}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
                />
              </div>
            </div>

            {/* Condition field */}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {t("status")}
              </label>
              <div className="flex gap-2 flex-wrap">
                {CONDITIONS.map(({ value, label, color }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, condition: f.condition === value ? "" : value }))}
                    className={cn(
                      "px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
                      form.condition === value ? cn(color, "border-transparent") : "border-border text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {t("notes")}
              </label>
              <input
                type="text" value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder={t("optional_remarks")}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
              />
            </div>

            {form.rental_days && form.daily_rate && (
              <div className="p-2.5 bg-primary/10 rounded-lg text-sm font-medium text-primary text-center">
                {t("total_label")} {PKR(parseFloat(form.rental_days) * parseFloat(form.daily_rate))}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm); }}>
                {t("cancel")}
              </Button>
              <Button
                className="flex-1"
                onClick={() => saveMutation.mutate(form)}
                disabled={saveMutation.isPending}
                data-testid="btn-save-equipment"
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
