import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Mic, Check, X, Volume2, XCircle, Loader2 } from "lucide-react";
import Groq from "groq-sdk";
import { fetchApi } from "@/lib/api";
import {
  buildEntityContext,
  executeActions as runActions,
  formatActionResults,
  looksLikeCommand,
  normalizeText,
  parseActionsLocal,
  resolveClarifiedActions,
  resolveDate,
  resolveYesNo,
  todayStr,
  type ActionResult,
  type ClarifyRequest,
  type ExecuteState,
  type MareniiAction,
} from "@/lib/actions";

const groq = new Groq({
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
  dangerouslyAllowBrowser: true,
});

type SpeechState =
  | "idle"
  | "greeting"
  | "listening"
  | "thinking"
  | "success"
  | "error"
  | "unsupported";

const ASSISTANT_NAME = "Marenii";

const MARENII_SYSTEM_PROMPT = `
You are Marenii — a smart, warm, and helpful voice 
assistant for "Hisab Kitab", a construction site 
management app for Pakistani contractors (Thekadaars).

YOUR IDENTITY:
- Your name is Marenii
- You are a female assistant
- You speak in the same language the user used:
  Urdu input → Urdu response
  English input → English response
  Mixed input → Mixed response
- You are brief, warm, and never robotic
- You never say "karoo" or repeat user's words back

YOU UNDERSTAND ALL THREE LANGUAGES EQUALLY:
- Pure Urdu: حاضری لگاؤ
- Pure English: open attendance
- Romanized Urdu: attendance lagao, project kholo
- Mixed: mujhe attendance chahiye bhai

CASE INSENSITIVE MATCHING:
Always treat input as lowercase before matching.
"PROJECT" = "project" = "Project" = "پروجیکٹ"
"LABOUR" = "labour" = "مزدور" = "mazdoor"

PATTERN MATCHING — understand ALL variations:
Navigate: dikhao, kholo, open, jao, le jao, دیکھاؤ
Add/Create: add, karoo, banana, shamil karo, شامل کرو
Attendance: hazri, حاضری, attendance, hazari, lagao
Projects: project, منصوبے, site, kaam, jagah
Labour: mazdoor, مزدور, worker, banda, log, kaam karne wala
Payment: tankhwa, تنخواہ, payment, ادائیگی, paisa do
Expense: kharcha, خرچہ, اخراجات, kharchay, lagao

CONVERSATION PATTERNS — respond naturally:

GREETINGS (hello, salam, assalam o alaikum, hi, hey,
  السلام علیکم, آداب, good morning, subah bakhair):
Response: "وعلیکم السلام! میں Marenii ہوں — بتائیں کیا کریں؟"

IDENTITY (tumhara naam, what is your name, aap kaun ho,
  تمہارا نام کیا ہے, آپ کون ہیں):
Response: "میرا نام Marenii ہے۔ میں Hisab Kitab کی 
آواز ہوں — آپ کی مدد کے لیے حاضر ہوں۔"

HOW ARE YOU (kya haal hai, kaisa hoon, how are you,
  theek ho, کیا حال ہے, کیسے ہو):
Response: "الحمدللہ بالکل ٹھیک! آپ بتائیں کیا کام کروں؟"

THANKS (shukriya, thank you, thanks, شکریہ, jazakallah):
Response: "بہت شکریہ! کوئی اور کام ہو تو بتائیں۔"

GOODBYE (khuda hafiz, bye, Allah hafiz, خدا حافظ):
Response: "اللہ حافظ! کام اچھا گزرے۔"

APP EXPLANATION (ye app kya hai, hisab kitab kya hai,
  explain karo, kya karta hai):
Response: "Hisab Kitab آپ کے تعمیراتی کاروبار کا 
مکمل نظام ہے۔ حاضری، تنخواہ، اخراجات، پروجیکٹ 
اور رپورٹ — سب کچھ یہاں۔ کیا کریں؟"

HELP (madad karo, help chahiye, kya kar sakti ho,
  what can you do, مدد کرو):
Response: "میں یہ کام کر سکتی ہوں:
حاضری لگانا، تنخواہ حساب کرنا،
نیا پروجیکٹ بنانا، مزدور شامل کرنا،
اخراجات نوٹ کرنا، رپورٹ دیکھنا۔
بس بول دیں!"

UNCLEAR (anything not understood):
Response: "معاف کریں، سمجھ نہیں آیا۔ 
دوبارہ بولیں یا کہیں 'مدد کرو'"

AVAILABLE PAGES:
/ = Dashboard
/projects = Projects
/labour = Labour
/attendance = Attendance
/weekly-payment = Weekly Payments
/materials = Materials
/equipment = Equipment
/expenses = Expenses
/owner-payments = Owner Payments
/daily-diary = Daily Diary
/photos = Photos
/reports = Reports
/settings = Settings

RETURN FORMAT — IMPORTANT FOR LLAMA 3:
You MUST return a valid JSON object with an 
"actions" array inside. Like this:

{
  "actions": [
    {
      "action": "navigate",
      "page": "/attendance",
      "data": {},
      "response": "حاضری کا صفحہ کھل رہا ہے",
      "speak": true
    }
  ]
}

For conversation responses use action "respond":
{
  "actions": [
    {
      "action": "respond",
      "page": "",
      "data": {},
      "response": "وعلیکم السلام! میں Marenii ہوں",
      "speak": true
    }
  ]
}

For multiple commands return multiple actions:
{
  "actions": [
    { "action": "create_project", ... },
    { "action": "create_labour", ... },
    { "action": "add_expense", ... }
  ]
}

AVAILABLE ACTIONS:
navigate, create_project, create_labour, assign_labour,
add_advance, add_expense, mark_attendance, add_material,
respond, greet, explain_app, smalltalk
`;

const GREETING_TEXT = "میرا نام Marenii ہے۔ بتاؤ میں آپ کی کیا مدد کر سکتی ہوں؟";
const GREETING_DISPLAY = "میرا نام Marenii ہے — بتاؤ میں آپ کی کیا مدد کر سکتی ہوں؟";
const NOT_UNDERSTOOD_TEXT = "معاف کریں، سمجھ نہیں آیا۔ دوبارہ کہیں؟";
const HELP_TEXT =
  "یہ کمانڈ نہیں سمجھی۔ مثال: نیا پروجیکٹ بناؤ، حاضری لگاؤ، خرچہ لکھو، یا کوئی صفحہ کھولو۔";
const CANCEL_TEXT = "ٹھیک ہے، میں نے کچھ نہیں کیا";
const BADGE_TEXT = "Hi, I am Marenii — Need Any Help? 🎤";
const SUPPORT_MESSAGE = "اس براؤزر میں آواز کی سہولت نہیں۔ Chrome استعمال کریں یا لکھ کر بتائیں۔";

// Follow-up prompt after successful completion (same pattern as greeting)
const FOLLOWUP_TEXT = "کیا کسی اور چیز میں مدد چاہیے؟";

// Specific error messages so the user knows WHAT went wrong (not just generic).
const ERROR_RECOGNITION_FAILED = "آواز سمجھ نہیں آئی۔ دوبارہ کہیں یا لکھ کر بتائیں۔";
const ERROR_NO_INPUT = "کچھ سنایا نہیں گیا۔ دوبارہ بولیں۔";
const ERROR_NETWORK = "انٹرنیٹ کنکشن میں مسئلہ ہے، دوبارہ کوشش کریں۔";
const ERROR_GROQ = "معاف کریں، سمجھ نہیں آیا۔ دوبارہ کہیں۔";

/** Did ur-PK recognizer emit only ASCII (i.e. it heard English speech routed through the Urdu model)? */
const isLikelyEnglishMisroute = (text: string) => /^[A-Za-z0-9\s.,!?'"()-]+$/.test(text.trim());

const sendToGroq = async (userText: string) => {
  const started = Date.now();
  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: MARENII_SYSTEM_PROMPT },
        { role: "user", content: userText },
      ],
      temperature: 0.1,
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    const responseText = completion.choices[0]?.message?.content || "[]";
    const responseTime = Date.now() - started;
    console.log(`Marenii response time: ${responseTime}ms`);

    let actions: any[];
    try {
      const parsed = JSON.parse(responseText);

      // Handle all possible response shapes for Llama 3:
      if (Array.isArray(parsed)) {
        // Plain array: [{ action, response, ... }]
        actions = parsed;
      } else if (parsed.actions && Array.isArray(parsed.actions)) {
        // Object with actions key: { actions: [...] }
        actions = parsed.actions;
      } else if (parsed.action) {
        // Single action object: { action, response, ... }
        actions = [parsed];
      } else {
        // Unknown shape — create a respond action
        actions = [{
          action: "respond",
          response: parsed.response || "معاف کریں، کچھ مسئلہ ہوا",
          speak: true,
        }];
      }
    } catch (parseError) {
      // JSON parse failed completely
      console.error("JSON parse failed:", parseError);
      actions = [{
        action: "respond",
        response: "معاف کریں، جواب سمجھ نہیں آیا",
        speak: true,
      }];
    }

    // Normalize: map "action" → "type" for compatibility with executeActions engine
    const normalized = actions.map((a) => {
      if (a.action && !a.type) {
        return { ...a, type: a.action };
      }
      return a;
    });

    return normalized;
  } catch (error: any) {
    console.error("[Marenii] Groq error:", error);
    throw error;
  }
};

// How long Marenii keeps listening in silence before assuming you finished
const SILENCE_MS = 15000; // command capture — long window so you can think
const CONFIRM_SILENCE_MS = 15000; // clarify reply

const STATUS_TEXT: Record<SpeechState, string> = {
  idle: "",
  greeting: GREETING_DISPLAY,
  listening: "سن رہی ہوں...",
  thinking: "سوچ رہی ہوں...",
  success: "",
  error: NOT_UNDERSTOOD_TEXT,
  unsupported: "",
};

// Cross-turn session memory: resolves pronouns ("usme", "usko", "isme"…)
// to the last project/worker within a 5-minute window.
const SESSION_TTL_MS = 5 * 60 * 1000;
const PRONOUN_WORDS = ["usme", "usko", "wahi", "isme", "ismein"];

const BADGE_IDLE_MS = 5 * 60 * 1000;

interface SessionContext {
  lastProjectId: number | null;
  lastLabourId: number | null;
  lastProjectName?: string;
  lastLabourName?: string;
  expiresAt: number;
}

export default function VoiceAssistant() {
  const [, navigate] = useLocation();
  const [state, setState] = useState<SpeechState>("idle");
  const [liveText, setLiveText] = useState("");
  const [statusText, setStatusText] = useState("");
  const [showBadge, setShowBadge] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [guideOpen, setGuideOpen] = useState(false);

  const urRef = useRef<any>(null);
  const enRef = useRef<any>(null);
  const finalTextRef = useRef("");
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastInteractionRef = useRef(Date.now());
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const pendingClarifyRef = useRef<ClarifyRequest | null>(null);
  const sessionContextRef = useRef<SessionContext | null>(null);

  // Load TTS voices (they load asynchronously in Chrome)
  useEffect(() => {
    const load = () => {
      voicesRef.current = window.speechSynthesis?.getVoices() ?? [];
    };
    load();
    window.speechSynthesis?.addEventListener?.("voiceschanged", load);
    return () => window.speechSynthesis?.removeEventListener?.("voiceschanged", load);
  }, []);

  // Surface unsupported browsers instead of silently vanishing.
  useEffect(() => {
    const SR = getSpeechRecognition();
    if (!SR) {
      setVoiceSupported(false);
      setState("unsupported");
    }
  }, []);

  // Sticky greeting badge: shows 2s after load, hides after 8s, only reappears after 5 min idle
  useEffect(() => {
    const showTimer = setTimeout(() => {
      if (Date.now() - lastInteractionRef.current > BADGE_IDLE_MS) setShowBadge(true);
    }, 2000);
    const hideTimer = setTimeout(() => setShowBadge(false), 10000);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  useEffect(() => {
    const onGuideOpen = (e: Event) => setGuideOpen((e as CustomEvent<boolean>).detail);
    window.addEventListener("hisab-kitab:guide-open", onGuideOpen);
    return () => window.removeEventListener("hisab-kitab:guide-open", onGuideOpen);
  }, []);

  const getSpeechRecognition = () =>
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  const setStateAfter = (s: SpeechState, ms: number) => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setState(s), ms);
  };

  // Robust Urdu TTS — returns a promise so we can chain (greet → listen).
  // If the browser's voices have loaded but none is Urdu, fall back to
  // text-only (the status bubble) instead of mangling Urdu in an English voice.
  const speakMarenii = (text: string): Promise<void> =>
    new Promise((resolve) => {
      try {
        const synth = window.speechSynthesis;
        if (!synth || !text) {
          resolve();
          return;
        }
        const voices = voicesRef.current;
        const urdu = voices.find((v) => (v.lang || "").toLowerCase().startsWith("ur"));
        synth.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.voice = urdu || voices[0] || null;
        u.lang = urdu?.lang || "ur-PK";
        u.rate = 0.9;
        u.pitch = 1.0;
        u.onend = () => resolve();
        u.onerror = () => resolve();
        synth.speak(u);
        // Safety net: never block the flow if TTS is silent or broken
        setTimeout(resolve, 1500 + Math.min(text.length * 80, 8000));
      } catch {
        resolve();
      }
    });

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const stopRecognition = () => {
    clearSilenceTimer();
    try {
      urRef.current?.stop();
    } catch {
      /* ignore */
    }
    try {
      enRef.current?.stop();
    } catch {
      /* ignore */
    }
  };

  type ErrKind = "recognition" | "no_input" | "network" | "gemini" | "unsupported";
  const speakError = (kind: ErrKind = "recognition") => {
    const msg =
      kind === "no_input" ? ERROR_NO_INPUT
      : kind === "network" ? ERROR_NETWORK
      : kind === "gemini" ? ERROR_GROQ
      : kind === "unsupported" ? SUPPORT_MESSAGE
      : ERROR_RECOGNITION_FAILED;
    speakMarenii(msg).then(() => {});
    setState("error");
    setStatusText(msg);
    setStateAfter("idle", 4000);
  };

  // English fallback — used when ur-PK gets nothing or errors
  const fallbackToEnglish = (onText: (text: string) => void, quickFinal: boolean) => {
    const SR = getSpeechRecognition();
    if (!SR) {
      speakError("unsupported");
      return;
    }
    try {
      const recEN = new SR();
      recEN.lang = "en-US";
      recEN.continuous = false;
      recEN.interimResults = quickFinal ? false : true;

      recEN.onresult = (event: any) => {
        clearTimeout(silenceTimerRef.current ?? undefined);
        const interim = Array.from(event.results)
          .map((r: any) => r[0].transcript)
          .join("");
        const finals = Array.from(event.results)
          .filter((r: any) => r.isFinal)
          .map((r: any) => r[0].transcript)
          .join("");
        if (interim || finals) setLiveText((interim || finals).trim());
        if (finals) finalTextRef.current = finals.trim();
        if (quickFinal && finals) {
          try { recEN.stop(); } catch { /* ignore */ }
        } else {
          silenceTimerRef.current = setTimeout(() => {
            try { recEN.stop(); } catch { /* ignore */ }
          }, quickFinal ? CONFIRM_SILENCE_MS : SILENCE_MS);
        }
      };

      recEN.onerror = () => speakError("recognition");

      recEN.onend = () => {
        clearSilenceTimer();
        const finalText = finalTextRef.current.trim();
        if (finalText.length > 0) {
          onText(finalText);
        } else {
          speakError("no_input");
        }
      };

      enRef.current = recEN;
      recEN.start();
    } catch {
      speakError("network");
    }
  };

  // Generic single-turn listener. ur-PK first (45s think window), en-US fallback.
  const listenOnce = (onText: (text: string) => void, opts?: { quickFinal?: boolean; prompt?: string }) => {
    const quickFinal = !!opts?.quickFinal;
    const SR = getSpeechRecognition();
    if (!SR) {
      setState("unsupported");
      return;
    }
    setState("listening");
    setStatusText(opts?.prompt || STATUS_TEXT.listening);
    setLiveText("");
    finalTextRef.current = "";
    clearSilenceTimer();

    const recUR = new SR();
    recUR.lang = "ur-PK";
    recUR.continuous = true; // keep listening while the user thinks
    recUR.interimResults = true;

    recUR.onresult = (event: any) => {
      clearTimeout(silenceTimerRef.current ?? undefined);
      const interim = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join("");
      const finals = Array.from(event.results)
        .filter((r: any) => r.isFinal)
        .map((r: any) => r[0].transcript)
        .join("");
      if (interim || finals) setLiveText((interim || finals).trim());
      if (finals) finalTextRef.current = finals.trim();
      if (quickFinal && finals) {
        try { recUR.stop(); } catch { /* ignore */ }
      } else {
        silenceTimerRef.current = setTimeout(() => {
          try { recUR.stop(); } catch { /* ignore */ }
        }, quickFinal ? CONFIRM_SILENCE_MS : SILENCE_MS);
      }
    };

    recUR.onerror = (event: any) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setState("error");
        setStatusText("مائیکروفون تک رسائی نہیں ہے");
        setStateAfter("idle", 3000);
      } else {
        fallbackToEnglish(onText, quickFinal);
      }
    };

    recUR.onend = () => {
      clearSilenceTimer();
      const finalText = finalTextRef.current.trim();
      if (finalText.length > 0) {
        // Smart retry: if ur-PK emitted clean ASCII that the local Roman-UR
        // parser can't turn into actions, the user was probably speaking
        // English into the Urdu model. Route it through English recognition
        // instead of failing. Roman-UR commands ("naya project banao") parse
        // fine so they won't hit this branch.
        const parsed = parseActionsLocal(finalText);
        if (parsed) {
          onText(finalText);
        } else if (isLikelyEnglishMisroute(finalText)) {
          console.log("[Marenii] ASCII output not parseable, retrying en-US:", finalText);
          fallbackToEnglish(onText, quickFinal);
        } else {
          onText(finalText);
        }
      } else {
        fallbackToEnglish(onText, quickFinal);
      }
    };

    urRef.current = recUR;
    try {
      recUR.start();
    } catch {
      speakError("network");
    }
  };

  // Greeting on click: speak intro, then auto-listen when speech ends
  const startGreeting = async () => {
    setState("greeting");
    setStatusText(GREETING_DISPLAY);
    await speakMarenii(GREETING_TEXT);
    listenOnce((text) => void handleVoiceCommand(text));
  };

  const handleMicClick = () => {
    if (state === "unsupported" || !voiceSupported) return;
    lastInteractionRef.current = Date.now();
    setShowBadge(false);
    if (state === "listening" || state === "greeting") {
      stopRecognition();
      setState("idle");
      setLiveText("");
    } else {
      startGreeting();
    }
  };

  // ─── Session memory across turns ───

  const rememberState = (s: ExecuteState) => {
    sessionContextRef.current = {
      lastProjectId: s.lastProjectId ?? null,
      lastLabourId: s.lastLabourId ?? null,
      lastProjectName: s.lastProjectName,
      lastLabourName: s.lastLabourName,
      expiresAt: Date.now() + SESSION_TTL_MS,
    };
  };

  // If the utterance uses a pronoun ("usme", "isme", …) and the session
  // window is still fresh, fill the missing project/worker from memory.
  const applySessionContext = (actions: MareniiAction[], raw: string): MareniiAction[] => {
    const ctx = sessionContextRef.current;
    if (!ctx || Date.now() > ctx.expiresAt) return actions;
    if (!PRONOUN_WORDS.some((p) => raw.toLowerCase().includes(p))) return actions;
    return actions.map((a) => {
      const n = { ...a } as MareniiAction & { projectName?: string; labourName?: string };
      if (!n.projectName && ctx.lastProjectName) n.projectName = ctx.lastProjectName;
      if (!n.labourName && ctx.lastLabourName) n.labourName = ctx.lastLabourName;
      return n;
    });
  };

  // ─── Execution (shared engine in @/lib/actions) ───
  //
  // No "shall I start" gate: confident actions execute immediately and the
  // spoken confirmation afterwards is the feedback loop. The only spoken
  // question left is a genuine clarify need (unresolvable project/worker).
  const executeActions = async (actions: MareniiAction[], initialState?: ExecuteState) => {
    console.log("[Marenii] executeActions:", JSON.stringify(actions));
    const confirmations = await runActions(actions, {
      navigate,
      onClarify: (req) => {
        pendingClarifyRef.current = req;
        rememberState(req.state);
      },
      onState: rememberState,
      initialState,
    });
    const say = confirmations.length ? formatActionResults(confirmations) : NOT_UNDERSTOOD_TEXT;
    await speakMarenii(say);
    setStatusText(say);
    if (pendingClarifyRef.current) {
      await askClarify(pendingClarifyRef.current);
    } else {
      setState("success");
      await speakMarenii(FOLLOWUP_TEXT);
      setStatusText(FOLLOWUP_TEXT);
      setStateAfter("idle", 3000);
    }
  };

  // A project/worker couldn't be resolved → ask with candidates, then resume
  // the halted action batch once the user answers.
  const askClarify = async (req: ClarifyRequest) => {
    const prompt = req.candidates.length
      ? `${req.question} — ${req.candidates.map((c, i) => `${i + 1}. ${c}`).join("، ")}`
      : req.question;
    await speakMarenii(prompt);
    setStatusText(prompt);
    listenOnce(async (text) => {
      if (req.candidates.length === 0) {
        const yn = resolveYesNo(text);
        if (yn === "no") {
          pendingClarifyRef.current = null;
          await speakMarenii(CANCEL_TEXT);
          setState("success");
          setStatusText(CANCEL_TEXT);
          setStateAfter("idle", 3000);
          return;
        }
        const actions = req.actions.map((x) => ({ ...x }));
        actions[0] = { ...actions[0], [req.field]: text.trim() } as MareniiAction;
        pendingClarifyRef.current = null;
        await executeActions(actions, req.state);
        return;
      }
      const resolved = resolveClarifiedActions(req, text);
      if (resolved) {
        pendingClarifyRef.current = null;
        await executeActions(resolved.actions, req.state);
      } else {
        await askClarify(req);
      }
    });
  };

  // Gemini asked a clarifying question → speak it with candidates, then
  // re-parse the original command with the user's answer appended.
  const handleClarify = async (original: string, clar: Extract<MareniiAction, { type: "clarify" }>) => {
    const question = clar.question || "کچھ اور بتائیں؟";
    const cands: string[] = clar.candidates || [];
    const prompt = cands.length
      ? `${question} — ${cands.map((c, i) => `${i + 1}. ${c}`).join("، ")}`
      : question;
    await speakMarenii(prompt);
    setStatusText(prompt);
    listenOnce((text) => {
      void handleVoiceCommand(`${original} (${text})`);
    });
  };

  // ─── Main voice command pipeline ───
  // Local parser first (works offline / quota-exhausted), then Groq+Llama 3
  // (key is sent to the browser via env var — same as the original design intended).
  const handleVoiceCommand = async (userText: string) => {
    const transcript = normalizeText(userText).trim();
    console.log("[Marenii] transcript:", transcript);

    const local = parseActionsLocal(transcript);
    if (local?.complete) {
      await executeActions(applySessionContext(local.actions, transcript));
      return;
    }

    if (!looksLikeCommand(transcript)) {
      await speakMarenii(HELP_TEXT);
      setState("success");
      setStatusText(HELP_TEXT);
      setStateAfter("idle", 4000);
      return;
    }

    setState("thinking");
    setStatusText(STATUS_TEXT.thinking);
    setLiveText(transcript);

    try {
      const [projData, labData] = await Promise.all([
        fetchApi("/projects?limit=100").catch(() => null),
        fetchApi("/labour?limit=100").catch(() => null),
      ]);
      const projs = Array.isArray(projData?.data) ? projData.data.map((p: any) => ({ name: String(p.name ?? "") })) : [];
      const labs = Array.isArray(labData?.data) ? labData.data.map((l: any) => ({ name: String(l.name ?? "") })) : [];
      const entityContext = buildEntityContext(projs, labs);

      const dateCtx = resolveDate(transcript);
      const today = todayStr();
      const dateHint = dateCtx?.date
        ? `\n\n[Date context: today's date is ${today}. The user's date word resolves to ${dateCtx.date}${dateCtx?.assumed ? ` (${dateCtx.assumed})` : ""}. Use the resolved date as YYYY-MM-DD in any action.date; do not recompute it. If no date word was used, action.date = ${today}.]`
        : `\n\n[Date context: today's date is ${today}. If the user did not state a date, action.date = ${today} as YYYY-MM-DD.]`;

      const prompt = `${MARENII_SYSTEM_PROMPT}\n\n${entityContext}${dateHint}\n\nUser said: "${transcript}"`;

      const startTime = Date.now();
      let actions: MareniiAction[] = await sendToGroq(prompt);
      const responseTime = Date.now() - startTime;
      console.log(`[Marenii] Full handleVoiceCommand time: ${responseTime}ms`);

      console.log("[Marenii] Parsed actions:", JSON.stringify(actions));

      if (actions.length === 0) {
        await speakMarenii(NOT_UNDERSTOOD_TEXT);
        setState("success");
        setStatusText(NOT_UNDERSTOOD_TEXT);
        setStateAfter("idle", 3000);
        return;
      }

      const clarify = actions.find((a): a is Extract<MareniiAction, { type: "clarify" }> => a.type === "clarify");
      if (clarify) {
        await handleClarify(transcript, clarify);
        return;
      }

      await executeActions(applySessionContext(actions, transcript));
    } catch (err: any) {
      console.error("[Marenii] Model error:", err);
      await speakMarenii(
        err?.message?.includes("429")
          ? "Groq کی کوٹا لگ گئی ہے، ذرا دوبارہ کوشش کریں"
          : NOT_UNDERSTOOD_TEXT
      );
      setState("error");
      setStatusText(err?.message?.includes("429") ? "Rate limited" : NOT_UNDERSTOOD_TEXT);
      setStateAfter("idle", 4000);
    }
  };

  const success = state === "success";
  const error = state === "error";
  const unsupported = state === "unsupported" || !voiceSupported;

  return (
    <>
      {/* CSS */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes voice-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.6); }
          50% { box-shadow: 0 0 0 14px rgba(249, 115, 22, 0); }
        }
        @keyframes mic-idle-glow {
          0%, 100% {
            transform: scale(1.0);
            box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.3), 0 0 0 10px rgba(251, 191, 36, 0.15);
          }
          50% {
            transform: scale(1.06);
            box-shadow: 0 0 0 10px rgba(249, 115, 22, 0.1), 0 0 0 20px rgba(251, 191, 36, 0.05);
          }
        }
        @keyframes marenii-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes marenii-fade {
          0%, 70% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes badge-in {
          from { opacity: 0; transform: translateY(12px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .mic-listening { animation: voice-pulse 1.8s infinite; }
        .mic-idle-glow { animation: mic-idle-glow 2.5s infinite ease-in-out; }
      `}} />

      {/* Floating Action Button Container */}
      {!guideOpen && (
        <div className="fixed bottom-[197px] right-6 rtl:right-auto rtl:left-6 z-50 flex flex-col items-end rtl:items-start gap-2">
        {/* Always-visible label when idle */}
        {state === "idle" && !showBadge && !unsupported && (
          <div
            className="flex items-center gap-1.5 bg-white border border-[#F59E0B] text-orange-700 text-xs font-semibold rounded-full px-3 py-1 shadow-md animate-[marenii-in_0.25s_ease-out]"
            style={{ zIndex: 49 }}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span className="whitespace-nowrap">Voice Assistant</span>
          </div>
        )}
        {/* Sticky greeting badge */}
        {showBadge && !unsupported && (
          <button
            onClick={handleMicClick}
            className="flex items-center gap-2 bg-white border border-[#F59E0B] text-slate-800 text-xs font-medium rounded-[20px] px-3.5 py-2 shadow-md animate-[badge-in_0.4s_ease-out]"
            style={{ zIndex: 49 }}
          >
            <div className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
              M
            </div>
            <span className="whitespace-nowrap">{BADGE_TEXT}</span>
          </button>
        )}

        {/* Live text + status bubble */}
        {state !== "idle" && (
          <div
            className={`max-w-64 backdrop-blur text-white px-3 py-2.5 rounded-xl shadow-2xl border text-right rtl animate-[marenii-in_0.25s_ease-out] ${
              success
                ? "bg-green-600 border-green-400 animate-[marenii-fade_3s_ease_forwards]"
                : error
                ? "bg-red-600 border-red-400 animate-[marenii-fade_4s_ease_forwards]"
                : "bg-slate-900/95 dark:bg-slate-800/95 border-white/10"
            }`}
          >
            {liveText && (
              <div className="text-xs font-medium text-orange-300 mb-1 break-words">{liveText}</div>
            )}
            <div className="flex items-center justify-end gap-1.5 text-[11px]">
              {(state === "listening" || state === "greeting") && (
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse flex-shrink-0" />
              )}
              {state === "thinking" && <Loader2 className="w-3 h-3 text-orange-400 animate-spin flex-shrink-0" />}
              {state === "success" && <Check className="w-3 h-3 flex-shrink-0" />}
              {state === "error" && <X className="w-3 h-3 flex-shrink-0" />}
              {unsupported && <XCircle className="w-3 h-3 flex-shrink-0" />}
              <span className="text-slate-100">{unsupported ? SUPPORT_MESSAGE : statusText}</span>
            </div>
          </div>
        )}

        {/* Floating Mic Button */}
        <button
          onClick={handleMicClick}
          disabled={unsupported}
          data-testid="voice-assistant-btn"
          title={unsupported ? SUPPORT_MESSAGE : undefined}
          className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ease-in-out transform active:scale-95 hover:scale-110 hover:rotate-6 hover:shadow-2xl hover:animate-none ${
            unsupported
              ? "bg-slate-300 text-slate-500 cursor-not-allowed"
              : state === "listening" || state === "greeting"
              ? "bg-orange-600 text-white mic-listening scale-110 rotate-0"
              : state === "thinking"
              ? "bg-orange-600 text-white"
              : success
              ? "bg-green-600 text-white"
              : error
              ? "bg-red-600 text-white"
              : "bg-orange-500 text-white mic-idle-glow"
          }`}
        >
          {unsupported ? (
            <XCircle className="w-6 h-6" />
          ) : state === "listening" || state === "greeting" ? (
            <Volume2 className="w-6 h-6 animate-pulse" />
          ) : state === "thinking" ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : success ? (
            <Check className="w-6 h-6" />
          ) : error ? (
            <X className="w-6 h-6" />
          ) : (
            <Mic className="w-6 h-6" />
          )}
        </button>
        </div>
      )}
    </>
  );
}
