import { useEffect, useState } from "react";
import { i18n, Language } from "@/lib/i18n";

let listeners: Array<() => void> = [];
// Allow ?lang=ur in URL to force language (useful for testing/screenshots)
const urlLang = new URLSearchParams(window.location.search).get("lang") as Language | null;
if (urlLang && (urlLang === "ur" || urlLang === "en")) {
  localStorage.setItem("hk_lang", urlLang);
}
let lang: Language = (localStorage.getItem("hk_lang") as Language) || "en";

export function setLanguage(l: Language) {
  lang = l;
  localStorage.setItem("hk_lang", l);
  listeners.forEach((fn) => fn());
}

export function useLanguage() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const update = () => forceUpdate((n) => n + 1);
    listeners.push(update);
    return () => {
      listeners = listeners.filter((l) => l !== update);
    };
  }, []);

  const t = (key: keyof typeof i18n.en): string => {
    return (i18n[lang] as Record<string, string>)[key] ?? i18n.en[key] ?? key;
  };

  return { lang, t, setLanguage };
}
