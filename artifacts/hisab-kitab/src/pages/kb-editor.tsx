import { useState } from "react";
import { useLanguage } from "@/hooks/use-language";
import {
  GUIDE_KB,
  getKbOverrides,
  saveKbOverride,
  resetKbOverride,
  type GuideKbSection,
} from "@/lib/guide";
import { BookOpen, Save, RotateCcw, Check } from "lucide-react";

export default function KbEditor() {
  const { t, lang } = useLanguage();
  const [selectedPage, setSelectedPage] = useState<string>("");
  const [editing, setEditing] = useState("");

  const effective: GuideKbSection[] = GUIDE_KB.map((s) => ({ ...s, ...(getKbOverrides()[s.page] ?? {}) }));
  const active = effective.find((s) => s.page === selectedPage) ?? effective[0];

  const save = (page: string, patch: Partial<GuideKbSection>) => {
    const current = getKbOverrides()[page] ?? {};
    saveKbOverride(page, { ...current, ...patch });
    setEditing("");
  };

  const reset = (page: string) => {
    resetKbOverride(page);
    setEditing("");
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto" dir={lang === "ur" ? "rtl" : "ltr"}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center">
          <BookOpen className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">{t("kb_editor_title") || "سبق ایڈیٹر"}</h1>
          <p className="text-xs text-muted-foreground">{t("kb_editor_subtitle") || "گائیڈ کے اسباق یہاں سے اپنے طریقے سے بدلیں — تبدیلی اس ڈیوائس پر محفوظ ہوتی ہے"}</p>
        </div>
      </div>

      {active && (
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <div className="flex flex-col gap-1 max-h-[70vh] overflow-y-auto">
            {effective.map((s) => {
              const overridden = !!getKbOverrides()[s.page];
              return (
                <button
                  key={s.page}
                  onClick={() => setSelectedPage(s.page)}
                  className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    s.page === active.page
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-foreground"
                  }`}
                >
                  <div className="font-medium">{s.titleUr}</div>
                  <div className={`text-[11px] ${s.page === active.page ? "text-primary-foreground/70" : "text-muted-foreground"}`} dir="ltr">
                    {s.page}{overridden ? " •" + (t("kb_edited") || "بدلا") : ""}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-4">
            {editing === active.page ? (
              <SectionForm
                section={active}
                onSave={(patch) => save(active.page, patch)}
                onCancel={() => setEditing("")}
                lang={lang}
              />
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-foreground">{active.titleUr}</h2>
                    <div className="text-xs text-muted-foreground" dir="ltr">{active.page}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditing(active.page)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90"
                    >
                      <Save className="w-3.5 h-3.5" /> {t("kb_edit") || "ترمیم کریں"}
                    </button>
                    {getKbOverrides()[active.page] && (
                      <button
                        onClick={() => reset(active.page)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> {t("kb_reset") || "ری سیٹ"}
                      </button>
                    )}
                  </div>
                </div>
                <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{active.content}</div>
                <div className="border-t border-border pt-3">
                  <div className="text-xs font-medium text-muted-foreground mb-1">{t("kb_keywords") || "کلیدی الفاظ"}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {active.keywords.map((k) => (
                      <span key={k} className="px-2 py-0.5 rounded-full bg-muted text-xs text-foreground">{k}</span>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionForm({
  section,
  onSave,
  onCancel,
  lang,
}: {
  section: GuideKbSection;
  onSave: (patch: Partial<GuideKbSection>) => void;
  onCancel: () => void;
  lang: string;
}) {
  const { t } = useLanguage();
  const [titleUr, setTitleUr] = useState(section.titleUr);
  const [content, setContent] = useState(section.content);
  const [keywords, setKeywords] = useState(section.keywords.join(", "));

  return (
    <div className="flex flex-col gap-3" dir={lang === "ur" ? "rtl" : "ltr"}>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">{t("kb_title") || "عنوان (اردو)"}</span>
        <input
          value={titleUr}
          onChange={(e) => setTitleUr(e.target.value)}
          className="px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">{t("kb_keywords") || "کلیدی الفاظ (کاما سے الگ کریں)"}</span>
        <input
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          className="px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">{t("kb_content") || "سبق کا متن"}</span>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={10}
          className="px-3 py-2 rounded-lg border border-input bg-background text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </label>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted">
          {t("cancel")}
        </button>
        <button
          onClick={() => onSave({ titleUr, content, keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean) })}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
        >
          <Check className="w-4 h-4" /> {t("kb_save") || "محفوظ کریں"}
        </button>
      </div>
    </div>
  );
}