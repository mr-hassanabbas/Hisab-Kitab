import { Router } from "express";
import { readFileSync } from "fs";
import path from "path";

const router = Router();

/**
 * L16 (16-bit PCM, mono, 24kHz) → WAV container.
 * The Gemini TTS API returns audio in `audio/L16;codec=pcm;rate=24000` format,
 * which the browser <audio> element cannot play directly. We wrap it in a
 * standard WAV (RIFF) header so it plays natively via HTMLAudioElement.
 */
function l16ToWav(l16Base64: string, sampleRate = 24000, numChannels = 1): Buffer {
  const pcm = Buffer.from(l16Base64, "base64");
  const byteRate = sampleRate * numChannels * 2; // 16-bit = 2 bytes
  const dataSize = pcm.length;
  const buffer = Buffer.alloc(44 + dataSize);
  const view = new DataView(buffer.buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);
  pcm.copy(buffer, 44);
  return buffer;
}

function getGeminiApiKey(): string | undefined {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  try {
    const envPath = path.join(process.cwd(), "..", "hisab-kitab", ".env");
    const content = readFileSync(envPath, "utf8");
    // Check both VITE_GEMINI_API_KEY and bare GEMINI_API_KEY in .env file
    const viteMatch = content.match(/^\s*VITE_GEMINI_API_KEY=(.*)\s*$/m);
    if (viteMatch && viteMatch[1] && viteMatch[1] !== "your_key_here") {
      return viteMatch[1].replace(/^["']|["']$/g, "");
    }
    const bareMatch = content.match(/^\s*GEMINI_API_KEY=(.*)\s*$/m);
    if (bareMatch && bareMatch[1] && bareMatch[1] !== "your_key_here") {
      return bareMatch[1].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

function getGroqApiKey(): string | undefined {
  if (process.env.GROQ_API_KEY) return process.env.GROQ_API_KEY;
  try {
    const envPath = path.join(process.cwd(), "..", "hisab-kitab", ".env");
    const content = readFileSync(envPath, "utf8");
    const match = content.match(/^\s*GROQ_API_KEY=(.*)\s*$/m);
    if (match && match[1]) return match[1].replace(/^["']|["']$/g, "");
  } catch {
    /* ignore */
  }
  return undefined;
}

router.post("/groq", async (req, res) => {
  const { systemInstruction, contents, generationConfig } = req.body ?? {};
  if (!Array.isArray(contents) || contents.length === 0) {
    res.status(400).json({ success: false, error: "contents is required" });
    return;
  }
  const apiKey = getGroqApiKey();
  if (!apiKey || apiKey.trim() === "" || apiKey === "your_key_here") {
    res.status(501).json({ success: false, error: "Groq API key not configured on server" });
    return;
  }
  try {
    const messages: { role: string; content: string }[] = [];
    if (typeof systemInstruction === "string" && systemInstruction.trim() !== "") {
      messages.push({ role: "system", content: systemInstruction });
    }
    for (const c of contents) {
      const partTexts = Array.isArray(c?.parts)
        ? c.parts.map((p: any) => p?.text ?? "").filter((t: string) => t !== "")
        : [];
      messages.push({ role: c?.role === "assistant" ? "assistant" : "user", content: partTexts.join("\n") });
    }
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: (generationConfig as any)?.model ?? "llama-3.3-70b-versatile",
        response_format: { type: "json_object" },
        messages,
      }),
    });
    const raw = await response.text();
    let data: any = null;
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
    if (!response.ok) {
      res.status(response.status === 429 ? 429 : 502).json({
        success: false,
        error: data?.error?.message ?? `Groq API error ${response.status}`,
      });
      return;
    }
    const text = data?.choices?.[0]?.message?.content;
    if (!text) {
      res.status(502).json({ success: false, error: "Empty response from Groq" });
      return;
    }
    res.json({ success: true, text });
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message });
  }
});

router.post("/gemini", async (req, res) => {
  const { systemInstruction, contents, generationConfig } = req.body ?? {};
  if (!Array.isArray(contents) || contents.length === 0) {
    res.status(400).json({ success: false, error: "contents is required" });
    return;
  }
  const apiKey = getGeminiApiKey();
  if (!apiKey || apiKey.trim() === "" || apiKey === "your_key_here") {
    res.status(501).json({ success: false, error: "Gemini API key not configured on server" });
    return;
  }
  try {
    const body: Record<string, unknown> = {
      contents,
      generationConfig: generationConfig ?? {},
    };
    if (typeof systemInstruction === "string" && systemInstruction.trim() !== "") {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    const raw = await response.text();
    let data: Record<string, any> | null = null;
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
    if (!response.ok) {
      res.status(502).json({
        success: false,
        error: data?.error?.message ?? `Gemini API error ${response.status}`,
      });
      return;
    }
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      res.status(502).json({ success: false, error: "Empty response from Gemini" });
      return;
    }
    res.json({ success: true, text });
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message });
  }
});

router.post("/gemini/stream", async (req, res) => {
  const { systemInstruction, contents, generationConfig } = req.body ?? {};
  if (!Array.isArray(contents) || contents.length === 0) {
    res.status(400).json({ success: false, error: "contents is required" });
    return;
  }
  const apiKey = getGeminiApiKey();
  if (!apiKey || apiKey.trim() === "" || apiKey === "your_key_here") {
    res.status(501).json({ success: false, error: "Gemini API key not configured on server" });
    return;
  }
  try {
    const body: Record<string, unknown> = {
      contents,
      generationConfig: generationConfig ?? {},
    };
    if (typeof systemInstruction === "string" && systemInstruction.trim() !== "") {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    if (!response.ok || !response.body) {
      const raw = await response.text().catch(() => "");
      res.status(502).json({ success: false, error: raw || `Gemini API error ${response.status}` });
      return;
    }
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const parsed = JSON.parse(payload);
          const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) res.write(text);
        } catch {
          /* skip partial chunks */
        }
      }
    }
    res.end();
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message });
  }
});

/**
 * TTS endpoint — uses Google's Gemini TTS API (gemini-2.5-flash-preview-tts).
 * Supports Urdu (ur) and English (en) via the same GEMINI_API_KEY used for
 * content generation. Returns a WAV audio blob.
 */
router.post("/tts", async (req, res) => {
  const { text, lang = "ur" } = req.body ?? {};
  if (typeof text !== "string" || text.trim() === "") {
    res.status(400).json({ success: false, error: "text is required and non-empty" });
    return;
  }
  const apiKey = getGeminiApiKey();
  if (!apiKey || apiKey.trim() === "" || apiKey === "your_key_here") {
    res.status(501).json({ success: false, error: "Gemini API key not configured on server" });
    return;
  }

  // Map language to a Gemini TTS voice name.
  // ur → Kore (female voice that handles Urdu well); en → Kore (works for English too).
  const voiceName = "Kore";

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text }],
            },
          ],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
          },
        }),
      }
    );

    const raw = await response.text();
    let data: Record<string, any> | null = null;
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }

    if (!response.ok) {
      res.status(response.status === 429 ? 429 : 502).json({
        success: false,
        error: data?.error?.message ?? `Gemini TTS error ${response.status}`,
      });
      return;
    }

    // Path: candidates[0].content.parts[0].inlineData.data = base64 L16 PCM
    const audioData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    const mimeType = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType;

    if (!audioData) {
      res.status(502).json({ success: false, error: "No audio data in Gemini TTS response" });
      return;
    }

    // Convert L16 PCM → WAV so the browser <audio> element can play it directly.
    const wavBuffer = l16ToWav(audioData, 24000, 1);

    res.set("Content-Type", "audio/wav");
    res.set("Content-Length", String(wavBuffer.length));
    res.set("Cache-Control", "no-cache");
    res.send(wavBuffer);
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message });
  }
});

export default router;
