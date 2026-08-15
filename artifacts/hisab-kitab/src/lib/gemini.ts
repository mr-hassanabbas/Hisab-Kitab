interface GeminiContent {
  role: string;
  parts: { text: string }[];
}

export interface GeminiRequest {
  systemInstruction?: string;
  contents: GeminiContent[];
  generationConfig?: Record<string, unknown>;
}

export async function callGeminiProxy(req: GeminiRequest): Promise<string> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch("/api/ai/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const errMsg = data?.error ?? `Proxy error ${response.status}`;
      console.error("[callGeminiProxy] API error:", errMsg, "status:", response.status);
      throw new Error(errMsg);
    }
    const text = data?.text;
    if (typeof text !== "string" || text.trim() === "") {
      throw new Error("Empty response from server");
    }
    return text;
  } finally {
    window.clearTimeout(timeout);
  }
}

/** Groq alternative to callGeminiProxy — same request shape, same VOICE_SYSTEM_PROMPT,
 *  routed through the server proxy so the key never ships to the browser.
 *  Accepts an optional model (defaults to llama-3.3-70b-versatile). */
export async function callGroqProxy(
  req: GeminiRequest,
  model = "llama-3.3-70b-versatile"
): Promise<string> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch("/api/ai/groq", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...req, generationConfig: { ...(req.generationConfig ?? {}), model } }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const errMsg = data?.error ?? `Groq proxy error ${response.status}`;
      console.error("[callGroqProxy] API error:", errMsg, "status:", response.status);
      const err = new Error(errMsg) as Error & { status?: number };
      err.status = response.status;
      throw err;
    }
    const text = data?.text;
    if (typeof text !== "string" || text.trim() === "") {
      throw new Error("Empty response from server");
    }
    return text;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function callGeminiStream(
  req: GeminiRequest,
  onChunk: (fullText: string) => void
): Promise<string> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch("/api/ai/gemini/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal: controller.signal,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      const errMsg = data?.error ?? `Proxy error ${response.status}`;
      console.error("[callGeminiStream] API error:", errMsg, "status:", response.status);
      throw new Error(errMsg);
    }
    if (!response.body) throw new Error("No stream body");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let acc = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      acc += decoder.decode(value, { stream: true });
      onChunk(acc);
    }
    return acc;
  } finally {
    window.clearTimeout(timeout);
  }
}

/** Progressive extractor: pulls the `answer` field out of a partially-streamed JSON response. */
export function extractAnswerProgress(raw: string): string {
  const m = raw.match(/"answer"\s*:\s*"((?:[^"\\]|\\.)*)/);
  if (!m) return "";
  return m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
}

// ---------------------------------------------------------------------------
// Shared fallback chain (GuideChat + VoiceAssistant)
// ---------------------------------------------------------------------------
const GROQ_PRIMARY =
  (import.meta.env as Record<string, string> | undefined)?.VITE_GROQ_PRIMARY ===
  "true";

/**
 * Try Groq first (when enabled), then fall back to Gemini. Throws only if
 * both providers fail, so callers can fall back to a canned answer.
 */
export async function callModelWithFallback(
  req: GeminiRequest,
  model = "llama-3.3-70b-versatile"
): Promise<string> {
  if (!GROQ_PRIMARY) {
    return callGeminiProxy(req);
  }
  const started = Date.now();
  const ts = new Date().toISOString();
  try {
    const text = await callGroqProxy(req, model);
    console.log(
      `[callModelWithFallback] Groq OK ts=${ts} latency=${Date.now() - started}ms`
    );
    return text;
  } catch (err) {
    const status = (err as Error & { status?: number })?.status;
    const hit429 = status === 429;
    console.log(
      `[callModelWithFallback] Groq FAIL ts=${ts} latency=${Date.now() - started}ms status=${status ?? "?"}${hit429 ? " hit 429 → Gemini fallback" : " → Gemini fallback"}:`,
      (err as Error).message
    );
  }
  return callGeminiProxy(req);
}

/**
 * Fetch server-generated speech audio for Marenii's spoken output.
 * Replaces browser speechSynthesis (which has no working local voices and
 * produces silent failures with remote Chrome voices).
 *
 * Returns a playable audio URL (object URL) or null on failure.
 */
export async function callTtsProxy(text: string, lang: "ur" | "en" = "ur"): Promise<string | null> {
  try {
    const response = await fetch("/api/ai/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, lang }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      console.error("[callTtsProxy] TTS error:", response.status, data?.error ?? "");
      return null;
    }
    const blob = await response.blob();
    if (blob.size === 0) {
      console.error("[callTtsProxy] TTS returned empty blob");
      return null;
    }
    return URL.createObjectURL(blob);
  } catch (e) {
    console.error("[callTtsProxy] network error:", (e as Error).message);
    return null;
  }
}
