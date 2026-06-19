// Direct Gemini REST client (server-only). Uses GEMINI_API_KEY.
const BASE = "https://generativelanguage.googleapis.com/v1beta";

export type GeminiPart = { text: string };
export type GeminiMessage = { role: "user" | "model"; parts: GeminiPart[] };

export interface GeminiOptions {
  model?: string;
  system?: string;
  temperature?: number;
  responseMimeType?: "application/json" | "text/plain";
}

export async function geminiGenerate(
  apiKey: string,
  prompt: string | GeminiMessage[],
  opts: GeminiOptions = {},
): Promise<{ text: string; raw: unknown }> {
  const model = opts.model ?? "gemini-2.0-flash";
  const url = `${BASE}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const contents: GeminiMessage[] =
    typeof prompt === "string"
      ? [{ role: "user", parts: [{ text: prompt }] }]
      : prompt;

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: opts.temperature ?? 0.4,
      ...(opts.responseMimeType ? { responseMimeType: opts.responseMimeType } : {}),
    },
  };
  if (opts.system) {
    body.systemInstruction = { role: "system", parts: [{ text: opts.system }] };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${errText.slice(0, 500)}`);
  }
  const raw = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text =
    raw.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  return { text, raw };
}

// Extract first balanced {...} block from a string (handles ```json fences too).
export function extractJsonBlock(s: string): string | null {
  if (!s) return null;
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const src = fence ? fence[1] : s;
  const start = src.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
    } else {
      if (ch === '"') inStr = true;
      else if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) return src.slice(start, i + 1);
      }
    }
  }
  return null;
}
