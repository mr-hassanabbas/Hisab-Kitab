import { useRef, useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { useSearch } from "wouter";
import { Plus, BookOpen, Trash2, Edit, MoreVertical, ChevronDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/use-language";

const WEATHER_OPTIONS = ["Sunny", "Cloudy", "Rainy", "Hot", "Windy", "Foggy"];
const WEATHER_ICONS: Record<string, string> = {
  Sunny: "☀️", Cloudy: "⛅", Rainy: "🌧️", Hot: "🌡️", Windy: "💨", Foggy: "🌫️",
};

const SUGGESTION_CHIPS = [
  "Owner visited site",
  "Work progress on schedule",
  "Issues faced today",
  "Materials received",
] as const;

interface DiaryForm {
  project_id: string;
  date: string;
  weather: string;
  work_summary: string;
  notes: string;
}

const emptyForm: DiaryForm = {
  project_id: "", date: new Date().toISOString().split("T")[0], weather: "", work_summary: "", notes: "",
};

export default function Diary() {
  const { t } = useLanguage();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const presetProjectId = params.get("project_id") ?? "";
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<DiaryForm>({ ...emptyForm, project_id: presetProjectId });
  const [filterProject, setFilterProject] = useState(presetProjectId);
  const [filterSearch, setFilterSearch]   = useState("");

  // Guide direct-link pre-fill (?action=new)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("action") === "new") {
      setEditId(null);
      setForm({ ...emptyForm, project_id: presetProjectId });
      setShowForm(true);
    }
  }, []);

  // Ref to the work_summary textarea for cursor-position insert
  const summaryRef = useRef<HTMLTextAreaElement>(null);

  const { data: projectsData } = useQuery({ queryKey: ["projects"], queryFn: () => fetchApi("/projects?limit=100") });

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["diary", filterProject],
    queryFn: ({ pageParam = 1 }) =>
      fetchApi(`/diary?page=${pageParam}&limit=30${filterProject ? `&project_id=${filterProject}` : ""}`),
    getNextPageParam: (lastPage) => {
      const p = lastPage.pagination;
      return p.page < p.totalPages ? p.page + 1 : undefined;
    },
    initialPageParam: 1,
  });

  const saveMutation = useMutation({
    mutationFn: (d: DiaryForm) =>
      editId
        ? fetchApi(`/diary/${editId}`, { method: "PUT", body: JSON.stringify(d) })
        : fetchApi("/diary", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["diary"] });
      setShowForm(false);
      setEditId(null);
      setForm(emptyForm);
      toast({ title: editId ? t("entry_updated") : t("entry_added") });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetchApi(`/diary/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["diary"] }); toast({ title: t("entry_deleted") }); },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const projects: Record<string, unknown>[] = projectsData?.data ?? [];
  const rawEntries: Record<string, unknown>[] = data?.pages.flatMap((p) => p.data) ?? [];

  const entries = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    if (!q) return rawEntries;
    return rawEntries.filter((e) =>
      String(e.work_summary ?? "").toLowerCase().includes(q) ||
      String(e.notes ?? "").toLowerCase().includes(q)
    );
  }, [rawEntries, filterSearch]);

  const openEdit = (e: Record<string, unknown>) => {
    setEditId(e.id as number);
    setForm({
      project_id: String(e.project_id),
      date: String(e.date),
      weather: String(e.weather ?? ""),
      work_summary: String(e.work_summary),
      notes: String(e.notes ?? ""),
    });
    setShowForm(true);
  };

  // Insert chip text at the current cursor position in work_summary
  const insertChip = (chip: string) => {
    const chipText = t(chipKey(chip) as any);
    const el = summaryRef.current;
    const current = form.work_summary;
    if (!el) {
      // Fallback: append
      const sep = current && !current.endsWith("\n") ? "\n" : "";
      setForm((f) => ({ ...f, work_summary: f.work_summary + sep + chipText }));
      return;
    }
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    const before = current.slice(0, start);
    const after = current.slice(end);
    // Add a newline before if we're mid-text and the cursor isn't at a line boundary
    const prefix = before.length > 0 && !before.endsWith("\n") ? "\n" : "";
    const newValue = before + prefix + chipText + after;
    setForm((f) => ({ ...f, work_summary: newValue }));
    // Restore cursor after React re-render
    const newCursor = start + prefix.length + chipText.length;
    setTimeout(() => {
      if (el) {
        el.focus();
        el.setSelectionRange(newCursor, newCursor);
      }
    }, 0);
  };

  const weatherLabel = (w: string) => {
    const key = w.toLowerCase();
    if (["sunny", "cloudy", "rainy", "hot", "windy", "foggy"].includes(key)) {
      return t(key as any);
    }
    return w;
  };

  const chipKey = (chip: string) => {
    if (chip === "Owner visited site") return "suggestion_owner_visit";
    if (chip === "Work progress on schedule") return "suggestion_progress";
    if (chip === "Issues faced today") return "suggestion_issues";
    if (chip === "Materials received") return "suggestion_materials";
    return chip;
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-foreground">{t("daily_diary")}</h1>
        <Button
          size="sm"
          onClick={() => { setEditId(null); setForm({ ...emptyForm, project_id: filterProject }); setShowForm(true); }}
          data-testid="btn-add-entry"
        >
          <Plus className="w-4 h-4 mr-1" /> {t("add_entry")}
        </Button>
      </div>

      <div className="mb-4 space-y-2">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder={t("search_diary")}
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            data-testid="input-diary-search"
            className="w-full pl-9 pr-8 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          {filterSearch && (
            <button onClick={() => setFilterSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {/* Project filter */}
        <div className="relative">
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
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">{t("no_entries")}</p>
          <p className="text-xs mt-1">{t("add_first_entry")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((e: Record<string, unknown>) => (
            <div key={String(e.id)} className="bg-card border border-border rounded-xl p-4" data-testid={`card-diary-${e.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-foreground">{String(e.date)}</span>
                    {!!e.weather && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <span>{WEATHER_ICONS[String(e.weather)] || ""}</span> {weatherLabel(String(e.weather))}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">{String(e.work_summary)}</p>
                  {!!e.notes && <p className="text-xs text-muted-foreground mt-2 italic">{String(e.notes)}</p>}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="text-muted-foreground hover:text-foreground p-1 flex-shrink-0">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(e)}>
                      <Edit className="w-4 h-4 mr-2" /> {t("edit")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => confirm(t("delete_entry_confirm")) && deleteMutation.mutate(e.id as number)}
                      className="text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> {t("delete")}
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

      {/* ── Diary Entry Dialog ────────────────────────────────────────────── */}
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setEditId(null); setForm(emptyForm); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? t("edit_entry") : t("new_diary_entry")}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{t("project_required")}</label>
                <select
                  data-testid="select-project"
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
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">{t("weather")}</label>
              <div className="flex gap-2 flex-wrap">
                {WEATHER_OPTIONS.map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, weather: f.weather === w ? "" : w }))}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                      form.weather === w
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {WEATHER_ICONS[w] || ""} {weatherLabel(w)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">{t("work_summary_required")}</label>

              {/* ── Quick-insert chips ──────────────────────────────────── */}
              <div className="flex gap-1.5 flex-wrap mb-2">
                {SUGGESTION_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => insertChip(chip)}
                    className="px-2.5 py-1 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-medium hover:bg-primary/15 transition-colors active:scale-95"
                    data-testid={`chip-${chip.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    + {t(chipKey(chip) as any)}
                  </button>
                ))}
              </div>

              <textarea
                ref={summaryRef}
                data-testid="input-work-summary"
                value={form.work_summary}
                onChange={(e) => setForm((f) => ({ ...f, work_summary: e.target.value }))}
                rows={4}
                placeholder={t("work_summary_placeholder")}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">{t("additional_notes")}</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder={t("additional_notes_placeholder")}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none resize-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm); }}>
                {t("cancel")}
              </Button>
              <Button
                className="flex-1"
                onClick={() => saveMutation.mutate(form)}
                disabled={saveMutation.isPending || !form.project_id || !form.work_summary.trim()}
                data-testid="btn-save-diary"
              >
                {saveMutation.isPending ? t("saving") : editId ? t("update") : t("save_entry")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
