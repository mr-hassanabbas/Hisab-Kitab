import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { fetchApi } from "@/lib/api";
import { callGeminiStream, callModelWithFallback, extractAnswerProgress } from "@/lib/gemini";
import { useToast } from "@/hooks/use-toast";
import { authorizeDrive, drivePush, isDriveConfigured } from "@/lib/drive-sync";
import { recordUsage, getTopUsage } from "@/lib/stats";
import { useLanguage } from "@/hooks/use-language";
import {
  GUIDE_GREETING,
  ONBOARDING_GREETING,
  buildGuideContext,
  buildGuideSystemPrompt,
  findCannedAnswer,
  getEffectiveKb,
  getProactiveSuggestions,
  isAllowedHref,
} from "@/lib/guide";
import type { GuideLink } from "@/lib/guide";
import {
  ACTION_SYSTEM_PROMPT,
  buildEntityContext,
  detectConversation,
  executeActions as runActions,
  formatActionResults,
  hasMutations,
  looksLikeCommand,
  parseActionsLocal,
  resolveClarifiedActions,
  type ActionResult,
  type ClarifyRequest,
  type MareniiAction,
} from "@/lib/actions";
import { Bot, Send, Sparkles, X, MessageCircle, History, Trash2, Plus, CloudUpload, Loader2, Download, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  links?: GuideLink[];
  candidates?: string[];
}

interface SavedChat {
  id: string;
  title: string;
  ts: number;
  messages: ChatMessage[];
}

interface GuideResponse {
  answer: string;
  links?: GuideLink[];
}

const STORAGE_KEY = "hk_guide_chat";
const HISTORY_KEY = "hk_guide_chat_history";
const MAX_HISTORY = 12;
const MAX_SAVED = 10;

function loadHistory(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.slice(-MAX_HISTORY);
    return [];
  } catch {
    return [];
  }
}

function loadSavedChats(): SavedChat[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.slice(0, MAX_SAVED);
    return [];
  } catch {
    return [];
  }
}

function saveSavedChats(chats: SavedChat[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(chats.slice(0, MAX_SAVED)));
  } catch {
    /* ignore */
  }
}

function parseGemini(text: string): GuideResponse {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed.answer === "string") {
      if (Array.isArray(parsed.steps) && parsed.steps.length > 0) {
        const steps = parsed.steps
          .map((s: unknown, i: number) => `${i + 1}. ${String(s)}`)
          .join("\n");
        return { answer: parsed.answer + "\n\n" + steps, links: parsed.links };
      }
      return parsed;
    }
    if (typeof parsed.text === "string") return { answer: parsed.text, links: parsed.links };
  } catch {
    /* fall through to raw text */
  }
  return { answer: cleaned };
}

interface GuideChatProps {
  variant: "widget" | "page";
}

export default function GuideChat({ variant }: GuideChatProps) {
  const { t, lang } = useLanguage();
  const [location, navigate] = useLocation();
  const qc = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>(loadHistory);
  const [savedChats, setSavedChats] = useState<SavedChat[]>(loadSavedChats);
  const [showHistory, setShowHistory] = useState(false);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [open, setOpen] = useState(variant === "page");
  const scrollRef = useRef<HTMLDivElement>(null);
  const resetTimer = useRef<number | null>(null);
  const rtl = lang === "ur";

  // Pending clarification: the assistant asked "کون سا؟" and is waiting for
  // the user's next message to resolve it. "local" = an action batch was
  // halted mid-execution and can resume; "gemini" = we re-parse with the
  // answer appended to the original command.
  type PendingClarifyState =
    | { kind: "local"; req: ClarifyRequest }
    | { kind: "gemini"; original: string; question: string; candidates: string[] };
  const pendingClarifyRef = useRef<PendingClarifyState | null>(null);

  const { data: projectsData } = useQuery({
    queryKey: ["projects"],
    queryFn: () => fetchApi("/projects?limit=1000"),
    staleTime: 60_000,
  });
  const projects: { id: number; name: string }[] = (projectsData?.data ?? []).map((p: Record<string, unknown>) => ({
    id: Number(p.id),
    name: String(p.name),
  }));

  const { data: labourData } = useQuery({
    queryKey: ["labour"],
    queryFn: () => fetchApi("/labour?limit=1000"),
    staleTime: 60_000,
  });
  const labours: { id: number; name: string }[] = (labourData?.data ?? []).map((l: Record<string, unknown>) => ({
    id: Number(l.id),
    name: String(l.name),
  }));

  const { data: masonData } = useQuery({
    queryKey: ["mason"],
    queryFn: () => fetchApi("/mason?limit=1000"),
    staleTime: 60_000,
  });
  const maso: { name: string }[] = (masonData?.data ?? []).map((m: Record<string, unknown>) => ({
    name: String(m.name),
  }));

  const noProjects = projects.length === 0;
  const greeting = noProjects
    ? ONBOARDING_GREETING
    : `السلام علیکم! آپ کے ${projects.length} پروجیکٹ ہیں ${projects.length > 0 ? `(${projects[0].name}${projects.length > 1 ? "، وغیرہ" : ""})` : ""} — بتاؤ کس بارے میں مدد کروں؟ 🎯`;
  const startItems = getProactiveSuggestions({ projectCount: projects.length, labourCount: labours.length });

  useEffect(() => {
    if (messages.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_HISTORY)));
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  useEffect(() => {
    if (variant !== "widget") return;
    window.dispatchEvent(new CustomEvent("hisab-kitab:guide-open", { detail: open }));
  }, [open, variant]);

  useEffect(() => {
    if (messages.length === 0 && variant === "page") {
      setMessages([{ role: "assistant", text: noProjects ? ONBOARDING_GREETING : GUIDE_GREETING }]);
    }
  }, [variant, noProjects]);

  const knownProjectIds = projects.map((p) => p.id);

  const callModel = async (
    systemInstruction: string,
    contents: { role: string; parts: { text: string }[] }[],
    generationConfig: Record<string, unknown>
  ): Promise<string> => {
    return callModelWithFallback({ systemInstruction, contents, generationConfig });
  };

  const parseActions = async (userText: string): Promise<MareniiAction[] | null> => {
    const local = parseActionsLocal(userText);
    if (local?.complete) {
      console.log("[GuideChat] parsed locally:", local.actions);
      return local.actions;
    }
    try {
      const context = buildEntityContext(projects, labours, maso);
      const text = await callModel(ACTION_SYSTEM_PROMPT, [{ role: "user", parts: [{ text: `${context}\n\nصارف کا کہنا: "${userText}"` }] }], {
        responseMimeType: "application/json",
        temperature: 0.1,
      });
      const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
      let parsed: any;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        return null;
      }
      let actions: MareniiAction[] | null = null;
      if (Array.isArray(parsed)) actions = parsed;
      else if (Array.isArray(parsed?.actions)) actions = parsed.actions;
      else if (parsed?.type) actions = [parsed as MareniiAction];
      if (!actions || actions.length === 0) return null;
      const conversationTypes = ["respond", "greet", "answer", "explain_app", "smalltalk"];
      const isAllConversation = actions.every((a) => conversationTypes.includes(a.type));
      if (isAllConversation) {
        const text = actions.map((a) => a.response || "").join("۔ ");
        setMessages((m) => [...m, { role: "assistant", text }]);
        return null;
      }
      const meaningful = actions.filter((a) => !conversationTypes.includes(a.type));
      return meaningful.length > 0 ? meaningful : null;
    } catch {
      return null;
    }
  };

  // Called by executeActions when a project/labour can't be resolved — halts
  // the batch and asks the user to pick from candidates.
  const handleClarifyRequest = (req: ClarifyRequest) => {
    pendingClarifyRef.current = { kind: "local", req };
  };

  const getAttendanceGapSuggestion = async (projectId: number): Promise<string | null> => {
    try {
      const response = await fetchApi(`/attendance/today?project_id=${projectId}`);
      const data = response?.data ?? [];
      const missing = data.filter((l: any) => !l.today_status);
      if (missing.length === 0) return null;
      const names = missing.map((l: any) => l.name).join("، ");
      return `چاہیں تو باقی مزدوروں کی حاضری بھی لگا دوں؟ (${names})`;
    } catch {
      return null;
    }
  };

  const runCommand = async (userText: string) => {
    // Check conversation first (offline, no quota needed)
    const convAction = detectConversation(userText);
    if (convAction) {
      const text = convAction.response || "";
      setMessages((m) => [...m, { role: "assistant", text }]);
      return;
    }

    const actions = looksLikeCommand(userText) ? await parseActions(userText) : null;
    if (actions) {
      const clarify = actions.find((a) => a.type === "clarify");
      if (clarify) {
        const question = clarify.question || "کچھ اور بتائیں؟";
        pendingClarifyRef.current = { kind: "gemini", original: userText, question, candidates: clarify.candidates ?? [] };
        setMessages((m) => [...m, { role: "assistant", text: question, candidates: clarify.candidates ?? [] }]);
        return;
      }
      const results = await runActions(actions, {
        navigate: (href: string) => {
          navigate(href);
          if (variant === "widget") setOpen(false);
        },
        onClarify: handleClarifyRequest,
      });
      const pending = pendingClarifyRef.current;
      if (pending && pending.kind === "local") {
        const req = pending.req;
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            text: formatActionResults(results),
            candidates: req.candidates,
          },
        ]);
        return;
      }
      const summary = formatActionResults(results);
      const isCommand = hasMutations(actions);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: isCommand ? summary : results.filter((r: ActionResult) => r.success).map((r: ActionResult) => r.text).join("۔ "),
        },
      ]);
      const attendanceSuccess = actions.find((a) => a.type === "mark_attendance");
      if (attendanceSuccess && results.some((r) => r.success)) {
        const pid = projects.find((p) => p.name === attendanceSuccess.projectName)?.id;
        if (pid) {
          const gapSuggestion = await getAttendanceGapSuggestion(pid);
          if (gapSuggestion) {
            setMessages((m) => [
              ...m,
              {
                role: "assistant",
                text: gapSuggestion,
                candidates: [gapSuggestion],
              },
            ]);
          }
        }
      }
      qc.invalidateQueries();
      return;
    }

    try {
      await streamGuideAnswer(userText, [...messages, { role: "user", text: userText }]);
    } catch (err) {
      console.error("[GuideChat] streamGuideAnswer failed:", err);
      const fallback = findCannedAnswer(userText);
      setMessages((m) => [...m, { role: "assistant", text: fallback.answer, links: fallback.links }]);
    }
  };

  const sendQuery = async (text: string) => {
    const userText = text.trim();
    if (!userText || thinking) return;
    setInput("");
    recordUsage(userText);
    setMessages((m) => [...m, { role: "user", text: userText }]);
    setThinking(true);
    resetTimer.current = window.setTimeout(() => setThinking(false), 90000);
    try {
      const pending = pendingClarifyRef.current;
      if (pending) {
        pendingClarifyRef.current = null;
        if (pending.kind === "local") {
          const resolved = resolveClarifiedActions(pending.req, userText);
          if (resolved) {
            const results = await runActions(resolved.actions, {
              navigate: (href: string) => {
                navigate(href);
                if (variant === "widget") setOpen(false);
              },
              initialState: pending.req.state,
              onClarify: handleClarifyRequest,
            });
             const summary = formatActionResults(results);
             setMessages((m) => [...m, { role: "assistant", text: summary }]);
            qc.invalidateQueries();
          } else {
            setMessages((m) => [
              ...m,
              { role: "assistant", text: `معاف کریں، پہچان نہیں سکی۔ ${pending.req.question}`, candidates: pending.req.candidates },
            ]);
            pendingClarifyRef.current = pending;
          }
          return;
        }
        // gemini: re-run the parse with the user's answer appended to context
        await runCommand(`${pending.original} (${userText})`);
        return;
      }
      await runCommand(userText);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: findCannedAnswer(userText).answer }]);
    } finally {
      setThinking(false);
      if (resetTimer.current) {
        window.clearTimeout(resetTimer.current);
        resetTimer.current = null;
      }
    }
  };

  useEffect(() => {
    return () => {
      if (resetTimer.current) window.clearTimeout(resetTimer.current);
    };
  }, []);

  const streamGuideAnswer = async (userText: string, history: ChatMessage[]) => {
    const lastFew = history.slice(-3);
    const roles: Record<string, string> = { user: "user", assistant: "model" };
    const pagePath = location;
    const projectsList = projects.map((p) => ({ id: p.id, name: p.name }));
    const context = buildGuideContext(getEffectiveKb(), pagePath, projectsList);
    const question = context + '\n\nصارف کا سوال: "' + userText + '"';
    const contents = lastFew
      .map((m) => ({ role: roles[m.role], parts: [{ text: m.text }] }))
      .concat([{ role: "user", parts: [{ text: question }] }]);

    const req = {
      systemInstruction: buildGuideSystemPrompt(),
      contents,
      generationConfig: { responseMimeType: "application/json", temperature: 0.3 },
    };

    const placeholder: ChatMessage = { role: "assistant", text: "" };
    setMessages((m) => [...m, placeholder]);
    setThinking(false);

    try {
      const full = await callModelWithFallback(req);
      let res: GuideResponse = parseGemini(full);
      if (!res.answer || res.answer.trim() === "") {
        console.warn("[GuideChat] Model returned empty answer, using canned fallback");
        res = findCannedAnswer(userText);
      }
      res.links = (res.links ?? []).filter((l) => isAllowedHref(l.href, knownProjectIds));
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", text: res.answer, links: res.links };
        return copy;
      });
    } catch (err) {
      console.error("[GuideChat] callModelWithFallback failed, trying stream:", err);
      try {
        const full = await callGeminiStream(req, (acc) => {
          const partial = extractAnswerProgress(acc);
          if (partial) {
            setMessages((m) => {
              const copy = [...m];
              const last = copy[copy.length - 1];
              if (last && last.role === "assistant") copy[copy.length - 1] = { ...last, text: partial };
              return copy;
            });
          }
        });
        let res: GuideResponse = parseGemini(full);
        if (!res.answer || res.answer.trim() === "") {
          console.warn("[GuideChat] Gemini stream returned empty answer, using canned fallback");
          res = findCannedAnswer(userText);
        }
        res.links = (res.links ?? []).filter((l) => isAllowedHref(l.href, knownProjectIds));
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", text: res.answer, links: res.links };
          return copy;
        });
      } catch (streamErr) {
        console.error("[GuideChat] streamGuideAnswer error:", streamErr);
        const fallback = findCannedAnswer(userText);
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", text: fallback.answer, links: fallback.links };
          return copy;
        });
      }
    }
  };

  const goToLink = (href: string) => {
    navigate(href);
    if (variant === "widget") closeChat();
  };

  const closeChat = () => {
    setOpen(false);
    setMessages([]);
    setShowHistory(false);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  const saveCurrentChat = () => {
    const hasUserMsg = messages.some((m) => m.role === "user");
    if (!hasUserMsg) return;
    const firstUser = messages.find((m) => m.role === "user")?.text ?? "گفتگو";
    const chat: SavedChat = {
      id: String(Date.now()),
      title: firstUser.length > 50 ? firstUser.slice(0, 50) + "…" : firstUser,
      ts: Date.now(),
      messages: messages.slice(-MAX_HISTORY),
    };
    setSavedChats((prev) => {
      const next = [chat, ...prev.filter((c) => c.id !== chat.id)].slice(0, MAX_SAVED);
      saveSavedChats(next);
      return next;
    });
  };

  const openSavedChat = (chat: SavedChat) => {
    setMessages(chat.messages);
    setShowHistory(false);
    setOpen(true);
    setSavedChats((prev) => {
      const next = prev.filter((c) => c.id !== chat.id);
      saveSavedChats(next);
      return next;
    });
  };

  const deleteSavedChat = (id: string) => {
    setSavedChats((prev) => {
      const next = prev.filter((c) => c.id !== id);
      saveSavedChats(next);
      return next;
    });
  };

  const clearCurrentChat = () => {
    saveCurrentChat();
    setMessages([]);
    setShowHistory(false);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  const [driveSyncing, setDriveSyncing] = useState(false);
  const { toast } = useToast();

  const syncToDrive = async () => {
    if (driveSyncing) return;
    if (!isDriveConfigured()) {
      toast({
        title: t("drive_not_configured") || "Drive سیٹ اپ نہیں",
        description: t("drive_not_configured_sub") || ".env میں VITE_GOOGLE_CLIENT_ID لگائیں",
      });
      return;
    }
    setDriveSyncing(true);
    try {
      await authorizeDrive();
      const payload = JSON.stringify({
        savedChats,
        current: messages,
        updatedAt: Date.now(),
      });
      await drivePush(payload);
      toast({ title: t("drive_synced") || "Drive پر محفوظ ہو گیا ✓" });
    } catch (e) {
      toast({
        title: t("drive_sync_failed") || "Drive سنک ناکام",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setDriveSyncing(false);
    }
  };

  const exportChat = () => {
    if (messages.length === 0) return;
    const lines = messages
      .map((m) => `${m.role === "user" ? "سوال" : "جواب"}: ${m.text}${m.links?.length ? "\nلنکس: " + m.links.map((l) => `${l.label} (${l.href})`).join(", ") : ""}`)
      .join("\n\n");
    const blob = new Blob([lines], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hisab-kitab-chat-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const [showStats, setShowStats] = useState(false);
  const topUsage = getTopUsage(10);

  const renderText = (text: string) => {
    return text.split("\n").map((line, i) => (
      <p key={i} className={cn("whitespace-pre-wrap", i > 0 && "mt-1")}>{line}</p>
    ));
  };

  if (variant === "widget") {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes guide-pulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.55); }
            50% { box-shadow: 0 0 0 14px rgba(245, 158, 11, 0); }
          }
          @keyframes guide-idle-glow {
            0%, 100% {
              transform: scale(1.0);
              box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.3), 0 0 0 10px rgba(251, 191, 36, 0.18);
            }
            50% {
              transform: scale(1.06);
              box-shadow: 0 0 0 10px rgba(245, 158, 11, 0.12), 0 0 0 20px rgba(251, 191, 36, 0.06);
            }
          }
          @keyframes marenii-in {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .guide-pulse { animation: guide-pulse 1.8s infinite; }
          .guide-idle-glow { animation: guide-idle-glow 2.5s infinite ease-in-out; }
        `}} />
        <div className="fixed bottom-[88px] right-6 rtl:right-auto rtl:left-6 z-50 flex flex-col items-end rtl:items-start gap-2">
          {open && (
            <div className="w-[min(92vw,380px)] h-[480px] bg-card border border-border rounded-2xl shadow-xl flex flex-col overflow-hidden animate-[marenii-in_0.25s_ease-out]">
              <Header
                onClose={() => closeChat()}
                onHistory={() => setShowHistory((v) => !v)}
                onNewChat={clearCurrentChat}
                onDriveSync={syncToDrive}
                driveSyncing={driveSyncing}
                onExport={exportChat}
                onStats={() => setShowStats((v) => !v)}
              />
              {showHistory ? (
                <HistoryPanel chats={savedChats} rtl={rtl} onOpen={openSavedChat} onDelete={deleteSavedChat} />
              ) : showStats ? (
                <StatsPanel stats={getTopUsage(10)} rtl={rtl} />
              ) : (
                <Messages
                  scrollRef={scrollRef}
                  messages={messages}
                  thinking={thinking}
                  rtl={rtl}
                  greeting={greeting}
                  startItems={startItems}
                  onStart={(q) => sendQuery(q)}
                  onLink={goToLink}
                  onCandidate={(v) => sendQuery(v)}
                />
              )}
              <InputBox input={input} setInput={setInput} thinking={thinking} onSend={() => sendQuery(input)} />
            </div>
          )}
          {!open && (
            <div
              className="flex items-center gap-1.5 bg-white border border-amber-300 text-amber-800 text-xs font-semibold rounded-full px-3 py-1 shadow-md animate-[marenii-in_0.25s_ease-out]"
              style={{ zIndex: 49 }}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span className="whitespace-nowrap">Chat Assistant</span>
            </div>
          )}
          <button
            onClick={() => (open ? closeChat() : (setShowHistory(false), setOpen(true)))}
            data-testid="guide-assistant-btn"
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ease-in-out transform active:scale-95 hover:scale-110 hover:rotate-6 hover:shadow-2xl hover:animate-none ${
              open ? "bg-amber-500 text-white"
              : thinking ? "bg-amber-500 text-white guide-pulse"
              : "bg-amber-400 text-white guide-idle-glow"
            }`}
            aria-label={t("guide_title") || "Walkthrough"}
          >
            {thinking ? (
              <Sparkles className="w-6 h-6 animate-spin" />
            ) : open ? (
              <X className="w-6 h-6" />
            ) : (
              <MessageCircle className="w-6 h-6" />
            )}
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto flex flex-col gap-3 h-full min-h-0">
      <Header
        onHistory={() => setShowHistory((v) => !v)}
        onNewChat={clearCurrentChat}
        onDriveSync={syncToDrive}
        driveSyncing={driveSyncing}
        onExport={exportChat}
        onStats={() => setShowStats((v) => !v)}
      />
      {showHistory ? (
        <HistoryPanel chats={savedChats} rtl={rtl} onOpen={openSavedChat} onDelete={deleteSavedChat} />
      ) : showStats ? (
        <StatsPanel stats={getTopUsage(10)} rtl={rtl} />
      ) : (
        <Messages
          scrollRef={scrollRef}
          messages={messages}
          thinking={thinking}
          rtl={rtl}
          greeting={greeting}
          startItems={startItems}
          onStart={(q) => sendQuery(q)}
          onLink={goToLink}
          onCandidate={(v) => sendQuery(v)}
        />
      )}
      <InputBox input={input} setInput={setInput} thinking={thinking} onSend={() => sendQuery(input)} />
    </div>
  );
}

function Header({
  onClose,
  onHistory,
  onNewChat,
  onDriveSync,
  driveSyncing,
  onExport,
  onStats,
}: {
  onClose?: () => void;
  onHistory?: () => void;
  onNewChat?: () => void;
  onDriveSync?: () => void;
  driveSyncing?: boolean;
  onExport?: () => void;
  onStats?: () => void;
}) {
  const { t, lang } = useLanguage();
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-gradient-to-r from-primary/10 to-transparent">
      <div className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center flex-shrink-0">
        <Bot className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-foreground text-sm" dir={lang === "ur" ? "rtl" : "ltr"}>Marenii AI Assistant</div>
      </div>
      {onStats && (
        <button
          onClick={onStats}
          title={t("usage_stats") || "سب سے زیادہ پوچھے گئے سوالات"}
          className="text-muted-foreground hover:text-primary p-1 rounded-lg transition-colors"
        >
          <BarChart3 className="w-4 h-4" />
        </button>
      )}
      {onExport && (
        <button
          onClick={onExport}
          title={t("export_chat") || "چیٹ ڈاؤن لوڈ کریں"}
          className="text-muted-foreground hover:text-primary p-1 rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" />
        </button>
      )}
      {onDriveSync && (
        <button
          onClick={onDriveSync}
          title={t("drive_sync") || "Drive پر محفوظ کریں"}
          className="text-muted-foreground hover:text-primary p-1 rounded-lg transition-colors"
        >
          {driveSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
        </button>
      )}
      {onHistory && (
        <button
          onClick={onHistory}
          title={t("chat_history") || "پچھلی گفتگو"}
          className="text-muted-foreground hover:text-primary p-1 rounded-lg transition-colors"
        >
          <History className="w-4 h-4" />
        </button>
      )}
      {onNewChat && (
        <button
          onClick={onNewChat}
          title={t("chat_new") || "نئی گفتگو"}
          className="text-muted-foreground hover:text-primary p-1 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      )}
      {onClose && (
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded-lg">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

function HistoryPanel({
  chats,
  rtl,
  onOpen,
  onDelete,
}: {
  chats: SavedChat[];
  rtl: boolean;
  onOpen: (chat: SavedChat) => void;
  onDelete: (id: string) => void;
}) {
  const { t, lang } = useLanguage();
  return (
    <div ref={null} className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/20 min-h-[320px]" dir="ltr">
      {chats.length === 0 ? (
        <div className="text-center py-10">
          <div className="text-3xl mb-2">🗂️</div>
          <p className="text-sm text-muted-foreground" dir="rtl">کوئی پرانی گفتگو نہیں ملتی</p>
          <p className="text-xs text-muted-foreground/70 mt-1" dir="rtl">
            گفتگو بند کرنے سے پہلے وہ یہاں محفوظ ہو جاتی ہے
          </p>
        </div>
      ) : (
        chats.map((chat) => (
          <div
            key={chat.id}
            className="flex items-center gap-2 bg-white border border-border rounded-xl p-3 cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all"
            onClick={() => onOpen(chat)}
          >
            <History className="w-4 h-4 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground truncate" dir={rtl ? "rtl" : "ltr"}>
                {chat.title}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {new Date(chat.ts).toLocaleString(lang === "ur" ? "ur-PK" : "en-GB", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {" · "}{chat.messages.length} {t("chat_messages") || "messages"}
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(chat.id);
              }}
              className="text-muted-foreground hover:text-red-500 p-1 rounded-lg transition-colors"
              title={t("chat_delete") || "حذف کریں"}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))
      )}
    </div>
  );
}

function StatsPanel({
  stats,
  rtl,
}: {
  stats: { question: string; count: number }[];
  rtl: boolean;
}) {
  const { t } = useLanguage();
  return (
    <div className="flex-1 overflow-y-auto p-4 bg-muted/20 min-h-[320px]" dir="ltr">
      <div className="text-center pb-3">
        <div className="text-2xl mb-1">📊</div>
        <p className="text-sm font-medium text-foreground" dir="rtl">{t("usage_stats_title") || "سب سے زیادہ پوچھے گئے سوالات"}</p>
      </div>
      {stats.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-6" dir="rtl">
          {t("usage_stats_empty") || "ابھی کوئی ڈیٹا نہیں — سوال پوچھیں اور یہاں شمار ہو گا"}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {stats.map((s, i) => (
            <div
              key={s.question}
              className="flex items-center gap-3 bg-white border border-border rounded-xl px-3 py-2.5"
              dir={rtl ? "rtl" : "ltr"}
            >
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                {i + 1}
              </span>
              <span className="flex-1 text-sm text-foreground truncate">{s.question}</span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">{s.count}×</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Messages({
  scrollRef,
  messages,
  thinking,
  rtl,
  greeting,
  startItems,
  onStart,
  onLink,
  onCandidate,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  messages: ChatMessage[];
  thinking: boolean;
  rtl: boolean;
  greeting: string;
  startItems: string[];
  onStart: (q: string) => void;
  onLink: (href: string) => void;
  onCandidate: (v: string) => void;
}) {
  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20 min-h-0 pb-20" dir="ltr">
      {messages.length === 0 && (
        <div className="text-center py-6">
          <div className="text-3xl mb-2">🎯</div>
          <p className="text-sm text-foreground font-medium mb-4" dir="rtl">{greeting}</p>
          <div className="flex flex-col gap-2 items-center">
            {startItems.map((q) => (
              <button
                key={q}
                onClick={() => onStart(q)}
                className="max-w-full px-4 py-2 rounded-full border border-border bg-background text-xs text-foreground hover:border-primary hover:text-primary transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.map((m, i) => (
        <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
          <div
            dir={rtl ? "rtl" : "ltr"}
            className={cn(
              "max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed",
              m.role === "user"
                ? "bg-primary text-primary-foreground rounded-br-md"
                : "bg-card border border-border rounded-bl-md"
            )}
          >
            {m.role === "assistant" && !m.text ? (
              <div className="flex items-center gap-1.5 py-1">
                {[0, 1, 2].map((d) => (
                  <span key={d} className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: `${d * 120}ms` }} />
                ))}
              </div>
            ) : (
              m.text.split("\n").map((line, i) => (
                <p key={i} className={cn("whitespace-pre-wrap", i > 0 && "mt-1")}>{line}</p>
              ))
            )}
            {m.links && m.links.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2" dir="rtl">
                {m.links.map((l, j) => (
                  <button
                    key={j}
                    onClick={() => onLink(l.href)}
                    className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold border border-primary/20 hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    🔗 {l.label}
                  </button>
                ))}
              </div>
            )}
            {m.candidates && m.candidates.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2" dir="rtl">
                {m.candidates.map((c, j) => (
                  <button
                    key={j}
                    onClick={() => onCandidate(c)}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-700 text-xs font-semibold border border-amber-400/30 hover:bg-amber-500 hover:text-white transition-colors"
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

      {thinking && (
        <div className="flex justify-start">
          <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
            {[0, 1, 2].map((d) => (
              <span key={d} className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: `${d * 120}ms` }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InputBox({
  input,
  setInput,
  thinking,
  onSend,
}: {
  input: string;
  setInput: (v: string) => void;
  thinking: boolean;
  onSend: () => void;
}) {
  const { lang } = useLanguage();
  const submit = () => {
    if (input.trim() && !thinking) onSend();
  };
  return (
    <div className="border-t border-border p-3 flex items-end gap-2" dir={lang === "ur" ? "rtl" : "ltr"}>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        rows={1}
        placeholder="اپنا سوال لکھیں... / Ask your question..."
        className="flex-1 pl-3.5 pr-[72px] py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none max-h-32 overflow-y-auto leading-relaxed"
      />
      <button
        onClick={submit}
        disabled={thinking}
        className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0"
        aria-label="Send"
      >
        {thinking ? <Sparkles className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
      </button>
    </div>
  );
}