import GuideChat from "@/components/GuideChat";
import { useLanguage } from "@/hooks/use-language";
import { Compass, BookOpen } from "lucide-react";
import { Link } from "wouter";

export default function Guide() {
  const { t } = useLanguage();
  return (
    <div className="px-4 pt-4 md:px-6 md:pt-6 max-w-3xl mx-auto h-full flex flex-col gap-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
          <Compass className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">{t("guide_title") || "ہدایت کار"}</h1>
          <p className="text-xs text-muted-foreground">{t("guide_subtitle") || "ایپ استعمال کرنے کا مکمل اردو گائیڈ — کوئی بھی سوال پوچھیں، جواب میں لنک اور اقدامات ملیں گے"}</p>
        </div>
        <Link
          to="/kb-editor"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors"
        >
          <BookOpen className="w-4 h-4" />
          {t("edit_lessons") || "سبق بدلیں"}
        </Link>
      </div>
      <div className="flex-1 min-h-0"><GuideChat variant="page" /></div>
    </div>
  );
}