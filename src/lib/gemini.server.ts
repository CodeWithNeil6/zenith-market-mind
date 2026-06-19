// Gemini generation through the managed AI gateway (server-only).
// Gateway API version: OpenAI-compatible /v1. Model IDs use provider prefixes.
const DEFAULT_GEMINI_MODEL = "google/gemini-3-flash-preview";

export type GeminiPart = { text: string };
export type GeminiMessage = { role: "user" | "model"; parts: GeminiPart[] };

export interface GeminiOptions {
  model?: string;
  system?: string;
  temperature?: number;
  responseMimeType?: "application/json" | "text/plain";
}

export async function geminiGenerate(
  lovableApiKey: string,
  prompt: string | GeminiMessage[],
  opts: GeminiOptions = {},
): Promise<{ text: string; raw: unknown }> {
  const { generateText } = await import("ai");
  const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
  const gateway = createLovableAiGatewayProvider(lovableApiKey);
  const model = opts.model ?? DEFAULT_GEMINI_MODEL;

  const contents: GeminiMessage[] =
    typeof prompt === "string"
      ? [{ role: "user", parts: [{ text: prompt }] }]
      : prompt;

  const promptText = contents.map((message) => message.parts.map((part) => part.text).join("\n")).join("\n\n");
  const result = await generateText({
    model: gateway(model),
    system: opts.system,
    prompt: promptText,
    temperature: opts.temperature ?? 0.4,
  });

  return { text: result.text, raw: result.response };
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
