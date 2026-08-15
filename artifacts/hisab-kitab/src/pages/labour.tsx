import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { Link } from "wouter";
import { Plus, Search, Phone, MapPin, MoreVertical, Edit, Trash2, Users, ToggleLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/use-language";

interface LabourFormData {
  name: string; phone: string; cnic: string; fathers_name: string;
  village: string; daily_wage: string; overtime_rate_per_hour: string; joining_date: string; remarks: string;
}

const emptyForm: LabourFormData = { name: "", phone: "", cnic: "", fathers_name: "", village: "", daily_wage: "", overtime_rate_per_hour: "", joining_date: "", remarks: "" };

export default function Labour() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<LabourFormData>(emptyForm);

  // Voice assistant form pre-fill
  useEffect(() => {
    const handleVoiceForm = (e: Event) => {
      const data = (e as CustomEvent<Record<string, string>>).detail ?? {};
      setForm((prev) => ({
        ...prev,
        name: data.labourName || prev.name,
        daily_wage: data.wage || prev.daily_wage,
      }));
      setShowForm(true);
    };
    window.addEventListener("voiceOpenForm", handleVoiceForm);
    return () => window.removeEventListener("voiceOpenForm", handleVoiceForm);
  }, []);

  // Guide direct-link pre-fill (?action=new)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "new") {
      setEditId(null);
      setForm({ ...emptyForm });
      setShowForm(true);
    }
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["labour", search, activeFilter],
    queryFn: () => fetchApi(`/labour?search=${encodeURIComponent(search)}${activeFilter !== "" ? `&active=${activeFilter}` : ""}`),
  });

  const saveMutation = useMutation({
    mutationFn: (d: LabourFormData) => {
      const body = { 
        ...d, 
        daily_wage: d.daily_wage ? parseFloat(d.daily_wage) : undefined,
        overtime_rate_per_hour: d.overtime_rate_per_hour ? parseFloat(d.overtime_rate_per_hour) : undefined,
      };
      return editId
        ? fetchApi(`/labour/${editId}`, { method: "PUT", body: JSON.stringify(body) })
        : fetchApi("/labour", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["labour"] });
      setShowForm(false); setEditId(null); setForm(emptyForm);
      toast({ title: editId ? t("labour_updated") : t("labour_added") });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetchApi(`/labour/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["labour"] }); toast({ title: t("labour_deleted") }); },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, val }: { id: number; val: boolean }) =>
      fetchApi(`/labour/${id}`, { method: "PUT", body: JSON.stringify({ is_active: val }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["labour"] }),
  });

  const labour: Record<string, unknown>[] = data?.data ?? [];

  const openEdit = (l: Record<string, unknown>) => {
    setEditId(l.id as number);
    setForm({
      name: String(l.name ?? ""), phone: String(l.phone ?? ""), cnic: String(l.cnic ?? ""),
      fathers_name: String(l.fathers_name ?? ""), village: String(l.village ?? ""),
      daily_wage: l.daily_wage ? String(l.daily_wage) : "",
      overtime_rate_per_hour: l.overtime_rate_per_hour ? String(l.overtime_rate_per_hour) : "",
      joining_date: String(l.joining_date ?? ""), remarks: String(l.remarks ?? ""),
    });
    setShowForm(true);
  };

  const formatWage = (w: unknown) => w ? `PKR ${Number(w).toLocaleString("en-PK")}` : "—";

  // Wage is a required field. Reject save when missing/empty.
  const validateWage = (f: LabourFormData) => {
    if (f.daily_wage.trim() === "" || Number.isNaN(parseFloat(f.daily_wage))) {
      toast({ title: t("error"), description: `${t("daily_wage")} — ${t("is_required")}`, variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleSave = () => {
    if (!validateWage(form)) return;
    saveMutation.mutate(form);
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h1 className="text-xl font-bold text-foreground">{t("labour")}</h1>
        <Button onClick={() => { setEditId(null); setForm(emptyForm); setShowForm(true); }} className="gap-2" data-testid="btn-add-labour">
          <Plus className="w-4 h-4" /> {t("add_labour_title")}
        </Button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input data-testid="input-search-labour" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("search_labour")}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <div className="flex flex-1 items-center gap-1.5 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
          {[
            { value: "", label: t("all") },
            { value: "1", label: t("active") },
            { value: "0", label: t("inactive") },
          ].map((s) => (
            <button
              key={s.value}
              onClick={() => setActiveFilter(s.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                activeFilter === s.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : labour.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium text-foreground">{t("no_labour")}</p>
          <p className="text-sm mt-1">{t("add_first_labour")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {labour.map((l: Record<string, unknown>) => (
            <div key={String(l.id)} className="bg-card border border-border rounded-xl p-4" data-testid={`card-labour-${l.id}`}>
              <div className="flex items-start justify-between gap-3">
                <Link href={`/labour/${l.id}`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-foreground">{String(l.name)}</span>
                    <span className={cn("text-xs px-1.5 py-0.5 rounded-full", l.is_active ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground")}>
                      {l.is_active ? t("active") : t("inactive")}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {!!l.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{String(l.phone)}</span>}
                    {!!l.village && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{String(l.village)}</span>}
                    {!!l.daily_wage && <span className="font-medium text-foreground">{formatWage(l.daily_wage)}{t("per_day")}</span>}
                    {!!l.overtime_rate_per_hour && <span className="text-amber-600 font-medium">{formatWage(l.overtime_rate_per_hour)}/hr OT</span>}
                  </div>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button data-testid={`btn-labour-menu-${l.id}`} className="text-muted-foreground hover:text-foreground p-1 rounded">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(l)}><Edit className="w-4 h-4 mr-2" />{t("edit")}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggleActive.mutate({ id: l.id as number, val: !l.is_active })}>
                      <ToggleLeft className="w-4 h-4 mr-2" />{l.is_active ? t("mark_inactive") : t("mark_active")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => confirm(t("delete_labour_confirm")) && deleteMutation.mutate(l.id as number)} className="text-destructive">
                      <Trash2 className="w-4 h-4 mr-2" />{t("delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setEditId(null); setForm(emptyForm); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? t("edit_labour") : t("add_labour_title")}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            {[
              ["name", t("worker_name") + " *", "text", t("worker_name")],
              ["phone", t("phone"), "tel", "03XXXXXXXXX"],
              ["cnic", t("cnic"), "text", "XXXXX-XXXXXXX-X"],
              ["fathers_name", t("fathers_name"), "text", ""],
              ["village", t("village_city"), "text", ""],
              ["daily_wage", t("daily_wage") + " *", "number", "0"],
              ["overtime_rate_per_hour", "Overtime Rate (PKR/hr)", "number", "0"],
              ["joining_date", t("joining_date"), "date", ""],
            ].map(([key, label, type, placeholder]) => (
              <div key={key}>
                <label className="block text-xs font-medium text-foreground mb-1">{label}</label>
                <input data-testid={`input-${key}`} type={type} value={form[key as keyof LabourFormData]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">{t("remarks")}</label>
              <textarea data-testid="input-remarks" value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} rows={2}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm); }}>{t("cancel")}</Button>
              <Button className="flex-1" onClick={handleSave} disabled={saveMutation.isPending} data-testid="btn-save-labour">
                {saveMutation.isPending ? t("saving") : editId ? t("update") : t("add")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
