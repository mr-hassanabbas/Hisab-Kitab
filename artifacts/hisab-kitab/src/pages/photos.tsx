import { useRef, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { useSearch } from "wouter";
import {
  Camera, Trash2, ChevronDown, X, ChevronLeft, ChevronRight,
  Upload, Plus, Filter, Pencil,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/use-language";
import { compressImage } from "@/lib/imageCompression";

const CATEGORIES = ["Progress", "Receipt", "Labour", "Owner", "Before", "After", "Other"] as const;
type Category = typeof CATEGORIES[number];

const CAT_COLORS: Record<Category, string> = {
  Progress: "bg-blue-100 text-blue-700",
  Receipt: "bg-purple-100 text-purple-700",
  Labour: "bg-amber-100 text-amber-700",
  Owner: "bg-green-100 text-green-700",
  Before: "bg-orange-100 text-orange-700",
  After: "bg-teal-100 text-teal-700",
  Other: "bg-gray-100 text-gray-600",
};

// Use shared compressImage

interface PendingPhoto {
  dataUrl: string; // compressed preview
  originalName: string;
}

interface PhotoMeta {
  id: number;
  project_id: number;
  category: string;
  caption: string | null;
  date_taken: string | null;
  created_at: string;
}

export default function Photos() {
  const { t } = useLanguage();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const presetProjectId = params.get("project_id") ?? "";
  const qc = useQueryClient();
  const { toast } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filters
  const [filterProject, setFilterProject] = useState(presetProjectId);
  const [filterCategory, setFilterCategory] = useState<Category | "">("");

  // Upload flow
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    project_id: presetProjectId,
    category: "Progress" as Category,
    caption: "",
    date_taken: new Date().toISOString().split("T")[0],
  });
  const [uploading, setUploading] = useState(false);

  // Guide direct-link pre-fill (?action=new)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("action") === "new") {
      setUploadForm({
        project_id: presetProjectId,
        category: "Progress" as Category,
        caption: "",
        date_taken: new Date().toISOString().split("T")[0],
      });
      setShowUploadForm(true);
    }
  }, []);

  // Lightbox
  const [lightbox, setLightbox] = useState<{ index: number } | null>(null);
  const [photoCache, setPhotoCache] = useState<Record<number, string>>({});
  const [loadingPhotoId, setLoadingPhotoId] = useState<number | null>(null);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Edit flow
  const [editPhoto, setEditPhoto] = useState<PhotoMeta | null>(null);
  const [editForm, setEditForm] = useState({ caption: "", category: "Progress" as Category });

  const { data: projectsData } = useQuery({
    queryKey: ["projects"],
    queryFn: () => fetchApi("/projects?limit=100"),
  });

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["photos", filterProject, filterCategory],
    queryFn: ({ pageParam = 1 }) =>
      fetchApi(`/photos?page=${pageParam}&limit=30${filterProject ? `&project_id=${filterProject}` : ""}${filterCategory ? `&category=${filterCategory}` : ""}`),
    getNextPageParam: (lastPage) => {
      const p = lastPage.pagination;
      return p.page < p.totalPages ? p.page + 1 : undefined;
    },
    initialPageParam: 1,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetchApi(`/photos/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["photos"] });
      setPhotoCache((c) => { const n = { ...c }; if (deleteId) delete n[deleteId]; return n; });
      setDeleteId(null);
      toast({ title: t("photo_deleted") });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, caption, category }: { id: number; caption: string; category: string }) =>
      fetchApi(`/photos/${id}`, {
        method: "PUT",
        body: JSON.stringify({ caption, category }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["photos"] });
      setEditPhoto(null);
      toast({ title: t("photo_updated") });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const projects: Record<string, unknown>[] = projectsData?.data ?? [];
  const photos: PhotoMeta[] = data?.pages.flatMap((p) => p.data) ?? [];

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    toast({ title: `${t("compressing")} ${files.length} ${files.length > 1 ? t("photos_word") : t("photo")}…` });
    try {
      const compressed = await Promise.all(
        files.map(async (f) => {
          const res = await compressImage(f);
          toast({ title: `Photo compressed from ${(res.originalSizeKB / 1024).toFixed(1)}MB to ${Math.round(res.compressedSizeKB)}KB` });
          return {
            dataUrl: res.dataUrl,
            originalName: f.name,
          };
        })
      );
      setPending(compressed);
      setShowUploadForm(true);
    } catch {
      toast({ title: t("compression_failed"), variant: "destructive" });
    }
    e.target.value = "";
  };

  const handleUpload = async () => {
    if (!uploadForm.project_id) {
      toast({ title: t("select_project_first"), variant: "destructive" });
      return;
    }
    if (!pending.length) return;
    setUploading(true);
    try {
      let failed = 0;
      for (const p of pending) {
        try {
          await fetchApi("/photos", {
            method: "POST",
            body: JSON.stringify({
              project_id: uploadForm.project_id,
              data_url: p.dataUrl,
              category: uploadForm.category,
              caption: uploadForm.caption || null,
              date_taken: uploadForm.date_taken,
            }),
          });
        } catch {
          failed++;
        }
      }
      qc.invalidateQueries({ queryKey: ["photos"] });
      setShowUploadForm(false);
      setPending([]);
      toast({
        title: failed > 0
          ? `${pending.length - failed} ${t("n_uploaded_n_failed").replace("{n}", String(failed))}`
          : `${pending.length} ${t("n_photos_uploaded")}`,
      });
    } finally {
      setUploading(false);
    }
  };

  const openLightbox = async (index: number) => {
    setLightbox({ index });
    const photo = photos[index];
    if (!photo || photoCache[photo.id]) return;
    setLoadingPhotoId(photo.id);
    try {
      const res = await fetchApi(`/photos/${photo.id}/data`);
      if (res.data_url) {
        setPhotoCache((c) => ({ ...c, [photo.id]: res.data_url as string }));
      }
    } finally {
      setLoadingPhotoId(null);
    }
  };

  const navigateLightbox = async (dir: -1 | 1) => {
    if (!lightbox) return;
    const next = (lightbox.index + dir + photos.length) % photos.length;
    setLightbox({ index: next });
    const photo = photos[next];
    if (!photo || photoCache[photo.id]) return;
    setLoadingPhotoId(photo.id);
    try {
      const res = await fetchApi(`/photos/${photo.id}/data`);
      if (res.data_url) {
        setPhotoCache((c) => ({ ...c, [photo.id]: res.data_url as string }));
      }
    } finally {
      setLoadingPhotoId(null);
    }
  };

  const currentPhoto = lightbox !== null ? photos[lightbox.index] : null;
  const currentDataUrl = currentPhoto ? (photoCache[currentPhoto.id] ?? null) : null;

  const categoryLabel = (cat: string) => {
    const key = cat.toLowerCase() + "_cat";
    if (["progress_cat", "receipt_cat", "labour_cat", "owner_cat", "before_cat", "after_cat", "other_cat"].includes(key)) {
      return t(key as any);
    }
    return cat;
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-foreground">{t("photos_title")}</h1>
        <Button size="sm" onClick={() => fileInputRef.current?.click()} data-testid="btn-add-photos">
          <Camera className="w-4 h-4 mr-1.5" /> {t("upload_photo")}
        </Button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={handleFilesSelected}
      />

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-36">
          <select
            data-testid="select-project-filter"
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="w-full pl-3 pr-8 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none appearance-none"
          >
            <option value="">{t("all_projects")}</option>
            {projects.map((p: Record<string, unknown>) => (
              <option key={String(p.id)} value={String(p.id)}>{String(p.name)}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterCategory("")}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
              filterCategory === "" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted")}
          >
            {t("all")}
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(filterCategory === cat ? "" : cat)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                filterCategory === cat ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted")}
            >
              {categoryLabel(cat)}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-3">{photos.length} {photos.length === 1 ? t("photo") : t("photos_word")}</p>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {[1,2,3,4,5,6].map((i) => <div key={i} className="aspect-square bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : photos.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Camera className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium">{t("no_photos")}</p>
          <p className="text-xs mt-1">{t("tap_add_photos")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {photos.map((photo, index) => (
            <div
              key={photo.id}
              data-testid={`photo-${photo.id}`}
              className="relative group aspect-square rounded-xl overflow-hidden border border-border bg-muted cursor-pointer"
              onClick={() => openLightbox(index)}
            >
              {/* Placeholder thumbnail */}
              <div className="w-full h-full flex items-center justify-center bg-muted">
                {photoCache[photo.id] ? (
                  <img
                    src={photoCache[photo.id]}
                    alt={photo.caption ?? t("site_photo_alt")}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-muted-foreground/40">
                    <Camera className="w-8 h-8" />
                    <span className="text-[10px] font-medium uppercase tracking-wide">{categoryLabel(photo.category)}</span>
                  </div>
                )}
              </div>

              {/* Overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors" />

              {/* Category badge */}
              <div className={cn("absolute top-2 left-2 px-1.5 py-0.5 rounded text-[10px] font-semibold",
                CAT_COLORS[photo.category as Category] ?? "bg-gray-100 text-gray-600")}>
                {categoryLabel(photo.category)}
              </div>

              {/* Action buttons */}
              <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); setEditForm({ caption: photo.caption ?? "", category: (photo.category as Category) ?? "Progress" }); setEditPhoto(photo); }}
                  className="w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-primary transition-colors"
                  aria-label={t("edit")}
                  data-testid={`btn-edit-photo-${photo.id}`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteId(photo.id); }}
                  className="w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-red-500 transition-colors"
                  aria-label={t("delete")}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Date bar */}
              {photo.date_taken && (
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-white text-[11px]">{photo.date_taken}</p>
                  {photo.caption && <p className="text-white/80 text-[10px] truncate">{photo.caption}</p>}
                </div>
              )}
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

      {/* ── Upload Form Dialog ────────────────────────────────────────────── */}
      <Dialog open={showUploadForm} onOpenChange={(o) => { if (!o && !uploading) { setShowUploadForm(false); setPending([]); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              <Upload className="w-4 h-4 inline mr-2" />
              {pending.length > 1 ? `${t("upload_n_photos")} (${pending.length})` : t("upload_1_photo")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {/* Previews */}
            {pending.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {pending.map((p, i) => (
                  <img key={i} src={p.dataUrl} alt={p.originalName}
                    className="h-20 w-20 object-cover rounded-lg border border-border flex-shrink-0" />
                ))}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">{t("project_required")}</label>
              <select value={uploadForm.project_id} onChange={(e) => setUploadForm((f) => ({ ...f, project_id: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none">
                <option value="">{t("select_project")}</option>
                {projects.map((p: Record<string, unknown>) => (
                  <option key={String(p.id)} value={String(p.id)}>{String(p.name)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">{t("category")}</label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((cat) => (
                  <button key={cat} type="button" onClick={() => setUploadForm((f) => ({ ...f, category: cat }))}
                    className={cn("px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
                      uploadForm.category === cat ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted")}>
                    {categoryLabel(cat)}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{t("date")}</label>
                <input type="date" value={uploadForm.date_taken}
                  onChange={(e) => setUploadForm((f) => ({ ...f, date_taken: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{t("caption")}</label>
                <input type="text" value={uploadForm.caption} placeholder={t("caption_optional")}
                  onChange={(e) => setUploadForm((f) => ({ ...f, caption: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none" />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => { setShowUploadForm(false); setPending([]); }} disabled={uploading}>
                {t("cancel")}
              </Button>
              <Button className="flex-1" onClick={handleUpload} disabled={uploading || !uploadForm.project_id} data-testid="btn-confirm-upload">
                {uploading ? t("uploading") : `${t("upload" as any)} ${pending.length > 1 ? `${pending.length} ${t("photos_word")}` : t("photo")}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Lightbox ──────────────────────────────────────────────────────── */}
      {lightbox !== null && currentPhoto && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex flex-col"
          onClick={() => setLightbox(null)}
        >
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <div>
              <span className={cn("text-xs px-2 py-0.5 rounded font-medium",
                CAT_COLORS[currentPhoto.category as Category] ?? "bg-gray-100 text-gray-600")}>
                {categoryLabel(currentPhoto.category)}
              </span>
              {currentPhoto.caption && (
                <p className="text-white/80 text-sm mt-1">{currentPhoto.caption}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-white/50 text-sm">{lightbox.index + 1} / {photos.length}</span>
              <button onClick={() => setLightbox(null)} className="text-white/70 hover:text-white p-1">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Image */}
          <div className="flex-1 flex items-center justify-center relative px-12 min-h-0" onClick={(e) => e.stopPropagation()}>
            {loadingPhotoId === currentPhoto.id ? (
              <div className="w-12 h-12 rounded-full border-2 border-white/20 border-t-white animate-spin" />
            ) : currentDataUrl ? (
              <img
                src={currentDataUrl}
                alt={currentPhoto.caption ?? t("site_photo_alt")}
                className="max-w-full max-h-full object-contain rounded-lg select-none"
                draggable={false}
              />
            ) : (
              <div className="text-white/40 text-sm">{t("tap_load")}</div>
            )}
          </div>

          {/* Bottom: date + actions */}
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <span className="text-white/50 text-xs">{currentPhoto.date_taken ?? currentPhoto.created_at.substring(0, 10)}</span>
            <div className="flex items-center gap-4">
              <button
                onClick={() => { setEditForm({ caption: currentPhoto.caption ?? "", category: (currentPhoto.category as Category) ?? "Progress" }); setEditPhoto(currentPhoto); setLightbox(null); }}
                className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm"
              >
                <Pencil className="w-4 h-4" /> {t("edit")}
              </button>
              <button
                onClick={() => { setDeleteId(currentPhoto.id); setLightbox(null); }}
                className="flex items-center gap-1.5 text-red-400 hover:text-red-300 text-sm"
              >
                <Trash2 className="w-4 h-4" /> {t("delete")}
              </button>
            </div>
          </div>

          {/* Prev / Next arrows */}
          {photos.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); navigateLightbox(-1); }}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                aria-label="Previous"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); navigateLightbox(1); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                aria-label="Next"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Edit Photo Dialog ────────────────────────────────────────────── */}
      <Dialog open={editPhoto !== null} onOpenChange={(o) => { if (!o) setEditPhoto(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              <Pencil className="w-4 h-4 inline mr-2" />
              {t("edit_photo_title")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">{t("caption")}</label>
              <input
                type="text"
                value={editForm.caption}
                placeholder={t("caption_optional")}
                onChange={(e) => setEditForm((f) => ({ ...f, caption: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">{t("category")}</label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((cat) => (
                  <button key={cat} type="button" onClick={() => setEditForm((f) => ({ ...f, category: cat }))}
                    className={cn("px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
                      editForm.category === cat ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted")}>
                    {categoryLabel(cat)}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setEditPhoto(null)} disabled={editMutation.isPending}>
                {t("cancel")}
              </Button>
              <Button
                className="flex-1"
                onClick={() => editPhoto && editMutation.mutate({ id: editPhoto.id, caption: editForm.caption, category: editForm.category })}
                disabled={editMutation.isPending}
                data-testid="btn-confirm-edit-photo"
              >
                {editMutation.isPending ? t("saving") : t("save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ────────────────────────────────────── */}
      <Dialog open={deleteId !== null} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t("delete_photo_title")}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground mt-1">{t("delete_photo_warn")}</p>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteId(null)}>{t("cancel")}</Button>
            <Button
              className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => deleteId !== null && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
              data-testid="btn-confirm-delete"
            >
              {deleteMutation.isPending ? t("deleting") : t("delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
