import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { Link } from "wouter";
import { Plus, Search, MapPin, User, Calendar, MoreVertical, Edit, Trash2, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/use-language";

const STATUS_COLORS: Record<string, string> = {
  running: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  completed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  paused: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
};

interface ProjectFormData {
  name: string; status: string; owner_name: string; owner_phone: string; owner_cnic: string;
  location: string; site_address: string; agreement_amount: string;
  start_date: string; expected_end: string; notes: string;
}

const emptyForm: ProjectFormData = {
  name: "", status: "running", owner_name: "", owner_phone: "", owner_cnic: "",
  location: "", site_address: "", agreement_amount: "", start_date: "", expected_end: "", notes: ""
};

export default function Projects() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<ProjectFormData>(emptyForm);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("action") === "new") {
        setShowForm(true);
      }
    }
  }, []);

  // Voice assistant form pre-fill
  useEffect(() => {
    const handleVoiceForm = (e: Event) => {
      const data = (e as CustomEvent<Record<string, string>>).detail ?? {};
      setForm((prev) => ({
        ...prev,
        name: data.name || prev.name,
        owner_name: data.ownerName || prev.owner_name,
        location: data.location || prev.location,
        agreement_amount: data.amount || prev.agreement_amount,
      }));
      setShowForm(true);
    };
    window.addEventListener("voiceOpenForm", handleVoiceForm);
    return () => window.removeEventListener("voiceOpenForm", handleVoiceForm);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["projects", search, statusFilter],
    queryFn: () => fetchApi(`/projects?search=${encodeURIComponent(search)}&status=${statusFilter}&limit=100`),
  });

  const saveMutation = useMutation({
    mutationFn: (d: ProjectFormData) => {
      const body = { ...d, agreement_amount: d.agreement_amount ? parseFloat(d.agreement_amount) : undefined };
      return editId
        ? fetchApi(`/projects/${editId}`, { method: "PUT", body: JSON.stringify(body) })
        : fetchApi("/projects", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      setShowForm(false); setEditId(null); setForm(emptyForm);
      toast({ title: editId ? t("project_updated") : t("project_created") });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetchApi(`/projects/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); toast({ title: t("project_deleted") }); },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const projects: Record<string, unknown>[] = data?.data ?? [];

  const openEdit = (p: Record<string, unknown>) => {
    setEditId(p.id as number);
    setForm({
      name: String(p.name ?? ""), status: String(p.status ?? "running"),
      owner_name: String(p.owner_name ?? ""), owner_phone: String(p.owner_phone ?? ""), owner_cnic: String(p.owner_cnic ?? ""),
      location: String(p.location ?? ""), site_address: String(p.site_address ?? ""),
      agreement_amount: p.agreement_amount ? String(p.agreement_amount) : "",
      start_date: String(p.start_date ?? ""), expected_end: String(p.expected_end ?? ""),
      notes: String(p.notes ?? ""),
    });
    setShowForm(true);
  };

  // Translate status for display
  const statusLabel = (s: string) => {
    if (s === "running") return t("running");
    if (s === "completed") return t("completed");
    if (s === "paused") return t("paused");
    return s;
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h1 className="text-xl font-bold text-foreground">{t("projects")}</h1>
        <Button onClick={() => { setEditId(null); setForm(emptyForm); setShowForm(true); }} className="gap-2" data-testid="btn-add-project">
          <Plus className="w-4 h-4" /> {t("new_project")}
        </Button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            data-testid="input-search-projects"
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={t("search_projects")}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div className="flex flex-1 items-center gap-1.5 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
          {[
            { value: "", label: t("all_status") },
            { value: "running", label: t("running") },
            { value: "completed", label: t("completed") },
            { value: "paused", label: t("paused") },
          ].map((s) => (
            <button
              key={s.value}
              onClick={() => setStatusFilter(s.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                statusFilter === s.value
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
        <div className="space-y-3">
          {[1,2,3].map((i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FolderKanban className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium text-foreground">{t("no_projects")}</p>
          <p className="text-sm mt-1">{t("add_first_project_hint")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((p: Record<string, unknown>) => (
            <div key={String(p.id)} className="bg-card border border-border rounded-xl p-4 hover:shadow-sm transition-shadow" data-testid={`card-project-${p.id}`}>
              <div className="flex items-start justify-between gap-3">
                <Link href={`/projects/${p.id}`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-foreground">{String(p.name)}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_COLORS[String(p.status)] || STATUS_COLORS.paused)}>
                      {statusLabel(String(p.status))}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono mb-2">{String(p.project_code)}</div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><User className="w-3 h-3" /> {String(p.owner_name)}</span>
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {String(p.location)}</span>
                    {!!p.start_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {String(p.start_date)}</span>}
                  </div>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button data-testid={`btn-project-menu-${p.id}`} className="text-muted-foreground hover:text-foreground p-1 rounded">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(p)}>
                      <Edit className="w-4 h-4 mr-2" /> {t("edit")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => confirm(t("delete_project_confirm")) && deleteMutation.mutate(p.id as number)} className="text-destructive">
                      <Trash2 className="w-4 h-4 mr-2" /> {t("delete")}
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
          <DialogHeader><DialogTitle>{editId ? t("edit_project") : t("new_project")}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            {([
              ["name", t("project_name") + " *", "text", t("project_name")],
              ["owner_name", t("owner_name") + " *", "text", t("owner_name")],
              ["owner_phone", t("owner_phone"), "tel", "03XXXXXXXXX"],
              ["owner_cnic", t("owner_cnic"), "text", "XXXXX-XXXXXXX-X"],
              ["location", t("location") + " *", "text", t("location")],
              ["site_address", t("site_address"), "text", t("site_address")],
              ["agreement_amount", t("agreement_amount"), "number", "0"],
              ["start_date", t("start_date"), "date", ""],
              ["expected_end", t("expected_end"), "date", ""],
            ] as [keyof ProjectFormData, string, string, string][]).map(([key, label, type, placeholder]) => (
              <div key={key}>
                <label className="block text-xs font-medium text-foreground mb-1">{label}</label>
                <input
                  data-testid={`input-${key}`}
                  type={type}
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">{t("status")}</label>
              <select data-testid="select-status" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none">
                <option value="running">{t("running")}</option>
                <option value="completed">{t("completed")}</option>
                <option value="paused">{t("paused")}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">{t("notes")}</label>
              <textarea data-testid="input-notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm); }}>{t("cancel")}</Button>
              <Button className="flex-1" onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} data-testid="btn-save-project">
                {saveMutation.isPending ? t("saving") : editId ? t("update") : t("create")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
