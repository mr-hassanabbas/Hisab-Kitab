import { fetchApi } from "@/lib/api";

type ActionBase = { response?: string; assumed?: string; date?: string; confidence?: "high" | "medium" | "low" };

export type MareniiAction =
  | (ActionBase & { type: "navigate"; page?: string })
  | (ActionBase & { type: "create_project"; name?: string; ownerName?: string; location?: string; amount?: string })
  | (ActionBase & { type: "create_labour"; labourName?: string; wage?: string })
  | (ActionBase & { type: "assign_labour"; labourName?: string; projectName?: string; wage?: string })
  | (ActionBase & { type: "create_mason"; masonName?: string; wage?: string })
  | (ActionBase & { type: "assign_mason"; masonName?: string; projectName?: string; wage?: string })
  | (ActionBase & { type: "add_material"; projectName?: string; material?: string; quantity?: string; unit?: string; rate?: string; supplier?: string })
  | (ActionBase & { type: "add_expense"; projectName?: string; category?: string; description?: string; amount?: string; paidTo?: string })
  | (ActionBase & { type: "add_equipment"; projectName?: string; equipment?: string; dailyRate?: string; operator?: string })
  | (ActionBase & { type: "mark_attendance"; projectName?: string; labourName?: string; status?: string; overtimeHours?: string })
  | (ActionBase & { type: "mark_all_attendance"; projectName?: string; status?: string })
  | (ActionBase & { type: "add_diary"; projectName?: string; summary?: string; weather?: string })
  | (ActionBase & { type: "add_payment"; projectName?: string; amount?: string; method?: string })
  | (ActionBase & { type: "add_weekly_payment"; projectName?: string })
  | (ActionBase & { type: "fetch_report"; projectName?: string })
  | (ActionBase & { type: "respond" })
  | (ActionBase & { type: "clarify"; question?: string; candidates?: string[] })
  | (ActionBase & { type: "greet" })
  | (ActionBase & { type: "answer"; questionType?: "name" | "how_are_you" | "what" })
  | (ActionBase & { type: "explain_app" })
  | (ActionBase & { type: "smalltalk"; kind: "thanks" | "goodbye" });

// confidence + assumption tagging (applied by local parser and Gemini alike)
export type ActionConfidence = "high" | "medium" | "low";

// Where a value could not be resolved (which project? which worker?), the
// caller halts and asks. `pending` holds the actions from the blocked one
// onward so the flow can resume after the user answers.
export interface ClarifyRequest {
  entityType: "project" | "labour" | "date";
  field: "projectName" | "labourName" | "masonName" | "date";
  question: string;
  candidates: string[];
  actions: MareniiAction[];
  state: ExecuteState;
}

export interface ExecuteState {
  lastProjectId: number | null;
  lastLabourId: number | null;
  lastMasonId: number | null;
  lastProjectName?: string;
  lastLabourName?: string;
  lastMasonName?: string;
}

export const ACTION_LABEL: Record<string, string> = {
  navigate: "صفحہ کھولنا",
  create_project: "نیا پروجیکٹ بنانا",
  create_labour: "نیا مزدور شامل کرنا",
  assign_labour: "مزدور کو پراجیکٹ میں شامل کرنا",
  create_mason: "نیا مستری شامل کرنا",
  assign_mason: "مستری کو پراجیکٹ میں شامل کرنا",
  add_material: "سامان کا اندراج",
  add_expense: "اخراجات کا اندراج",
  add_equipment: "آلات کا اندراج",
  mark_attendance: "حاضری لگانا",
  add_diary: "ڈائری میں اندراج",
  add_payment: "مالک ادائیگی کا اندراج",
  add_weekly_payment: "ہفتہ وار ادائیگی بنانا",
  fetch_report: "رپورٹ کھولنا",
  mark_all_attendance: "سب کی حاضری لگانا",
  respond: "جواب دینا",
  greet: "استقبال",
  answer: "سوال کا جواب",
  explain_app: "ایپ کی وضاحت",
  smalltalk: "چھوٹا بات",
};

export const hasMutations = (actions: MareniiAction[]) =>
  actions.some((a) => a.type !== "navigate" && a.type !== "respond" && a.type !== "clarify" && a.type !== "greet" && a.type !== "answer" && a.type !== "explain_app" && a.type !== "smalltalk");

// Local keyword detector — decides whether a message looks like a COMMAND
// (EN / UR / Roman-UR) so we skip the expensive Gemini action-parse call for
// ordinary conversational messages. Saves quota (each Gemini call is billed).
const COMMAND_KEYWORDS = [
  // verbs — english
  "add", "create", "open", "mark", "record", "assign", "generate", "show", "make", "new",
  // verbs — urdu
  "بناو", "بناؤ", "شامل", "لگاؤ", "کھولو", "دکھاؤ", "درج", "لکھو", "ادا",
  // verbs — roman urdu
  "kroo", "karo", "banao", "lagao", "kholo", "dikhao", "likho", "dalo", "daalo", "add kro", "bhejo", "de do", "kar do",
  // nouns/pages — english
  "project", "attendance", "hazri", "expense", "expenses", "kharch", "payment", "payments", "material", "materials",
  "equipment", "labour", "mazdoor", "worker", "diary", "photo", "photos", "report", "reports", "settings", "weekly",
  "overtime", "ot",
  // nouns/pages — urdu
  "پروجیکٹ", "حاضری", "خرچہ", "اخراجات", "ادائیگی", "سامان", "مٹیریل", "آلات", "مزدور", "ڈائری", "تصاویر", "رپورٹ",
  "تنخواہ", "حساب", "کام", "اوزار", "اوورٹائم", "اوور ٹائم",
  // nouns/pages — roman urdu
  "project", "samaan", "mal", "aylaat", "tankhwa", "hisaab", "kaam", "overtime",
];

export function looksLikeCommand(text: string): boolean {
  const lower = text.toLowerCase();
  return COMMAND_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

const NAV_PAGES: [RegExp, string][] = [
  [/attendance|hazri|hazari|حاضری/i, "/attendance"],
  [/projekt|project|پروجیکٹ|پراجیکٹ|kaam|کام/i, "/projects"],
    [/mason.?attendance|مستری کی حاضری/i, "/mason-attendance"],
  [/mason.?payment|مستری تنخواہ/i, "/mason-payments"],
  [/mason|mistrii|مستری/i, "/mason"],
  [/labour|mazdoor|مزدور|worker/i, "/labour"],
  [/material|samaan|سامان|مٹیریل/i, "/materials"],
  [/expense|kharcha|kharch|خرچہ|اخراجات/i, "/expenses"],
  [/equipment|aylaat|آلات/i, "/equipment"],
  [/weekly|hafta|ہفتہ|تنخواہ/i, "/weekly-payment"],
  [/payment|tankhwa|تنخواہ|ادائیگی/i, "/payments"],
  [/diary|ڈائری/i, "/diary"],
  [/photo|tasveer|تصاویر/i, "/photos"],
  [/report|hisaab|حساب|رپورٹ/i, "/reports"],
  [/setting|ترتیبات/i, "/settings"],
  [/dashboard|home|ghar|ڈیش/i, "/"],
];

const NAME_FILLER = /^(add|create|banao|banwao|banano|kroo|karo|kar|karna|kar do|bana|rakhoo|rakho|rakh|rakhna|بناؤ|بناو|بنائیں|کرو|کرنے|رکھو|رکھ|a|an|the|new|naya|aik|ek|ایک|نیا|one|called|named|naam|نام|ka|ki|ke|کا|کی|کے|ma|me|men|mein|میں|ہے|aur|and|us|is|with|at|in|of|on|ka naam|کا نام)$/i;

// ─── Cross-language name folding ──────────────────────────────────────
// A labour/project name can be spoken/written in Urdu (علی), Latin (Ali),
// or Roman-Urdu (aali, aalee, ale). Fold romanized variants to a canonical
// Latin key so "aalee" matches "Ali" via the existing fuzzy matcher.
// Canonical romanization aliases. Checked BEFORE generic folding so that
// "aalee"/"aali"/"alee" map to "ali" rather than getting collapsed to "ale".
// Covers the common Latin-script spelling variants of Urdu names.
const NAME_ALIASES: Record<string, string> = {
  aalee: "ali", aali: "ali", alee: "ali",
  othman: "usman", osman: "usman",
  humza: "hamza", hamaiz: "hamza", hammaz: "hamza",
  yousuf: "yusuf", youssef: "yusuf",
  jiya: "jiya",
};
const NAME_FOLD: Array<[RegExp, string]> = [
  [/([aeiou])\1+/g, "$1"],   // collapse doubled vowels: zeeshan unaffected
  [/[’'`]/g, ""],
  [/[\u064B-\u065F]/g, ""], // strip Arabic diacritics
];
const URDU_TO_LATIN: Array<[RegExp, string]> = [
  [/ا/, "a"], [/آ/, "a"], [/ب/, "b"], [/پ/, "p"], [/ت/, "t"], [/ٹ/, "t"],
  [/ث/, "s"], [/ج/, "j"], [/چ/, "ch"], [/ح/, "h"], [/خ/, "kh"], [/د/, "d"],
  [/ڈ/, "d"], [/ذ/, "z"], [/ر/, "r"], [/ڑ/, "r"], [/ز/, "z"], [/ژ/, "zh"],
  [/س/, "s"], [/ش/, "sh"], [/ص/, "s"], [/ض/, "z"], [/ط/, "t"], [/ظ/, "z"],
  [/ع/, "a"], [/غ/, "gh"], [/ف/, "f"], [/ق/, "q"], [/ک/, "k"], [/گ/, "g"],
  [/ل/, "l"], [/م/, "m"], [/ن/, "n"], [/ں/, "n"], [/و/, "w"], [/ہ/, "h"],
  [/ھ/, "h"], [/ء/, ""], [/ی/, "y"], [/ے/, "e"], [/ي/, "y"],
];

/** Canonicalize a romanized name variant. Exported for tests. */
export function foldName(name: string): string {
  const lower = name.toLowerCase().trim();
  if (NAME_ALIASES[lower]) return NAME_ALIASES[lower];
  let n = lower;
  for (const [re, rep] of NAME_FOLD) n = n.replace(re, rep);
  return n;
}

/** Consonant skeleton (vowels removed) — the identity core of Semitic names.
 *  Urdu/Arabic short vowels are unwritten, so "aslm" (from اسلم) and
 *  "aslam" share the same skeleton "slm". Used as a bonus signal. */
const VOWELS = /[aeiou]/g;
function consonantSkeleton(s: string): string {
  return s.replace(VOWELS, "");
}

/** Best-effort Urdu-Arabic → Latin for cross-script name matching (lossy).
 *  Word-final ی is mapped to "i" (e.g. علی → ali); mid-word ی → "y".
 *  Short vowels are not written in Urdu script, so they cannot be recovered
 *  here — this is a heuristic bonus signal, not a precise transliteration. */
export function romanizeUrdu(word: string): string {
  const chars = Array.from(word);
  let out = "";
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const isLast = i === chars.length - 1;
    let mapped = ch;
    if (ch === "ی" && isLast) { mapped = "i"; }
    else {
      for (const [re, rep] of URDU_TO_LATIN) {
        if (re.test(ch)) { mapped = rep; break; }
      }
    }
    out += mapped;
  }
  return out;
}

const stripQuotes = (s: string): string => s.replace(/["“”'‘’`]+/g, "").trim();

// ─── Roman-Urdu spelling normalization ────────────────────────────────
// Maps common misspellings / relaxed spellings to a canonical form the
// regex rules already understand. Kept deliberately small & conservative:
// only map a variant to a word that ALREADY exists in the parser rules, and
// only when the replacement cannot corrupt an entity name. Grow this list
// from real failed messages over time.
const SYNONYM_MAP: Array<[RegExp, string]> = [
  [/\bbana do\b/gi, "banao"],
  [/\bbanado\b/gi, "banao"],
  [/\bbanaao\b/gi, "banao"],
  [/\bbanwao\b/gi, "banao"],
  [/\bbanano\b/gi, "banao"],
  [/\blaga do\b/gi, "lagao"],
  [/\blagado\b/gi, "lagao"],
  [/\blagana\b/gi, "lagao"],
  [/\bmazdur\b/gi, "mazdoor"],
  [/\bmajdoor\b/gi, "mazdoor"],
  [/\bmzadoor\b/gi, "mazdoor"],
  [/\bhaazri\b/gi, "hazri"],
  [/\bhazir\b/gi, "present"],
  [/\bghayab\b/gi, "absent"],
  [/\bkharchay\b/gi, "kharcha"],
];

/** Lowercases + collapses whitespace, then maps known spelling variants. */
export function normalizeText(text: string): string {
  let t = text.toLowerCase().replace(/\s+/g, " ").trim();
  for (const [re, repl] of SYNONYM_MAP) t = t.replace(re, repl);
  return numberWordsToDigits(t);
}

// ─── Urdu / Roman-Urdu number words → digits ──────────────────────────
// Conservative: a number-word sequence is only converted when it sits next
// to an amount/quantity marker (kharcha, wage, rate, bags, …) so entity
// names like "Ek Mehboob" or "Do Hazar Road" are never corrupted.
const NUM_WORD_TOKENS = [
  "ek", "aik", "one", "do", "two", "teen", "three", "char", "chaar", "four",
  "panch", "five", "che", "cheh", "six", "saat", "sath", "seven", "aath",
  "atth", "eight", "nao", "nau", "nine", "das", "ten", "pandra", "pandrah",
  "fifteen", "bees", "twenty", "tees", "thirty", "chaalis", "chalees",
  "forty", "pachas", "fifty", "sau", "sao", "hundred", "hazar", "hazaar",
  "thousand", "lakh", "crore",
];

const NUMBER_VALUE: Record<string, number> = {
  ek: 1, aik: 1, one: 1, do: 2, two: 2, teen: 3, three: 3, char: 4, chaar: 4,
  four: 4, panch: 5, five: 5, che: 6, cheh: 6, six: 6, saat: 7, sath: 7,
  seven: 7, aath: 8, atth: 8, eight: 8, nao: 9, nau: 9, nine: 9, das: 10,
  ten: 10, pandra: 15, pandrah: 15, fifteen: 15, bees: 20, twenty: 20,
  tees: 30, thirty: 30, chaalis: 40, chalees: 40, forty: 40, pachas: 50,
  fifty: 50, sau: 100, sao: 100, hundred: 100, hazar: 1000, hazaar: 1000,
  thousand: 1000, lakh: 100000, crore: 10000000,
};

const AMOUNT_MARKER = /(?:kharcha|kharch|expense|خرچہ|خرچا|wage|ujrat|اجرت|advance|ایڈوانس|peshgi|پیشگی|rate|bhaav|بھاؤ|بھاو|amount|raqam|رقم|rupees|rupay|rupaya|روپے|rs|bags|tons|kg|بورے|بوری|truck|trucks)\b/i;

/** Parses a run of number-word tokens (e.g. "pandrah sau" = 1500, "do hazar do sau" = 2200). */
export function numWordsToNumber(words: string[]): number | null {
  let total = 0;
  let current = 0;
  for (const w of words) {
    const v = NUMBER_VALUE[w];
    if (v === undefined) return null;
    if (v >= 100) {
      total += (current || 1) * v;
      current = 0;
    } else {
      current += v;
    }
  }
  return total + current || null;
}

/** Converts number-word sequences to digits, only when adjacent to an amount marker. */
export function numberWordsToDigits(text: string): string {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let i = 0;
  while (i < words.length) {
    if (NUMBER_VALUE[words[i]] !== undefined) {
      let j = i;
      const run: string[] = [];
      while (j < words.length && NUMBER_VALUE[words[j]] !== undefined) {
        run.push(words[j]);
        j++;
      }
      const prev = i > 0 ? words[i - 1] : "";
      const next = j < words.length ? words[j] : "";
      const nextNext = j + 1 < words.length ? words[j + 1] : "";
      if (AMOUNT_MARKER.test(prev) || AMOUNT_MARKER.test(next) || AMOUNT_MARKER.test(nextNext)) {
        const value = numWordsToNumber(run);
        if (value !== null) {
          out.push(String(value));
          i = j;
          continue;
        }
      }
      out.push(words[i]);
      i++;
    } else {
      out.push(words[i]);
      i++;
    }
  }
  return out.join(" ");
}

// ─── Relative dates ("aaj", "kal", "parso", "pichla juma", …) ─────────
const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const addDays = (base: Date, days: number): Date => {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
};

export const lastWeekday = (target: number): string => {
  const d = new Date();
  let diff = (d.getDay() - target + 7) % 7;
  if (diff === 0) diff = 7;
  return fmtDate(addDays(d, -diff));
};

/**
 * Extracts the relative-date term from an utterance. Returns the canonical
 * keyword (e.g. "kal", "aaj") plus assumption/confidence metadata, or null
 * if no known date term is present. The returned `date` is the *term* the
 * user spoke — the concrete YYYY-MM-DD is resolved later in code from the
 * real current date (see resolveDateTerm), so the model never emits a
 * guessed absolute date.
 */
export function resolveDate(raw: string): { date: string; assumed?: string; confidence?: "high" | "medium" | "low" } | null {
  const r = raw.toLowerCase();
  if (/\bpichla\s+juma\b|\bpichla\s+jumma\b|گزشتہ\s+جمعہ|گزرا\s+جمعہ/.test(r))
    return { date: "pichla juma", assumed: "پچھلے جمعہ کی" };
  if (/\bagla\s+hafta\b|اگلے\s+ہفتے|agley\s+hafta/.test(r))
    return { date: "agla hafta", assumed: "اگلے ہفتے کی" };
  if (/\bparso\b|پرسوں/.test(r))
    return { date: "parso", assumed: "پرسوں کی" };
  if (/\baaj\b|آج\b|today/.test(r)) return { date: "aaj", assumed: "آج کی" };
  if (/\bkal\b|کل\b|yesterday|tomorrow/.test(r))
    return { date: "kal", assumed: "کل (پچھلے دن) کی", confidence: "medium" };
  if (/\bnarso\b|نرسو\b/.test(r))
    return { date: "narso", assumed: "نرسو (اگلے دن) کی" };
  return null;
}

/**
 * Resolves a canonical relative-date term (e.g. "kal", "aaj") into a concrete
 * YYYY-MM-DD computed from the real current date. Returns null for any term
 * that does not match a known pattern — the caller should ask for
 * clarification instead of guessing.
 */
export function resolveDateTerm(term: string): string | null {
  const r = term.toLowerCase().trim();
  const now = new Date();
  const fmt = (d: Date) => fmtDate(d);
  switch (r) {
    case "aaj":
    case "today":
    case "آج":
      return fmt(now);
    case "kal":
    case "yesterday":
    case "کل": {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      return fmt(d);
    }
    case "parso":
    case "پرسوں": {
      const d = new Date(now);
      d.setDate(d.getDate() - 2);
      return fmt(d);
    }
    case "narso":
    case "نرسو": {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      return fmt(d);
    }
    case "pichla juma":
    case "pichla jumma":
    case "گزشتہ جمعہ":
    case "گزرا جمعہ":
      return lastWeekday(5);
    case "agla hafta":
    case "اگلے ہفتے":
    case "agley hafta":
      return fmtDate(addDays(new Date(), 7));
    default:
      return null;
  }
}

const extractName = (tail: string): string | undefined => {
  const tokens = stripQuotes(tail).split(/\s+/).filter((tok) => tok && !NAME_FILLER.test(tok));
  return tokens.join(" ") || undefined;
};

export function extractOvertimeHours(text: string): string | undefined {
  const normalized = text.toLowerCase();
  const re1 = /(\d+(?:\.\d+)?)\s*(?:ghante|ghanta|ghantey|hours|hour|گھنٹے|گھنٹہ|گھنٹوں)\s*(?:overtime|ot|اوورٹائم|اوور ٹائم)/i;
  const m1 = normalized.match(re1);
  if (m1) return m1[1];

  const re2 = /(?:overtime|ot|اوورٹائم|اوور ٹائم)\s*(?:of|ka|ki|ke|کا|کی|کے)?\s*(\d+(?:\.\d+)?)\s*(?:ghante|ghanta|ghantey|hours|hour|گھنٹے|گھنٹہ|گھنٹوں)/i;
  const m2 = normalized.match(re2);
  if (m2) return m2[1];
  
  const re3 = /(\d+(?:\.\d+)?)\s*(?:overtime|ot|اوورٹائم|اوور ٹائم)/i;
  const m3 = normalized.match(re3);
  if (m3) return m3[1];
  
  return undefined;
};

const extractMultiWord = (tail: string, stop: RegExp): string | undefined => {
  const cleaned = stripQuotes(tail);
  const idx = cleaned.search(stop);
  const namePart = idx >= 0 ? cleaned.slice(0, idx) : cleaned;
  const tokens = namePart.split(/\s+/).filter((tok) => tok && !NAME_FILLER.test(tok));
  return tokens.join(" ") || undefined;
};

// ─── Conversation detection (offline, no Gemini needed) ───────────────────

const CONV_GREETING = /assalamualaikum|assalamu alaikum|assalam o alaikum|سلام علیکم|\b(?:hello|hi|hey|salam|assalam|ہیلو|ہائے|خوش آمدید|subah bakhair|good morning|shaam bakhair|good evening|kaisa)\b|سلام|السلام|good/i;
const CONV_NAME = /\btumhara naam kya hai\b|\btumhari kya hai\b|\bwhat is your name\b|\bwho are you\b|\baap kaun ho\b|\bapna parichay do\b|تمہارا نام کیا ہے|میرا نام کیا ہے|آپ کون ہو|تم کون ہو|تمہارا نام کیا/i;
const CONV_HOW_ARE_YOU = /\bkya haal hai\b|\bkaisa hoon\b|\bhow are you\b|\btheek ho\b|\bkaise ho\b|کیا حال ہے|کیسے ہو/i;
const CONV_THANKS = /\b(?:shukriya|thank you|thanks|meherbani|jazakallah|dhanyavaad|بہت شکریہ)\b|شکریہ/i;
const CONV_GOODBYE = /\b(?:khuda hafiz|bye|goodbye|Allah hafiz|phir milenge|see you)\b|خدا حافظ|اللہ حافظ|فی صبح/i;
const CONV_APP_EXPLAIN = /\bye app kya hai\b|\bwhat is this app\b|\bhisab kitab kya hai\b|\bapp ka kaam kya hai\b|\bmujhe samjhao\b|\bexplain karo\b|\bapp kya karta hai\b|یہ ایپ کیا ہے|hisab kitab kya/i;
const CONV_HELP = /\bmadar karo\b|\bhelp me\b|\bhelp chahiye\b|\bkya kar sakti ho\b|\bwhat can you do\b|کیا کر سکتی ہو|مدد کرو|\bmadad\b|مدد|madad/i;

export function detectConversation(text: string): MareniiAction | null {
  const t = text.toLowerCase().trim();
  if (CONV_GREETING.test(t)) return { type: "greet", response: "وعلیکم السلام! میں Marenii ہوں — آپ کی کیا مدد کروں؟", confidence: "high" };
  if (CONV_NAME.test(t)) return { type: "answer", questionType: "name", response: "میرا نام Marenii ہے۔ میں Hisab Kitab کی آواز ہوں — آپ کے تعمیراتی کام میں مدد کے لیے ہمیشہ حاضر ہوں۔", confidence: "high" };
  if (CONV_HOW_ARE_YOU.test(t)) return { type: "answer", response: "الحمدللہ بالکل ٹھیک ہوں! آپ کے لیے کیا کر سکتی ہوں؟", confidence: "high" };
  if (CONV_THANKS.test(t)) return { type: "smalltalk", kind: "thanks", response: "بہت شکریہ! کوئی اور کام ہو تو بتائیں۔", confidence: "high" };
  if (CONV_GOODBYE.test(t)) return { type: "smalltalk", kind: "goodbye", response: "اللہ حافظ! کام اچھا گزرے — پھر ملیں گے۔", confidence: "high" };
  if (CONV_APP_EXPLAIN.test(t)) return { type: "explain_app", response: "Hisab Kitab آپ کے تعمیراتی کاروبار کا مکمل نظام ہے۔ اس میں آپ مزدوروں کی حاضری لگا سکتے ہیں، تنخواہ حساب کر سکتے ہیں، اخراجات نوٹ کر سکتے ہیں، اور رپورٹ بنا سکتے ہیں۔ بتائیں کیا کرنا ہے؟", confidence: "high" };
  if (CONV_HELP.test(t)) return { type: "explain_app", response: "میں Marenii آپ کی یہ کام کر سکتی ہوں: حاضری لگانا، تنخواہ حساب کرنا، رپورٹ دیکھنا، نیا پروجیکٹ بنانا، مزدور شامل کرنا، خرچے لکھنا۔ بس بول دیں!", confidence: "high" };
  return null;
}

/**
 * Zero-API rule-based command parser (EN / UR / Roman-UR).
 * Returns actions for common commands WITHOUT calling Gemini — so the
 * AI assistant keeps working even when the Gemini free-tier quota is hit.
 * Returns null if it can't confidently parse the message (caller falls
 * back to the Gemini action parser).
 */
const parseOneClause = (clause: string): MareniiAction | null => {
  const t = clause.trim();
  if (!t) return null;

  // ── Conversation detection (offline, no Gemini needed) ──
  const conv = detectConversation(t);
  if (conv) return conv;

  // ── navigate ──
  const navRe = /(?:open|show|kholo|khol|kholna|dikhao|dikha|دیکھو|کھولو|دکھاؤ|کھول|chahiye|چاہئے)\s+(?:the\s+)?([\w\u0600-\u06FF]+)|([\w\u0600-\u06FF]+)\s+(?:kholo|khol|dikhao|دیکھو|کھولو|دکھاؤ|کھول|chahiye|چاہئے)\s*$/i;
  const nm = t.match(navRe);
  if (nm && !/(add|create|banao|kroo|karo|بناؤ|بناو)/i.test(t)) {
    const word = (nm[1] ?? nm[2]).toLowerCase();
    for (const [re, path] of NAV_PAGES) {
      if (re.test(word)) {
        return { type: "navigate", page: path, response: "صفحہ کھل رہا ہے" };
      }
    }
  }

  // Bare page keyword navigation — "attendance", "reports", "weekly"…
  // Also handles "attendance lagao" / "حاضری لگاؤ" / "report chahiye" / "رپورٹ چاہئے"
  const navWords = t.split(/\s+/).filter(Boolean);
  const bareNavRe = /^(?:open|show|kholo|dikhao|کھولو|دکھاؤ|chahiye|چاہئے|lagao|لگاؤ|lagana|لگانا|mark|record)$/i;
  const firstWord = navWords[0] || "";
  const lastWord = navWords[navWords.length - 1] || "";
  const pageWord = bareNavRe.test(firstWord) ? lastWord : bareNavRe.test(lastWord) ? firstWord : null;
  if (pageWord) {
    for (const [re, path] of NAV_PAGES) {
      if (re.test(pageWord)) {
        return { type: "navigate", page: path, response: "صفحہ کھل رہا ہے" };
      }
    }
  }

  // Single-word bare page keyword
  if (navWords.length === 1) {
    for (const [re, path] of NAV_PAGES) {
      if (re.test(navWords[0])) {
        return { type: "navigate", page: path, response: "صفحہ کھل رہا ہے" };
      }
    }
  }

  // ── create_project ──
  const projectLike = /(?:project|پروجیکٹ|پراجیکٹ)/i;
  const isProjectClause =
    projectLike.test(t) &&
    !/(?:labour|mazdoor|مزدور|worker|assign|shamil|شامل|wala|والا|ko|کو)/i.test(t);
  if (isProjectClause) {
    let name: string | undefined;
    let ownerName: string | undefined;
    let location: string | undefined;
    const locM = t.match(/(?:location|jagah|جگہ|sheher|city|\bat\b|\bin\b|mein|میں)\s*(?:ko)?\s*["“”'‘’]?([\w\u0600-\u06FF][\w\u0600-\u06FF\s\-]*?)["“”'‘’]?\s*(?:rakhoo|rakho|rakh|aur|اور|and|,|$)/i) ??
      t.match(/(?:Lahore|Karachi|Islamabad|Multan|Faisalabad|Rawalpindi|Peshawar|Quetta|Sialkot|Gujranwala|Hyderabad|Bahawalpur|Sheikhupura)/i);
    if (locM) {
      const locVal = (locM[1] ?? locM[0])?.trim();
      if (locVal && !/^(e|new|project)$/i.test(locVal)) location = locVal;
    }
    const ownM = t.match(/(?:owner|maalik|مالک)\s*(?:name|naam|نام)?\s*["“”'‘’]?([\w\u0600-\u06FF][\w\u0600-\u06FF\s\-]*?)["“”'‘’]?\s*(?:rakhoo|rakho|rakh|aur|اور|and|location|jagah|جگہ|\bat\b|\bin\b|mein|میں|,|$)/i);
    if (ownM) ownerName = ownM[1]?.trim();
    const projQuoted = t.match(/(?:project|پروجیکٹ|پراجیکٹ)[^"“”'‘’]{0,40}["“”'‘’]([^"“”'‘’]{2,})["“”'‘’]/i);
    if (projQuoted) name = projQuoted[1].trim();
    if (!name) {
      const naamM = t.match(/(?:us|is)?\s*ka\s*(?:naam|name|نام)\s*["“”'‘’]?([\w\u0600-\u06FF][\w\u0600-\u06FF\s\-]*?)["“”'‘’]?\s*(?:owner|maalik|مالک|location|jagah|جگہ|rakhoo|rakho|rakh|aur|اور|and|,|$)/i);
      if (naamM) name = naamM[1].trim();
    }
    if (!name) {
      const afterProj = t.match(/(?:project|پروجیکٹ|پراجیکٹ)\s+(?:add|banao|banwao|kroo|karo|بناؤ|بناو|کرو|called|named)\s+(?:a\s+|naya\s+|aik\s+|ek\s+)?(?:new\s+)?(?:called\s+|named\s+)?([\w\u0600-\u06FF][\w\u0600-\u06FF\s\-]*)/i) ??
        t.match(/(?:add|create|banao|banwao|kroo|karo|بناؤ|بناو|کرو)\s+(?:a\s+|new\s+|naya\s+|aik\s+|ek\s+|ایک\s+|نیا\s+)?(?:new\s+)?(?:project|پروجیکٹ|پراجیکٹ)\s+(?:called\s+|named\s+)?([\w\u0600-\u06FF][\w\u0600-\u06FF\s\-]*)/i);
      if (afterProj) name = extractName(afterProj[1]);
    }
    if (name) {
      name = name.replace(/\s*(?:owner|maalik|مالک|location|jagah|جگہ)\s*.*$/i, "").trim();
      name = extractName(name) ?? name.split(/\s+/)[0];
      if (name && !/^(name|ma|me|men|aik|ek|one|project)$/i.test(name)) {
        return { type: "create_project", name, ownerName, location, response: `پروجیکٹ ${name} بنایا جائے گا` };
      }
    }
  }

  // ── create_labour ──
  const labourLike = /(?:labour|mazdoor|مزدور|worker)/i;
  if (labourLike.test(t) && !/project|پروجیکٹ|پراجیکٹ/i.test(t)) {
    let labourName: string | undefined;
    let wage: string | undefined;
    const wageM = t.match(/(?:wage|ujrat|اجرت|daily\s+wage)\s*["“”'‘’]?(\d[\d,]*\.?\d*)/i);
    if (wageM) wage = wageM[1];
    const labQuoted = t.match(/(?:labour|mazdoor|مزدور|worker)[^"“”'‘’]{0,40}["“”'‘’]([^"“”'‘’]{2,})["“”'‘’]/i);
    if (labQuoted) labourName = labQuoted[1].trim();
    if (!labourName) {
      const naamM = t.match(/(?:us|is)?\s*ka\s*(?:naam|name|نام)\s*["“”'‘’]?([\w\u0600-\u06FF][\w\u0600-\u06FF\s\-]*?)["“”'‘’]?\s*(?:daily|wage|ujrat|اجرت|aur|اور|and|,|$)/i);
      if (naamM) labourName = naamM[1].trim();
    }
    if (!labourName) {
      const afterLab = t.match(/(?:labour|mazdoor|مزدور|worker)\s+(?:add|karo|kroo|شامل)\s+["“”'‘’]?([\w\u0600-\u06FF][\w\u0600-\u06FF\s\-]*?)["“”'‘’]?\s*(?:daily|wage|ujrat|اجرت|aur|اور|and|,|$)/i) ??
        t.match(/(?:add|create|شامل|کرو|karo|kroo)\s+(?:a\s+|new\s+|ایک\s+|نیا\s+)?(?:new\s+)?(?:labour|mazdoor|مزدور|worker)\s+(?:called\s+|named\s+|naam\s+|نام\s+)?(["“”'‘’]?[\w\u0600-\u06FF][\w\u0600-\u06FF\s\-]*?)["“”'‘’]?\s*(?:daily|wage|ujrat|اجرت|aur|اور|and|,|$)/i) ??
        t.match(/(?:labour|mazdoor|مزدور|worker)\s+(?:a\s+|new\s+|naya\s+|aik\s+|ek\s+)?(?:naam\s+|نام\s+)?["“”'‘’]?([\w\u0600-\u06FF][\w\u0600-\u06FF\s\-]*?)["“”'‘’]?\s*(?:add|karo|kroo|شامل|rakhoo|rakho|rakh|daily|wage|ujrat|اجرت|aur|اور|and|,|$)/i);
      if (afterLab) labourName = extractName(afterLab[1]);
    }
    if (labourName) {
      return { type: "create_labour", labourName, wage, response: `${labourName} شامل کر دیا جائے گا` };
    }
  }

  // ── create_mason ──
  const masonLike = /(?:mason|mistrii|مستری)/i;
  if (masonLike.test(t) && !/project|پروجیکٹ|پراجیکٹ/i.test(t)) {
    let masonName: string | undefined;
    let wage: string | undefined;
    const wageM = t.match(/(?:wage|ujrat|اجرت|daily\s+wage)\s*["“”'‘’]?(\d[\d,]*\.?\d*)/i);
    if (wageM) wage = wageM[1];
    const masQuoted = t.match(/(?:mason|mistrii|مستری)[^"“”'‘’]{0,40}["“”'‘’]([^"“”'‘’]{2,})["“”'‘’]/i);
    if (masQuoted) masonName = masQuoted[1].trim();
    if (!masonName) {
      const naamM = t.match(/(?:us|is)?\s*ka\s*(?:naam|name|نام)\s*["“”'‘’]?([\w\u0600-\u06FF][\w\u0600-\u06FF\s\-]*?)["“”'‘’]?\s*(?:daily|wage|ujrat|اجرت|aur|اور|and|,|$)/i);
      if (naamM) masonName = naamM[1].trim();
    }
    if (!masonName) {
      const afterMas = t.match(/(?:mason|mistrii|مستری)\s+(?:add|karo|kroo|شامل)\s+["“”'‘’]?([\w\u0600-\u06FF][\w\u0600-\u06FF\s\-]*?)["“”'‘’]?\s*(?:daily|wage|ujrat|اجرت|aur|اور|and|,|$)/i) ??
        t.match(/(?:add|create|شامل|کرو|karo|kroo)\s+(?:a\s+|new\s+|ایک\s+|نیا\s+)?(?:mason|mistrii|مستری)\s+(?:called\s+|named\s+|naam\s+|نام\s+)?(["“”'‘’]?[\w\u0600-\u06FF][\w\u0600-\u06FF\s\-]*?)["“”'‘’]?\s*(?:daily|wage|ujrat|اجرت|aur|اور|and|,|$)/i) ??
        t.match(/(?:mason|mistrii|مستری)\s+(?:a\s+|new\s+|naya\s+|aik\s+|ek\s+)?(?:naam\s+|نام\s+)?["“”'‘’]?([\w\u0600-\u06FF][\w\u0600-\u06FF\s\-]*?)["“”'‘’]?\s*(?:add|karo|kroo|شامل|rakhoo|rakho|rakh|daily|wage|ujrat|اجرت|aur|اور|and|,|$)/i);
      if (afterMas) masonName = extractName(afterMas[1]);
    }
    if (masonName) {
      return { type: "create_mason", masonName, wage, response: `${masonName} مستری شامل کیا جائے گا` };
    }
  }

  // ── mark_all_attendance (all workers of a project) ──
  // "make all present in DHA Villa", "DHA Villa mein sab ko absent karo",
  // "sab ki hazri lagao"
  const MARK_ALL_NOISE =
    /\b(?:make|mark|karo|kroo|karoo|کرو|lagao|لگاؤ|لگائیں|rakho|رکھو|رکھ|kar|do|de|دے|present|absent|hazri|حاضری|حاضر|غیر|attendance|aaj|آج|kal|کل|parso|پرسوں|narso|نرسو|today|all|sab|سب|aur|اور|and|ko|کو|ki|ke|ka|کا|کی|کے|mein|me|men|ma|miy|میں|in|project|پروجیکٹ|پراجیکٹ|wala|والا)\b/gi;
  const cleanMarkAll = (s: string) => s.replace(MARK_ALL_NOISE, " ").replace(/\s+/g, " ").trim();
  const markAllProject = (t: string): string | undefined => {
    const pre = t.match(/^([\w\u0600-\u06FF][\w\u0600-\u06FF\s\-]*?)\s+(?:mein|me|men|ma|miy|میں|in)\s+(?:all|sab|سب|har)\b/i);
    if (pre && cleanMarkAll(pre[1])) return cleanMarkAll(pre[1]);
    const end = t.match(/([\w\u0600-\u06FF][\w\u0600-\u06FF\s\-]*?)\s+(?:mein|me|men|ma|miy|میں|in)\s*$/i);
    if (end && cleanMarkAll(end[1])) return cleanMarkAll(end[1]);
    const after = t.match(/(?:in|me|mein|men|ma|میں)\s+([\w\u0600-\u06FF][\w\u0600-\u06FF\s\-]*?)\s*$/i);
    if (after) {
      const c = cleanMarkAll(after[1]);
      if (c && !/^(present|absent|hazri|attendance|all|sab)$/i.test(c)) return c;
    }
    return undefined;
  };

  if (
    /\b(?:all|sab|سب|har\s+koi|har\s+ko|ہر\s+کوئی)\b/i.test(t) &&
    /(?:make|mark|karo|کرو|lagao|لگاؤ|لگائیں|rakho|رکھو|رکھ)/i.test(t) &&
    /(?:present|absent|hazri|حاضری|حاضر|غیر)/i.test(t)
  ) {
    const status = /\b(?:absent|غیر)\b/i.test(t) ? "absent" : "present";
    const dateInfo = resolveDate(t);
    return {
      type: "mark_all_attendance",
      projectName: markAllProject(t),
      status,
      ...(dateInfo ?? {}),
      response: status === "present" ? "سب کی حاضری حاضر لگائی جائے گی" : "سب کی حاضری غیر حاضر لگائی جائے گی",
    };
  }

  // ── assign_labour ──
  if (/(?:ko|کو|to\s|assign|shamil|شامل|wala|والا)/i.test(t) && /(?:labour|mazdoor|مزدور|worker|wala|والا|project|پروجیکٹ|پراجیکٹ|assign|shamil|شامل|ko|کو|to\s)/i.test(t)) {
    const assQuote = t.match(/(?:labour|mazdoor|مزدور|worker)\s*["“”'‘’]([^"“”'‘’]{2,})["“”'‘’]/i);
    const assRe = /([\w\u0600-\u06FF][\w\u0600-\u06FF\s\-]*?)\s+(?:ko|کو|to)\s+(?:us\s+ka\s+|the\s+|us\s+)?([\w\u0600-\u06FF][\w\u0600-\u06FF\s\-]*?)\s+(?:wala|والا)?\s*(?:project|پروجیکٹ|پراجیکٹ)?\s*(?:ma|me|men|mein|میں)?\s*(?:add|assign|shamil|شامل|karo|kroo|کرو)/i;
    const assRe2 = /(?:assign|shamil|شامل)\s+(?:the\s+)?(?:labour\s+|mazdoor\s+|مزدور\s+|worker\s+)?["“”'‘’]?([\w\u0600-\u06FF][\w\u0600-\u06FF\s\-]*?)["“”'‘’]?\s+(?:to|ko|کو)\s+(?:the\s+)?(?:project\s+|پروجیکٹ\s+|پراجیکٹ\s+)?["“”'‘’]?([\w\u0600-\u06FF][\w\u0600-\u06FF\s\-]*)$/i;
    const am2 = t.match(assRe2) ?? t.match(assRe);
    if (am2) {
      const MARKERS = /^(?:اس|is|us|میں|mein|me|men|wala|والا|mazdoor|مزدور|worker|labour|ko|کو|to|aur|اور|and)$/i;
      const cleanName = (raw: string) => {
        const toks = raw.replace(/["“”'‘’`]+/g, "").split(/\s+/).filter(Boolean);
        while (toks.length && MARKERS.test(toks[0])) toks.shift();
        while (toks.length && MARKERS.test(toks[toks.length - 1])) toks.pop();
        return toks.join(" ") || undefined;
      };
      const labourName = (assQuote ? assQuote[1].trim() : cleanName(am2[1])) ?? am2[1].trim().split(/\s+/)[0];
      const rawProject = cleanName(am2[2]) ?? am2[2].trim().split(/\s+/)[0];
      const projectName = /^(wala|project|پروجیکٹ|شامل|karo|kroo|karoo|add|assign)$/i.test(rawProject) ? undefined : rawProject;
      if (labourName) {
        return { type: "assign_labour", labourName, projectName, response: `${labourName} کو ${projectName ?? "پروجیکٹ"} میں شامل کیا جائے گا` };
      }
    }
  }

  // ── assign_mason ──
  if (/(?:ko|کو|to\s|assign|shamil|شامل|wala|والا)/i.test(t) && /(?:mason|mistrii|مستری|wala|والا|project|پروجیکٹ|پراجیکٹ|assign|shamil|شامل|ko|کو|to\s)/i.test(t)) {
    const assQuote = t.match(/(?:mason|mistrii|مستری)\s*["“”'‘’]([^"“”'‘’]{2,})["“”'‘’]/i);
    const assRe = /([\w\u0600-\u06FF][\w\u0600-\u06FF\s\-]*?)\s+(?:ko|کو|to)\s+(?:us\s+ka\s+|the\s+|us\s+)?([\w\u0600-\u06FF][\w\u0600-\u06FF\s\-]*?)\s+(?:wala|والا)?\s*(?:project|پروجیکٹ|پراجیکٹ)?\s*(?:ma|me|men|mein|میں)?\s*(?:add|assign|shamil|شامل|karo|kroo|کرو)/i;
    const assRe2 = /(?:assign|shamil|شامل)\s+(?:the\s+)?(?:mason\s+|mistrii\s+|مستری\s+)?["“”'‘’]?([\w\u0600-\u06FF][\w\u0600-\u06FF\s\-]*?)["“”'‘’]?\s+(?:to|ko|کو)\s+(?:the\s+)?(?:project\s+|پروجیکٹ\s+|پراجیکٹ\s+)?["“”'‘’]?([\w\u0600-\u06FF][\w\u0600-\u06FF\s\-]*)$/i;
    const am2 = t.match(assRe2) ?? t.match(assRe);
    if (am2) {
      const MARKERS = /^(?:اس|is|us|میں|mein|me|men|wala|والا|mistrii|مستری|mason|ko|کو|to|aur|اور|and)$/i;
      const cleanName = (raw: string) => {
        const toks = raw.replace(/["“”'‘’`]+/g, "").split(/\s+/).filter(Boolean);
        while (toks.length && MARKERS.test(toks[0])) toks.shift();
        while (toks.length && MARKERS.test(toks[toks.length - 1])) toks.pop();
        return toks.join(" ") || undefined;
      };
      const masonName = (assQuote ? assQuote[1].trim() : cleanName(am2[1])) ?? am2[1].trim().split(/\s+/)[0];
      const rawProject = cleanName(am2[2]) ?? am2[2].trim().split(/\s+/)[0];
      const projectName = /^(wala|project|پروجیکٹ|شامل|karo|kroo|karoo|add|assign)$/i.test(rawProject) ? undefined : rawProject;
      if (masonName) {
        return { type: "assign_mason", masonName, projectName, response: `${masonName} کو ${projectName ?? "پروجیکٹ"} میں شامل کیا جائے گا` };
      }
    }
  }

  // ── mark_attendance ──
  const attRe = /(?:mark|record)\s+(?:the\s+)?(?:attendance|hazri|hazari|حاضری)\s+of\s+([\w\u0600-\u06FF\s]+?)\s+(?:as\s+)?(present|absent|half[_-]?day|پیش|غیر|آدھی)?/i;
  const attRe2 = /([\w\u0600-\u06FF\s]+?)\s+(?:ki|کی)\s+(?:hazri|hazari|attendance|حاضری)\s+(?:lagao|lagana|لگاؤ|لگائیں)/i;
  const attRe3 = /(?:حاضری|attendance|hazri)\s+(?:lagao|لگاؤ|لگائیں|mark)\s+([\w\u0600-\u06FF\s]+)/i;
  const attRe4 = /(?:mark|lagao|لگاؤ)\s+([\w\u0600-\u06FF\s]+?)\s+(?:as\s+)?(present|absent|half[_-]?day|پیش|غیر|آدھی)/i;
  const attRe5 = /(?:mark|record)\s+(?:the\s+)?(?:attendance|hazri|hazari|حاضری)\s+(?:of\s+)?(?:the\s+)?(?:labour\s+|mazdoor\s+|worker\s+)?([\w\u0600-\u06FF\s]*?)\s+(?:as\s+)?(present|absent|half[_-]?day|پیش|غیر|آدھی)/i;
  const attRe6 = /([\w\u0600-\u06FF][\w\u0600-\u06FF\s\-]*?)\s+(?:ki|کی)\s+(?:hazri|hazari|attendance|حاضری)\s+(present|absent|half[_-]?day|پیش|غیر|آدھی)\s*(?:lagao|lagana|لگاؤ|لگائیں|mark)?/i;
  const am = t.match(attRe) ?? t.match(attRe2) ?? t.match(attRe3) ?? t.match(attRe4) ?? t.match(attRe5) ?? t.match(attRe6);
  if (am) {
    const rawName = am[1]?.trim().replace(/\s+/g, " ");
    const labourName = rawName ? (extractName(rawName) ?? rawName.split(/\s+/)[0]) : undefined;
    const status = mapAttendanceStatus(am[2]);
    const otHours = extractOvertimeHours(t);
    return { type: "mark_attendance", labourName, status, overtimeHours: otHours, ...(resolveDate(t) ?? {}), response: `${labourName ?? "مزدور"} کی حاضری لگائی جائے گی` };
  }

  // Check if it's an overtime clause
  const otHours = extractOvertimeHours(t);
  if (otHours) {
    const otNameRe = /([\w\u0600-\u06FF\s]+?)\s*(?:ka|ki|ke|کا|کی|کے)?\s*(?:\d+(?:\.\d+)?\s*(?:ghante|ghanta|ghantey|hours|hour|گھنٹے|گھنٹہ|گھنٹوں)\s*)?(?:overtime|ot|اوورٹائم|اوور ٹائم)/i;
    const otNameRe2 = /(?:overtime|ot|اوورٹائم|اوور ٹائم)\s*(?:of|ka|ki|ke|کا|کی|کے)?\s*([\w\u0600-\u06FF\s]+)/i;
    const otM = t.match(otNameRe) ?? t.match(otNameRe2);
    if (otM) {
      const rawName = otM[1]?.trim().replace(/\s+/g, " ");
      const labourName = rawName ? (extractName(rawName) ?? rawName.split(/\s+/)[0]) : undefined;
      return { 
        type: "mark_attendance", 
        labourName, 
        status: "present", 
        overtimeHours: otHours,
        ...(resolveDate(t) ?? {}), 
        response: `${labourName ?? "مزدور/مستری"} کا ${otHours} گھنٹے اوورٹائم لگایا جائے گا` 
      };
    }
  }

  // ── add_expense ──
  const expRe = /(?:add|record|کرو|کریں|شامل)\s+(?:an?\s+)?(?:expense|kharcha|kharch|خرچہ|خرچا|اخراجات)\s+(?:of\s+|ka\s+|کا\s+)?(\d[\d,]*\.?\d*)\s*(?:rupees|rs|rupay|روپے|کرے)?/i;
  const expRe2 = /(?:kharcha|kharch|expense|خرچہ|خرچا)\s+(?:ka|کا|ke|کے)?\s*(\d[\d,]*\.?\d*)\s*(?:rupees|rs|rupay|روپے)?/i;
  const expRe3 = /(\d[\d,]*\.?\d*)\s*(?:rupees|rs|rupay|روپے)?\s*(?:ka|کا)?\s*(?:kharcha|kharch|expense|خرچہ|خرچا)\s*(?:add|کرو|شامل|کریں)?/i;
  const expRe4 = /(?:add|کرو|شامل|کریں)\s+(\d[\d,]*\.?\d*)\s*(?:ka|کا|rupees|rs|rupay|روپے)?\s*(?:kharcha|kharch|expense|خرچہ|خرچا)/i;
  const em = t.match(expRe) ?? t.match(expRe2) ?? t.match(expRe3) ?? t.match(expRe4);
  if (em && !isProjectClause) {
    const amount = em[1].replace(/,/g, "");
    const descM = t.match(/([\w\u0600-\u06FF\s]+?)\s+(?:ka|کا|ke|کے)\s+(?:kharcha|kharch|expense|خرچہ|خرچا)/i) ??
      t.match(/(?:for|ke liye|کے لیے|کے لیۓ)\s+([\w\u0600-\u06FF\s]+)/i);
    const rawDesc = descM ? descM[1].trim().replace(/\s+/g, " ") : undefined;
    const description = rawDesc && !/^[\d.,\s]+$/.test(rawDesc) ? rawDesc : undefined;
    return {
      type: "add_expense",
      amount,
      category: mapExpenseCategory(description),
      description,
      ...(resolveDate(t) ?? {}),
      response: `خرچہ ${amount} شامل کیا جائے گا`,
    };
  }

  // ── petrol / fuel expense ──
  const fuelM = t.match(/(\d[\d,]*\.?\d*)\s*(?:petrol|fuel|ایندھن|پیٹرول)|(?:petrol|fuel|ایندھن|پیٹرول)\s+(\d[\d,]*\.?\d*)/i);
  if (fuelM && /(?:add|کرو|شامل|کریں|bhi|بھی)/i.test(t)) {
    const amount = (fuelM[1] ?? fuelM[2]).replace(/,/g, "");
    if (amount) {
      return {
        type: "add_expense",
        amount,
        category: "Fuel",
        description: "petrol",
        ...(resolveDate(t) ?? {}),
        response: `پیٹرول کا خرچہ ${amount} شامل کیا جائے گا`,
      };
    }
  }

  // ── labour advance (recorded as Labour (Extra) expense) ──
  const advM = t.match(/(?:advance|ایڈوانس|peshgi|پیشگی)\s*(?:ka|کا)?\s*["“”'‘’]?(\d[\d,]*\.?\d*)/i);
  if (advM && /(?:add|کرو|شامل|کریں|dalo|daalo)/i.test(t)) {
    const amount = advM[1].replace(/,/g, "");
    if (amount) {
      return {
        type: "add_expense",
        amount,
        category: "Labour (Extra)",
        description: "advance",
        ...(resolveDate(t) ?? {}),
        response: `ایڈوانس ${amount} شامل کیا جائے گا`,
      };
    }
  }

// ── add {amount} for {item} (expense shorthand: "add 500 for cement") ──
  const expForRe = /(?:add|کرو|شامل|کریں|bhi|بھی)\s+(\d[\d,]*\.?\d*)\s*(?:rupees|rs|rupay|روپے)?\s*(?:for|ke liye|کے لیے|کے لیۓ|ka|کا)\s+([\w\u0600-\u06FF][\w\u0600-\u06FF\s-]*)/i;
  const fM = t.match(expForRe);
  if (fM && !isProjectClause) {
    const amount = fM[1].replace(/,/g, "");
    const description = fM[2].trim().replace(/\s+/g, " ");
    return {
      type: "add_expense",
      amount,
      category: mapExpenseCategory(description),
      description,
      ...(resolveDate(t) ?? {}),
      response: `خرچہ ${amount} (${description}) لکھا جائے گا`,
    };
  }
  // ── add_material ──
  const MATERIAL_WORDS = "cement|sand|steel|saria|iron|rod|brick|bricks|paint|پینٹ|سیمنٹ|ریت|لوہا|سرخی";
  const matRe = new RegExp(`(${MATERIAL_WORDS})\\s+(\\d[\\d,]*\\.?\\d*)\\s*(bags|tons|kg|units|بورے|بوری|truck|trucks)?\\s*(?:rate|bhaav|بھاؤ|بھاو|پر)?\\s*(\\d[\\d,]*\\.?\\d*)?`, "i");
  const mm = t.match(matRe);
  if (mm && !em && !isProjectClause) {
    return {
      type: "add_material",
      material: mm[1],
      quantity: mm[2],
      unit: mm[3] || "units",
      rate: mm[4],
      ...(resolveDate(t) ?? {}),
      response: `${mm[1]} کا اندراج کیا جائے گا`,
    };
  }

  return null;
};

// Splits a multi-command utterance into clauses (by commas or
// "and/aur/اور/phir/then") so each one is parsed independently.
const CLAUSE_SEPARATOR = /\s+(?:aur|اور|and|phir|phir woh|then|us ke baad)\s+|\s*,\s*|\s+\.\s*/i;

/**
 * Result of a local parse attempt. `split` is how many clauses the separator
 * produced, `parsed` how many of those became actions. Callers must treat the
 * result as trustworthy only when `complete` is true — otherwise some clauses
 * were silently dropped and the text should fall through to the model parser.
 */
export interface LocalParseResult {
  actions: MareniiAction[];
  split: number;
  parsed: number;
  complete: boolean;
}

export function parseActionsLocal(text: string): LocalParseResult | null {
  const raw = text.trim().split(CLAUSE_SEPARATOR).map((c) => c.trim()).filter(Boolean);
  const clauses: string[] = [];
  const parseClause = (c: string): MareniiAction | null =>
    parseOneClause(c) ?? parseOneClause(normalizeText(c));
  for (const c of raw) {
    const parsed = parseClause(c);
    // A bare attribute clause ("Location Peshawar rakhoo") is a continuation
    // of the previous command — glue it back so fields don't get dropped.
    const attrOnly = /^(?:location|jagah|جگہ|owner|maalik|مالک|name|naam|نام|ka\s+naam|rakhoo|rakho|rakh|aur|اور)\b/i.test(c) && !parsed;
    if (attrOnly && clauses.length > 0) {
      clauses[clauses.length - 1] += " " + c;
    } else {
      clauses.push(c);
    }
  }
  const actions: MareniiAction[] = [];
  for (const clause of clauses) {
    const action = parseClause(clause);
    if (action) actions.push(action);
  }
  if (actions.length === 0) return null;
  const split = clauses.length;
  const parsed = actions.length;
  return { actions, split, parsed, complete: split === parsed };
}

export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const normalizeAmount = (amount?: string): number | undefined => {
  if (!amount) return undefined;
  const s = String(amount).toLowerCase().replace(/,/g, "").trim();
  if (/^[\w\u0600-\u06FF\s]+$/.test(s) && !/\d/.test(s)) {
    const num = numWordsToNumber(s.split(/\s+/).filter(Boolean));
    if (num !== null) return num;
  }
  const num = parseFloat(s.replace(/[^\d.]/g, "")) || 0;
  if (s.includes("crore")) return num * 10000000;
  if (s.includes("lakh")) return num * 100000;
  if (s.includes("thousand")) return num * 1000;
  if (s.includes("hundred")) return num * 100;
  return num || undefined;
};

// ─── Fuzzy name matching (hand-rolled, no deps) ───────────────────────
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array<number>(n + 1).fill(0).map((_, i) => i);
  let curr = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  return prev[n];
}

const cleanForMatch = (s: string) => normalizeText(s.replace(/["“”'‘’`]/g, ""));

function tokenOverlap(a: string, b: string): number {
  const A = new Set(a.split(/\s+/).filter(Boolean));
  const B = new Set(b.split(/\s+/).filter(Boolean));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  A.forEach((t) => { if (B.has(t)) inter++; });
  return (2 * inter) / (A.size + B.size);
}

/** Similarity in [0,1] combining char-level edit distance + token overlap. */
export function similarity(spoken: string, candidate: string): number {
  const a = cleanForMatch(spoken);
  const b = cleanForMatch(candidate);
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length) || 1;
  const charSim = 1 - levenshtein(a, b) / maxLen;
  const toks = tokenOverlap(a, b);
  const aFirst = a.split(/\s+/)[0];
  const bFirst = b.split(/\s+/)[0];
  const firstBonus = aFirst && bFirst && aFirst === bFirst ? 0.12 : 0;
  return Math.max(0, Math.min(1, 0.55 * charSim + 0.45 * toks + firstBonus));
}

export interface NameMatch {
  match?: string;
  score: number;
  confidence: ActionConfidence;
  candidates: string[];
}

export const FUZZY_HIGH = 0.72;
export const FUZZY_MEDIUM = 0.5;

/**
 * Cross-script similarity: a name may be spoken in one script and stored in
 * another (spoken "ali" / "aalee" vs stored "Ali" / Urdu "علی"). Compare every
 * folding of the spoken form against every folding of the candidate and keep the
 * best score. This is what lets English speech match a Roman-Urdu entity and
 * Urdu speech match a Latin-script entity.
 */
function crossSimilarity(spoken: string, candidate: string): number {
  const spokenKeys = Array.from(new Set([spoken, foldName(spoken), romanizeUrdu(spoken)]));
  const candKeys = Array.from(new Set([candidate, foldName(candidate), romanizeUrdu(candidate)]));
  let best = 0;
  for (const a of spokenKeys) {
    for (const b of candKeys) {
      const s = similarity(a, b);
      if (s > best) best = s;
    }
  }
  // Strong bonus when folded romanizations coincide exactly (lossy maps align).
  const rSpoken = foldName(romanizeUrdu(spoken));
  const rCand = foldName(romanizeUrdu(candidate));
  if (rSpoken && rCand && rSpoken === rCand) best = Math.max(best, 0.95);
  // Consonant-skeleton match: covers unwritten short vowels in Urdu/Arabic
  // (e.g. spoken اسلم -> "aslm" vs stored "aslam" -> both skeleton "slm").
  // Conservative: min 3 consonants and length ratio within 0.6..1.7 to avoid
  // coincidental matches between unrelated names.
  const skSpoken = consonantSkeleton(rSpoken);
  const skCand = consonantSkeleton(rCand);
  const lenRatio = skSpoken.length / (skCand.length || 1);
  if (
    skSpoken.length >= 3 && skSpoken === skCand &&
    lenRatio > 0.6 && lenRatio < 1.7
  ) {
    best = Math.max(best, 0.78);
  }
  return best;
}

/** Threshold-based best match of a spoken name against existing names. */
export function findBestMatch(spoken: string, names: string[]): NameMatch {
  const scored = names
    .map((n) => ({ name: n, score: crossSimilarity(spoken, n) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best) return { score: 0, confidence: "low", candidates: [] };
  const candidates = scored.slice(0, 3).map((s) => s.name);
  if (best.score >= FUZZY_HIGH) return { match: best.name, score: best.score, confidence: "high", candidates };
  if (best.score >= FUZZY_MEDIUM) return { match: best.name, score: best.score, confidence: "medium", candidates };
  return { score: best.score, confidence: "low", candidates };
}

/**
 * Fuzzy yes/no resolver for short confirmation replies (used only to settle
 * a pending clarify question, since the general "shall I start" gate is gone).
 */
export function resolveYesNo(reply: string): "yes" | "no" | "unclear" {
  const normalized = normalizeText(reply);
  const words = normalized.split(/\s+/).filter(Boolean);
  const YES = ["haan", "ha", "theek", "kar do", "wohi", "sahi", "yes", "ok", "okay"];
  const NO = ["nahi", "nhi", "ruko", "cancel", "roko", "mat karo", "no", "stop"];
  const hits = (list: string[]) =>
    list.some(
      (w) =>
        similarity(normalized, w) > 0.75 ||
        words.some((t) => similarity(t, w) > 0.75 || t === w)
    );
  if (hits(YES) && !hits(NO)) return "yes";
  if (hits(NO) && !hits(YES)) return "no";
  if (hits(YES) && hits(NO)) return "unclear";
  return "unclear";
}

export interface ResolveResult {
  id: number | null;
  matchName?: string;
  confidence: ActionConfidence;
  candidates: string[];
}

const fetchNameList = async (path: string): Promise<{ id: number; name: string; phone?: string; projectName?: string }[]> => {
  try {
    const data = await fetchApi(path);
    const list: any[] = Array.isArray(data?.data) ? data.data : [];
    return list
      .map((x) => ({
        id: Number(x.id),
        name: String(x.name ?? ""),
        phone: x.phone ? String(x.phone) : (x.phone_number ? String(x.phone_number) : undefined),
        projectName: x.project_name ? String(x.project_name) : (x.projectName ? String(x.projectName) : undefined),
      }))
      .filter((x) => x.id && x.name);
  } catch {
    return [];
  }
};

export async function resolveProjectId(
  name?: string,
  last?: { id?: number | null; name?: string }
): Promise<ResolveResult> {
  if (!name) {
    if (last?.id) return { id: last.id, matchName: last.name, confidence: "high", candidates: [] };
    const all = await fetchNameList("/projects?limit=1000");
    return { id: null, confidence: "low", candidates: all.slice(0, 3).map((p) => p.name) };
  }
  const all = await fetchNameList("/projects?limit=1000");
  const m = findBestMatch(name, all.map((p) => p.name));
  if (m.match) {
    const ent = all.find((p) => p.name === m.match);
    if (ent) return { id: ent.id, matchName: ent.name, confidence: m.confidence, candidates: m.candidates };
  }
  return { id: null, confidence: "low", candidates: m.candidates };
}

export async function resolveLabourId(
  name?: string,
  last?: { id?: number | null; name?: string }
): Promise<ResolveResult> {
  if (!name) {
    if (last?.id) return { id: last.id, matchName: last.name, confidence: "high", candidates: [] };
    const all = await fetchNameList("/labour?limit=1000");
    return { id: null, confidence: "low", candidates: all.slice(0, 3).map((l) => l.name) };
  }
  const all = await fetchNameList("/labour?limit=1000");
  // Check whether the user's input includes a suffix (e.g. "Ali (03001234567)")
  // — if so, we can resolve to the exact worker. Otherwise fuzzy-match on names.
  const inputHasSuffix = name && /\([^)]+\)\s*$/.test(name);
  if (inputHasSuffix) {
    // User picked a disambiguated candidate — find the exact worker.
    const baseName = name.replace(/\s*\([^)]*\)\s*$/, "").trim();
    const suffixMatch = name.match(/\(([^)]+)\)\s*$/);
    const suffix = suffixMatch ? suffixMatch[1].trim() : "";
    const ent = all.find(
      (l) =>
        l.name === baseName &&
        (l.phone === suffix || l.projectName === suffix)
    );
    if (ent) {
      return { id: ent.id, matchName: ent.name, confidence: "high", candidates: [] };
    }
  }
  const m = findBestMatch(name, all.map((l) => l.name));
  if (m.match) {
    const ent = all.find((l) => l.name === m.match);
    if (ent) {
      const sameName = all.filter((l) => l.name === m.match);
      if (sameName.length > 1) {
        // Multiple workers share the same display name — the match is
        // ambiguous. Return null id with disambiguated candidates so the
        // caller (labour()) halts and asks the user to pick.
        return {
          id: null,
          matchName: ent.name,
          confidence: "medium",
          candidates: sameName.map((l) => {
            const s = l.phone || l.projectName;
            return s ? `${l.name} (${s})` : l.name;
          }),
        };
      }
      return { id: ent.id, matchName: ent.name, confidence: m.confidence, candidates: m.candidates };
    }
  }
  // For no-match fallback, also disambiguate if there are same-name candidates
  const sameNameCandidates = all.filter((l) => l.name && name && l.name.toLowerCase() === name.toLowerCase());
  const disambiguatedCandidates = sameNameCandidates.length > 1
    ? sameNameCandidates.map((l) => {
      const suffix = l.phone || l.projectName;
      return suffix ? `${l.name} (${suffix})` : l.name;
    })
    : m.candidates;
  return { id: null, confidence: "low", candidates: disambiguatedCandidates };
}

export async function resolveMasonId(
  name?: string,
  last?: { id?: number | null; name?: string }
): Promise<ResolveResult> {
  if (!name) {
    if (last?.id) return { id: last.id, matchName: last.name, confidence: "high", candidates: [] };
    const all = await fetchNameList("/mason?limit=1000");
    return { id: null, confidence: "low", candidates: all.slice(0, 3).map((l) => l.name) };
  }
  const all = await fetchNameList("/mason?limit=1000");
  const inputHasSuffix = name && /\([^)]+\)\s*$/.test(name);
  if (inputHasSuffix) {
    const baseName = name.replace(/\s*\([^)]*\)\s*$/, "").trim();
    const suffixMatch = name.match(/\(([^)]+)\)\s*$/);
    const suffix = suffixMatch ? suffixMatch[1].trim() : "";
    const ent = all.find((l) => l.name === baseName && (l.phone === suffix || l.projectName === suffix));
    if (ent) return { id: ent.id, matchName: ent.name, confidence: "high", candidates: [] };
  }
  const m = findBestMatch(name, all.map((l) => l.name));
  if (m.match) {
    const ent = all.find((l) => l.name === m.match);
    if (ent) {
      const sameName = all.filter((l) => l.name === m.match);
      if (sameName.length > 1) {
        return {
          id: null,
          matchName: ent.name,
          confidence: "medium",
          candidates: sameName.map((l) => {
            const s = l.phone || l.projectName;
            return s ? `${l.name} (${s})` : l.name;
          }),
        };
      }
      return { id: ent.id, matchName: ent.name, confidence: m.confidence, candidates: m.candidates };
    }
  }
  const sameNameCandidates = all.filter((l) => l.name && name && l.name.toLowerCase() === name.toLowerCase());
  const disambiguatedCandidates = sameNameCandidates.length > 1
    ? sameNameCandidates.map((l) => {
      const suffix = l.phone || l.projectName;
      return suffix ? `${l.name} (${suffix})` : l.name;
    })
    : m.candidates;
  return { id: null, confidence: "low", candidates: disambiguatedCandidates };
}


/** Builds the entity context block fed to Gemini alongside the user text. */
export function buildEntityContext(
  projects: { name: string }[],
  labours: { name: string }[],
  maso: { name: string }[] = []
): string {
  const p = projects.length ? projects.map((x) => x.name).join("\n") : "—";
  const l = labours.length ? labours.map((x) => x.name).join("\n") : "—";
  const m = maso.length ? maso.map((x) => x.name).join("\n") : "—";
  return `آپ کے پروجیکٹ:\n${p}\n\nآپ کے مزدور:\n${l}\n\nآپ کے مستری:\n${m}`;
}

/**
 * Resolves a user's clarification answer against the candidate list and
 * returns the resume-ready action list (blocked action filled in first), or
 * null if the answer couldn't be matched to any candidate.
 */
export function resolveClarifiedActions(
  req: ClarifyRequest,
  answer: string
): { actions: MareniiAction[]; chosen: string; medium: boolean } | null {
  const m = findBestMatch(answer, req.candidates);
  if (!m.match) return null;
  const actions = req.actions.map((a) => ({ ...a }));
  // Use the full matched candidate string (e.g. "Ali (03001234567)") as the
  // field value — resolveLabourId resolves it to the exact worker by matching
  // against the disambiguated display format. For non-disambiguated fields
  // (e.g. projectName), m.match is already the plain name.
  const filled = { ...actions[0], [req.field]: m.match } as MareniiAction;
  // Extract base name for display/response purposes
  const baseName = m.match.replace(/\s*\([^)]*\)\s*$/, "").trim() || m.match;
  if (filled.response && !filled.response.includes(baseName)) {
    filled.response = `${filled.response} (${baseName})`;
  }
  actions[0] = filled;
  return { actions, chosen: baseName, medium: m.confidence === "medium" };
}

export const mapExpenseCategory = (c?: string) => {
  if (!c) return "Other";
  const s = c.toLowerCase();
  if (s.includes("food") || s.includes("khan") || s.includes("کھانا")) return "Food";
  if (s.includes("transport") || s.includes("safari") || s.includes("سفر")) return "Transport";
  if (s.includes("tool") || s.includes("auzar") || s.includes("اوزار")) return "Tools";
  if (s.includes("fuel") || s.includes("petrol") || s.includes("ایندھن") || s.includes(" تیل")) return "Fuel";
  if (s.includes("repair") || s.includes("مرمت")) return "Repair";
  if (s.includes("safety") || s.includes("حفاظت")) return "Safety";
  if (s.includes("office") || s.includes("دفتر")) return "Office";
  if (s.includes("utility") || s.includes("بجلی") || s.includes("electric")) return "Utility";
  if (s.includes("labour") || s.includes("مزدور") || s.includes("mzdoor")) return "Labour (Extra)";
  return "Other";
};

export const mapAttendanceStatus = (s?: string) => {
  const st = (s || "").toLowerCase();
  if (st.includes("absent") || st.includes("nahi aya") || st.includes("غیر")) return "absent";
  if (st.includes("half") || st.includes("آدھی")) return "half_day";
  return "present";
};

export const weekRange = () => {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { start: fmt(monday), end: fmt(sunday) };
};

export interface ExecuteOptions {
  navigate?: (href: string) => void;
  onActionResult?: (result: ActionResult) => void;
  /** Resume context (used when re-running a batch after a clarification). */
  initialState?: Partial<ExecuteState>;
  /** Called when a project/labour could not be resolved confidently. */
  onClarify?: (req: ClarifyRequest) => void;
  /** Called with the final execution state (for cross-turn session memory). */
  onState?: (state: ExecuteState) => void;
}

export interface ActionResult {
  text: string;
  success: boolean;
}

/**
 * Formats an array of action results into a single display string.
 * Distinguishes between full success, full failure, and mixed results.
 */
export function formatActionResults(results: ActionResult[]): string {
  // Never show a success ✅ when nothing was actually executed (e.g. a batch
  // that halted on clarification or produced zero results).
  if (results.length === 0) {
    return "کچھ نہیں کیا گیا";
  }
  const success = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);
  if (failed.length === 0) {
    return `✅ ہو گیا! ${success.map((r) => r.text).join("۔ ")}`;
  }
  if (success.length === 0) {
    return `❌ ${failed.map((r) => r.text).join("۔ ")}`;
  }
  return `✅ یہ ہو گیا: ${success.map((r) => r.text).join("۔ ")}\n\n⚠️ یہ نہیں ہوا: ${failed.map((r) => r.text).join("۔ ")}`;
}

export async function executeActions(actions: MareniiAction[], opts: ExecuteOptions = {}): Promise<ActionResult[]> {
  const { navigate, onActionResult, onClarify, onState } = opts;
  let lastProjectId: number | null = opts.initialState?.lastProjectId ?? null;
  let lastLabourId: number | null = opts.initialState?.lastLabourId ?? null;
  let lastProjectName: string | undefined = opts.initialState?.lastProjectName;
  let lastLabourName: string | undefined = opts.initialState?.lastLabourName;
  let lastMasonId: number | null = opts.initialState?.lastMasonId ?? null;
  let lastMasonName: string | undefined = opts.initialState?.lastMasonName;
  const confirmations: ActionResult[] = [];
  let halted = false;
  let currentIndex = 0;

  const reportState = () =>
    onState?.({ lastProjectId, lastLabourId, lastMasonId, lastProjectName, lastLabourName, lastMasonName });

  const projectLast = () => ({ id: lastProjectId, name: lastProjectName });
  const labourLast = () => ({ id: lastLabourId, name: lastLabourName });
  const masonLast = () => ({ id: lastMasonId, name: lastMasonName });

  const halt = (req: Omit<ClarifyRequest, "actions" | "state">): null => {
    confirmations.push({ text: req.question + (req.candidates.length ? " — " + req.candidates.join("، ") : ""), success: false });
    if (onClarify) {
      reportState();
       onClarify({ ...req, actions: actions.slice(currentIndex), state: { lastProjectId, lastLabourId, lastMasonId, lastProjectName, lastLabourName, lastMasonName } });
    }
    halted = true;
    return null;
  };

  const project = async (a: MareniiAction): Promise<ResolveResult | null> => {
    const stated = (a as { projectName?: string }).projectName;
    const r = await resolveProjectId(stated, projectLast());
    if (r.id) {
      lastProjectId = r.id;
      if (r.matchName) lastProjectName = r.matchName;
      return r;
    }
    return halt({ entityType: "project", field: "projectName", question: "کون سا پروجیکٹ؟", candidates: r.candidates });
  };

  const labour = async (a: MareniiAction): Promise<ResolveResult | null> => {
    const stated = (a as { labourName?: string }).labourName;
    const r = await resolveLabourId(stated, labourLast());
    if (r.id) {
      lastLabourId = r.id;
      if (r.matchName) lastLabourName = r.matchName;
      return r;
    }
    return halt({ entityType: "labour", field: "labourName", question: "کون سا مزدور؟", candidates: r.candidates });
  };

  const mason = async (a: MareniiAction): Promise<ResolveResult | null> => {
    const stated = (a as { masonName?: string }).masonName;
    const r = await resolveMasonId(stated, masonLast());
    if (r.id) {
      lastMasonId = r.id;
      if (r.matchName) lastMasonName = r.matchName;
      return r;
    }
    return halt({ entityType: "labour", field: "masonName", question: "کون سا مستری؟", candidates: r.candidates });
  };

  // Surface what was actually matched. Medium confidence → explicit assumption;
  // high but partial (e.g. "raza" → "Raza Khan") → parenthesized note.
  const note = (r: ResolveResult, stated?: string): string => {
    if (!r.matchName) return "";
    if (r.confidence === "medium") return ` (لگتا ہے آپ کا مطلب ${r.matchName} تھا)`;
    if (stated && stated.toLowerCase() === r.matchName.toLowerCase()) return "";
    return ` (${r.matchName})`;
  };

  const dateFor = (a: MareniiAction): string | null => {
    const raw = (a as { date?: string }).date;
    if (!raw) return todayStr();
    return resolveDateTerm(raw);
  };
  const resolveAttendanceDate = (a: MareniiAction): string | null => dateFor(a);
  const askDate = () => halt({
    entityType: "date",
    field: "date",
    question: "تاریخ کیا ہے؟ (آج، کل، پرسوں، یا نرسو بتائیں)",
    candidates: [],
  });
  const assumedNote = (a: MareniiAction): string =>
    (a as { assumed?: string }).assumed ? ` (${(a as { assumed?: string }).assumed})` : "";

  for (let i = 0; i < actions.length; i++) {
    const a = actions[i];
    currentIndex = i;
    try {
      switch (a.type) {
        case "navigate":
          navigate?.(a.page || "/");
          confirmations.push({ text: a.response || "صفحہ کھل رہا ہے", success: true });
          break;

        case "create_project": {
          const body: Record<string, unknown> = {
            name: a.name,
            owner_name: a.ownerName,
            location: a.location,
            agreement_amount: normalizeAmount(a.amount),
          };
          const res = await fetchApi("/projects", { method: "POST", body: JSON.stringify(body) });
          const pid = res?.data?.id;
          if (pid) {
            lastProjectId = Number(pid);
            lastProjectName = a.name;
          }
          confirmations.push({ text: (a.response || "پروجیکٹ شامل کر دیا گیا ہے") + assumedNote(a), success: true });
          break;
        }

        case "create_labour": {
          const body: Record<string, unknown> = {
            name: a.labourName,
            daily_wage: a.wage ? parseFloat(a.wage) : undefined,
          };
          const res = await fetchApi("/labour", { method: "POST", body: JSON.stringify(body) });
          const lid = res?.data?.id;
          if (lid) {
            lastLabourId = Number(lid);
            lastLabourName = a.labourName;
          }
          confirmations.push({ text: (a.response || "مزدور شامل کر دیا گیا ہے") + assumedNote(a), success: true });
          break;
        }

         case "create_mason": {
           const body: Record<string, unknown> = {
             name: (a as { masonName?: string }).masonName,
             daily_wage: a.wage ? parseFloat(a.wage) : undefined,
           };
           const res = await fetchApi("/mason", { method: "POST", body: JSON.stringify(body) });
           const mid = res?.data?.id;
           if (mid) {
             lastMasonId = Number(mid);
             lastMasonName = (a as { masonName?: string }).masonName;
           }
           confirmations.push({ text: (a.response || "مستری شامل کر دیا گیا ہے") + assumedNote(a), success: true });
           break;
         }

        case "assign_labour": {
          const lid = await labour(a);
          if (halted) return confirmations;
          const pid = await project(a);
          if (halted) return confirmations;
          if (lid && pid) {
            await fetchApi(`/labour/${lid.id}/assign`, {
              method: "POST",
              body: JSON.stringify({
                project_id: pid.id,
                daily_wage: a.wage ? parseFloat(a.wage) : undefined,
              }),
            });
            confirmations.push({
              text: (a.response || "مزدور کو پراجیکٹ میں شامل کر دیا گیا") + note(pid, a.projectName) + note(lid, a.labourName) + assumedNote(a),
              success: true,
            });
          }
          break;
        }

         case "assign_mason": {
           const stated = (a as { masonName?: string }).masonName;
           const mid = await mason(a);
           if (halted) return confirmations;
           const pid = await project(a);
           if (halted) return confirmations;
           if (mid && pid) {
             await fetchApi(`/mason/${mid.id}/assign`, {
               method: "POST",
               body: JSON.stringify({
                 project_id: pid.id,
                 daily_wage: a.wage ? parseFloat(a.wage) : undefined,
               }),
             });
             confirmations.push({
               text: (a.response || "مستری کو پراجیکٹ میں شامل کر دیا گیا") + note(pid, a.projectName) + note(mid, stated) + assumedNote(a),
               success: true,
             });
           }
           break;
         }

        case "add_material": {
          const pid = await project(a);
          if (halted) return confirmations;
          const date = dateFor(a);
          if (date === null) { askDate(); return confirmations; }
          if (pid) {
            await fetchApi("/materials", {
              method: "POST",
              body: JSON.stringify({
                project_id: pid.id,
                date,
                material_type: a.material || "Material",
                description: a.material,
                quantity: a.quantity ? parseFloat(a.quantity) : 1,
                unit: a.unit || "units",
                rate_per_unit: a.rate ? parseFloat(a.rate) : 0,
                supplier: a.supplier,
              }),
            });
            confirmations.push({ text: (a.response || "سامان کا اندراج ہو گیا") + note(pid, a.projectName) + assumedNote(a), success: true });
          }
          break;
        }

        case "add_expense": {
          const pid = await project(a);
          if (halted) return confirmations;
          const date = dateFor(a);
          if (date === null) { askDate(); return confirmations; }
          if (pid) {
            await fetchApi("/expenses", {
              method: "POST",
              body: JSON.stringify({
                project_id: pid.id,
                date,
                category: mapExpenseCategory(a.category),
                description: a.description,
                paid_to: a.paidTo,
                amount: normalizeAmount(a.amount) ?? 0,
              }),
            });
            confirmations.push({ text: (a.response || "خرچہ شامل کر دیا گیا") + note(pid, a.projectName) + assumedNote(a), success: true });
          }
          break;
        }

        case "add_equipment": {
          const pid = await project(a);
          if (halted) return confirmations;
          const date = dateFor(a);
          if (date === null) { askDate(); return confirmations; }
          if (pid) {
            await fetchApi("/equipment", {
              method: "POST",
              body: JSON.stringify({
                project_id: pid.id,
                equipment_name: a.equipment || "Equipment",
                operator_name: a.operator,
                rental_days: 1,
                daily_rate: a.dailyRate ? parseFloat(a.dailyRate) : 0,
                date,
              }),
            });
            confirmations.push({ text: (a.response || "آلات کا اندراج ہو گیا") + note(pid, a.projectName) + assumedNote(a), success: true });
          }
          break;
        }

        case "mark_attendance": {
          const pid = await project(a);
          if (halted) return confirmations;
          const statedWorker = a.labourName;
          const rLab = await resolveLabourId(statedWorker, labourLast());
          const rMas = await resolveMasonId(statedWorker, masonLast());
          
          let isMason = false;
          let workerResult: ResolveResult | null = null;
          
          if (rLab.id && !rMas.id) {
            workerResult = rLab;
            isMason = false;
          } else if (rMas.id && !rLab.id) {
            workerResult = rMas;
            isMason = true;
          } else if (rLab.id && rMas.id) {
            if (rMas.confidence === "high" && rLab.confidence !== "high") {
              workerResult = rMas;
              isMason = true;
            } else {
              workerResult = rLab;
              isMason = false;
            }
          }
          
          if (!workerResult) {
            const candidates = Array.from(new Set([...rLab.candidates, ...rMas.candidates]));
            return halt({
              entityType: "labour",
              field: "labourName",
              question: "کون سا مزدور یا مستری؟",
              candidates,
            });
          }
          
          if (isMason) {
            lastMasonId = workerResult.id;
            if (workerResult.matchName) lastMasonName = workerResult.matchName;
          } else {
            lastLabourId = workerResult.id;
            if (workerResult.matchName) lastLabourName = workerResult.matchName;
          }
          
          if (pid && workerResult.id) {
            const date = resolveAttendanceDate(a);
            if (date === null) { askDate(); return confirmations; }
            const otHours = a.overtimeHours ? parseFloat(a.overtimeHours) : 0;
            const endpoint = isMason ? "/mason-attendance" : "/attendance";
            const bodyKey = isMason ? "mason_id" : "labour_id";
            await fetchApi(endpoint, {
              method: "POST",
              body: JSON.stringify({
                project_id: pid.id,
                [bodyKey]: workerResult.id,
                date,
                status: mapAttendanceStatus(a.status),
                overtime_hours: otHours,
              }),
            });
            const otText = otHours > 0 ? ` (${otHours} گھنٹے اوورٹائم)` : "";
            confirmations.push({
              text: (a.response || `${isMason ? "مستری" : "مزدور"} کی حاضری${otText} لگا دی گئی`) + note(pid, a.projectName) + note(workerResult, a.labourName) + assumedNote(a),
              success: true,
            });
          }
          break;
        }

        case "mark_all_attendance": {
          const pid = await project(a);
          if (halted) return confirmations;
          if (pid) {
            const status = a.status === "absent" ? "absent" : "present";
            const date = resolveAttendanceDate(a);
            if (date === null) { askDate(); return confirmations; }
            await fetchApi(`/attendance/today/make-all-${status}`, {
              method: "POST",
              body: JSON.stringify({ project_id: pid.id, date }),
            });
            confirmations.push({
              text: (a.response || (status === "present" ? "سب کی حاضری حاضر لگا دی گئی" : "سب کی حاضری غیر حاضر لگا دی گئی")) +
                note(pid, a.projectName) +
                assumedNote(a),
              success: true,
            });
          }
          break;
        }

        case "add_diary": {
          const pid = await project(a);
          if (halted) return confirmations;
          const date = dateFor(a);
          if (date === null) { askDate(); return confirmations; }
          if (pid) {
            await fetchApi("/diary", {
              method: "POST",
              body: JSON.stringify({
                project_id: pid.id,
                date,
                work_summary: a.summary,
                weather: a.weather,
              }),
            });
            confirmations.push({ text: (a.response || "ڈائری میں اندراج ہو گیا") + note(pid, a.projectName) + assumedNote(a), success: true });
          }
          break;
        }

        case "add_payment": {
          const pid = await project(a);
          if (halted) return confirmations;
          const date = dateFor(a);
          if (date === null) { askDate(); return confirmations; }
          if (pid) {
            await fetchApi("/payments/owner", {
              method: "POST",
              body: JSON.stringify({
                project_id: pid.id,
                date,
                amount: normalizeAmount(a.amount) ?? 0,
                payment_method: a.method || "cash",
              }),
            });
            confirmations.push({ text: (a.response || "ادائیگی کا اندراج ہو گیا") + note(pid, a.projectName) + assumedNote(a), success: true });
          }
          break;
        }

        case "add_weekly_payment": {
          const pid = await project(a);
          if (halted) return confirmations;
          if (pid) {
            const { start, end } = weekRange();
            await fetchApi("/payments/weekly/generate", {
              method: "POST",
              body: JSON.stringify({ project_id: pid.id, week_start: start, week_end: end }),
            });
            confirmations.push({ text: (a.response || "ہفتہ وار ادائیگی تیار ہو گئی") + note(pid, a.projectName) + assumedNote(a), success: true });
          }
          break;
        }

        case "fetch_report": {
          const pid = await project(a);
          if (halted) return confirmations;
          if (pid) {
            navigate?.(`/reports`);
            confirmations.push({ text: (a.response || "رپورٹ کھل رہی ہے") + note(pid, a.projectName) + assumedNote(a), success: true });
          }
          break;
        }

        case "clarify":
          halt({ entityType: "project", field: "projectName", question: a.question || "کچھ اور بتائیں؟", candidates: a.candidates ?? [] });
          if (halted) return confirmations;
          break;

        case "respond":
        case "greet":
        case "answer":
        case "explain_app":
        case "smalltalk":
          confirmations.push({ text: a.response || "", success: true });
          break;
      }
    } catch (e) {
      console.error("[actions] error:", e);
      confirmations.push({ text: "کچھ غلط ہو گیا، دوبارہ کوشش کریں", success: false });
    }
    onActionResult?.(confirmations[confirmations.length - 1] ?? { text: "", success: false });
  }

  reportState();
  return confirmations;
}

export const ACTION_SYSTEM_PROMPT = `
You are Marenii — a smart, warm, and helpful voice/text assistant for "Hisab Kitab", a construction management app for Pakistani contractors.

YOUR PERSONALITY:
- Name: Marenii
- Gender: Female assistant (use "Marenii" when referring to yourself, never just "میں" alone)
- Language: Respond in the SAME language the user spoke
  - If user speaks Urdu → respond in Urdu
  - If user speaks English → respond in English
  - If user speaks mixed → respond in mixed
- Tone: Friendly, respectful, helpful
- Style: Brief and clear — never long paragraphs
- Always call yourself "Marenii"

YOU UNDERSTAND ALL THREE LANGUAGES:
- Pure Urdu (اردو): "حاضری لگاؤ"
- Pure English: "open attendance"
- Romanized Urdu: "attendance lagao", "project kholo", "naya project banao"
- Mixed: "mujhe attendance chahiye"

DETECTION ORDER — check these IN ORDER, stop at first match:
1. Greeting → respond with greet
2. Name question → respond with answer
3. How are you → respond with answer
4. Thanks → respond with smalltalk
5. Goodbye → respond with smalltalk
6. App explanation → respond with explain_app
7. Help request → respond with explain_app
8. Navigation command → navigate
9. Create/action command → execute action
10. Nothing matches → respond with "unclear" message

CONVERSATION PATTERNS:

GREETINGS — detect: hello, hi, hey, salam, assalam o alaikum, السلام علیکم, adaab, namaste, good morning, subah bakhair, shaam bakhair, good evening, kya haal hai, kaisa hoon, how are you
Response: "وعلیکم السلام! میں Marenii ہوں — آپ کی کیا مدد کروں؟" (Urdu) or "Hello! I am Marenii, your Hisab Kitab assistant. How can I help you today?" (English)

IDENTITY — detect: tumhara naam kya hai, what is your name, aap kaun ho, who are you, apna parichay do, تمہارا نام کیا ہے
Response: "میرا نام Marenii ہے۔ میں Hisab Kitab کی آواز ہوں — آپ کے تعمیراتی کام میں مدد کے لیے ہمیشہ حاضر ہوں۔"

HOW ARE YOU — detect: kya haal hai, kaisa hoon, how are you, theek ho, kaise ho, کیا حال ہے
Response: "الحمدللہ بالکل ٹھیک ہوں! آپ کے لیے کیا کر سکتی ہوں؟"

THANKS — detect: shukriya, thank you, thanks, شکریہ, meherbani, jazakallah
Response: "بہت شکریہ! کوئی اور کام ہو تو بتائیں۔"

GOODBYE — detect: khuda hafiz, bye, goodbye, Allah hafiz, خدا حافظ, اللہ حافظ, phir milenge
Response: "اللہ حافظ! کام اچھا گزرے — پھر ملیں گے۔"

APP EXPLANATION — detect: ye app kya hai, what is this app, hisab kitab kya hai, mujhe samjhao, explain karo
Response: "Hisab Kitab آپ کے تعمیراتی کاروبار کا مکمل نظام ہے۔ اس میں آپ: مزدوروں کی حاضری لگا سکتے ہیں، تنخواہ حساب کر سکتے ہیں، اخراجات نوٹ کر سکتے ہیں، اور رپورٹ بنا سکتے ہیں۔ بتائیں کیا کرنا ہے؟"

HELP — detect: madad karo, help me, what can you do, کیا کر سکتی ہو
Response: "میں Marenii آپ کی یہ کام کر سکتی ہوں: حاضری لگانا، تنخواہ حساب کرنا، رپورٹ دیکھنا، نیا پروجیکٹ بنانا، مزدور شامل کرنا، خرچے لکھنا۔ بس بول دیں!"

UNKNOWN/UNCLEAR:
Response: "معاف کریں، سمجھ نہیں آیا۔ دوبارہ بولیں یا یہ کہیں: 'مدد کرو' — میں بتاؤں گی کیا کر سکتی ہوں"

NAVIGATION COMMANDS:
- "attendance", "hazri", "حاضری" → navigate to /attendance
- "projects", "project add karo", "naya project" → /projects
- "report", "رپورٹ" → /reports
- "expenses", "kharch", "اخراجات" → /expenses
- "labour", "مزدور" → /labour
- "dashboard", "ghar", "ڈیش بورڈ" → /
- "diary", "ڈائری" → /diary
- "photos", "تصاویر" → /photos
- "settings", "ترتیبات" → /settings
- "help", "guide" → /guide

NAVIGATION SPELLING VARIANTS:
- banao / banaao / banao / banwao / banano (create)
- lagao / lagana / laga do (mark)
- kholo / khol / kholna (open)
- dikhao / dikha / dikh (show)

PAGES (use these EXACT paths):
/ = Dashboard, /projects, /labour, /mason, /attendance, /mason-attendance, /mason-payments, /weekly-payment, /materials,
/equipment, /expenses, /payments, /diary, /photos, /reports, /settings, /guide

ACTIONS YOU CAN DO:
1. navigate — go to a page
2. create_project — ADD a new project (name, ownerName, location, amount)
3. create_labour — ADD a new worker (labourName, wage)
4. assign_labour — assign worker to project (labourName, projectName, wage)
5. create_mason — ADD a new mason (masonName, wage)
6. assign_mason — assign mason to project (masonName, projectName, wage)
7. add_material — ADD material purchase (projectName, material, quantity, unit, rate, supplier)
8. add_expense — ADD expense (projectName, amount, category, description, paidTo)
9. add_equipment — ADD equipment (projectName, equipment, dailyRate, operator)
10. mark_attendance — record attendance (projectName, labourName, status, overtimeHours)
11. mark_all_attendance — mark all workers (projectName, status)
12. add_diary — ADD diary note (projectName, summary, weather)
13. add_payment — ADD owner payment (projectName, amount, method)
14. add_weekly_payment — generate weekly payment (projectName)
15. fetch_report — open reports page (projectName)

EXTRACT FORM DATA:
- Project name: naam, name, project ka naam, نام
- Owner name: maalik, owner, مالک
- Location: jagah, location, جگہ, city
- Amount: raqam, amount, paisay, رقم, lakh (5 lakh = 500000), crore (1 crore = 10000000)
- Labour name: mzadoor, worker naam, banda, مزدور
- Mason name: mason, mistrii, راج میسٹر, مستری
- Daily wage: ujrat, wage, salary, اجرت
- Material: material name (cement, sand, steel), quantity, unit (bags/tons/kg), rate, supplier
- Expense: kharch kis liye, category (Food, Transport, Tools, Fuel, Labour (Extra), Repair, Safety, Office, Utility, Other)
- Equipment: equipment name, dailyRate, operator
- Attendance: labourName, status (present/absent/half_day, default present), overtimeHours (number of hours, e.g. 2, 1.5)
- Payment: amount, method (bank/cash)

DATE RULES:
- Output ONLY relative date keywords: aaj=today, kal=yesterday, parso=two days ago, narso=day after tomorrow
- DO NOT output absolute YYYY-MM-DD dates
- If no date mentioned, omit date field → system defaults to today
- If unrecognized date pattern, omit date field

CONFIDENCE RULES:
- "high" = unambiguous and clearly stated
- "medium" = resolved via fuzzy/partial match, add "assumed" field
- "low" = cannot tell which entity → return "clarify" with candidates

NEVER:
- Ask "shall I?" — run actions directly
- Invent amounts, dates, or IDs not stated
- Both silently-guess AND silently-fail

RETURN FORMAT — JSON array:
[
  {
    "type": "navigate",
    "page": "/attendance",
    "response": "حاضری کا صفحہ کھل رہا ہے"
  }
]

For conversation:
[
  {
    "type": "respond",
    "response": "میرا نام Marenii ہے۔",
    "confidence": "high"
  }
]

One action per command, in order. Only fill fields actually mentioned.
Response must be SHORT — one sentence. NEVER list values back.
`;

export const VOICE_SYSTEM_PROMPT = `${ACTION_SYSTEM_PROMPT}

VOICE / SPEECH-TO-TEXT RULES:
1. STT errors common — treat minor transcription noise like typos
2. Single utterance may contain MULTIPLE commands — return ALL as separate objects in ONE array, in order
3. Homophone errors common — if close phonetic match exists in provided list, treat as medium confidence (not low)
4. All other rules apply: confidence on every action, clarify instead of guessing, never invent numbers
5. DATES: output ONLY relative keywords (aaj, kal, parso, narso). DO NOT output YYYY-MM-DD.
6. Check conversation patterns FIRST (greeting, name, help, etc.) before any command
7. If input is empty or just "hmm"/"ah" — return { "type": "respond", "response": "معذرت، کچھ نہیں سنا۔ دوبارہ کوشش کریں۔", "confidence": "high" }
8. If nothing matches — return { "type": "respond", "response": "معاف کریں، سمجھ نہیں آیا۔ کیا آپ مدد چاہیں؟", "confidence": "high" }
`;

