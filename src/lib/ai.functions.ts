import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const AnalyzeInput = z.object({
  market_index: z.enum(["NIFTY50", "BANKNIFTY", "SENSEX", "FINNIFTY", "MIDCPNIFTY", "NIFTYNXT50"]),
  style: z.enum(["intraday", "swing", "positional", "futures", "options", "longterm"]),
  risk: z.enum(["conservative", "moderate", "aggressive"]),
  horizon: z.enum(["1h", "same_day", "next_session", "next_day", "next_week"]),
  capital: z.number().positive().max(1_000_000_000),
  notes: z.string().max(500).optional(),
});

const numLike = z.preprocess((v) => {
  if (v === null || v === undefined || v === "" || v === "null") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v.replace(/[, ₹]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}, z.number().nullable());

const numReq = z.preprocess((v) => {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[, %₹]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}, z.number());

const WeightsSchema = z.object({
  technical: numReq,
  options: numReq,
  news: numReq,
  economic: numReq,
  candlestick: numReq,
});

const AnalysisSchema = z.object({
  direction: z.enum(["bullish", "bearish", "neutral"]),
  signal: z.enum(["BUY", "SELL", "CALL", "PUT", "HOLD"]),
  confidence: numReq.pipe(z.number().min(0).max(100)),
  entry: numLike,
  stop_loss: numLike,
  target1: numLike,
  target2: numLike,
  target3: numLike,
  risk_reward: numLike,
  weights: WeightsSchema,
  weighting_rationale: z.string(),
  reasoning: z.string(),
  market_summary: z.string(),
  risk_analysis: z.string(),
});

const SCHEMA_DESCRIPTION = `{
  "direction": "bullish" | "bearish" | "neutral",
  "signal": "BUY" | "SELL" | "CALL" | "PUT" | "HOLD",
  "confidence": number 0-100,
  "entry": number | null,
  "stop_loss": number | null,
  "target1": number | null,
  "target2": number | null,
  "target3": number | null,
  "risk_reward": number | null,
  "weights": { "technical": number, "options": number, "news": number, "economic": number, "candlestick": number },
  "weighting_rationale": string,
  "reasoning": string,
  "market_summary": string,
  "risk_analysis": string
}`;

const SYSTEM = `You are AI Algo, an Indian-market intelligence reasoning engine. You analyze NSE/BSE indices and produce structured trading insights. You DO NOT execute trades. Educational analysis only.

Rules:
1. Dynamically WEIGHT five factors (technical, options, news, economic, candlestick) based on context. Weights MUST be numbers and MUST sum to 100.
2. Produce direction (bullish/bearish/neutral), signal (BUY/SELL/CALL/PUT/HOLD), confidence (0-100).
3. Provide entry, stop_loss, target1, target2, target3 and risk_reward when actionable. If no live price, return null for those numeric fields.
4. Tailor everything to the user's style, risk, horizon, capital.
5. Reasoning must be specific — name levels, OI clusters, macro events, news themes.

Return ONLY a single valid JSON object — no prose, no markdown fences — matching exactly this schema:
${SCHEMA_DESCRIPTION}`;

const DEFAULT_AI_MODEL = "google/gemini-3-flash-preview";

function configuredAiModel() {
  const model = process.env.GEMINI_MODEL?.trim();
  if (!model || model === "gemini-1.5-flash" || model === "gemini-2.0-flash") {
    return DEFAULT_AI_MODEL;
  }
  return model.startsWith("google/") ? model : `google/${model}`;
}

function normalizeWeights(w: Record<string, number>): Record<string, number> {
  const keys = ["technical", "options", "news", "economic", "candlestick"] as const;
  const filled: Record<string, number> = {};
  for (const k of keys) filled[k] = Number.isFinite(w[k]) ? Math.max(0, w[k]) : 0;
  const sum = keys.reduce((s, k) => s + filled[k], 0);
  if (sum === 0) {
    const eq = 100 / keys.length;
    for (const k of keys) filled[k] = eq;
    return filled;
  }
  const scaled: Record<string, number> = {};
  for (const k of keys) scaled[k] = Math.round((filled[k] / sum) * 1000) / 10;
  // Fix rounding so total = 100
  const diff = 100 - keys.reduce((s, k) => s + scaled[k], 0);
  scaled.technical = Math.round((scaled.technical + diff) * 10) / 10;
  return scaled;
}

async function callGeminiForAnalysis(
  lovableApiKey: string,
  userPrompt: string,
): Promise<{ parsed: z.infer<typeof AnalysisSchema>; rawText: string }> {
  const { geminiGenerate, extractJsonBlock } = await import("./gemini.server");
  const model = configuredAiModel();

  const attempt = async (extraSystem = "") => {
    const { text } = await geminiGenerate(lovableApiKey, userPrompt, {
      model,
      system: SYSTEM + (extraSystem ? `\n\n${extraSystem}` : ""),
      temperature: 0.4,
      responseMimeType: "application/json",
    });
    return text;
  };

  let rawText = await attempt();
  console.log("[ai.runAnalysis] raw gemini response (truncated):", rawText.slice(0, 2000));

  const tryParse = (txt: string) => {
    const candidate = extractJsonBlock(txt) ?? txt;
    try {
      const obj = JSON.parse(candidate);
      if (obj && typeof obj === "object" && obj.weights && typeof obj.weights === "object") {
        obj.weights = normalizeWeights(obj.weights as Record<string, number>);
      }
      return AnalysisSchema.safeParse(obj);
    } catch {
      return null;
    }
  };

  let parsed = tryParse(rawText);
  if (!parsed || !parsed.success) {
    // Repair attempt: ask the model to re-emit valid JSON
    const repairPrompt = `Your previous response was not valid JSON matching the schema. Re-emit a SINGLE JSON object only, no prose, matching exactly:
${SCHEMA_DESCRIPTION}

Previous output to repair:
${rawText.slice(0, 4000)}`;
    rawText = await (async () => {
      const { geminiGenerate } = await import("./gemini.server");
      const { text } = await geminiGenerate(lovableApiKey, repairPrompt, {
        model,
        system: SYSTEM,
        temperature: 0.1,
        responseMimeType: "application/json",
      });
      return text;
    })();
    console.log("[ai.runAnalysis] repair gemini response (truncated):", rawText.slice(0, 2000));
    parsed = tryParse(rawText);
  }

  if (!parsed || !parsed.success) {
    throw new Error(
      `Gemini returned invalid JSON for AnalysisSchema: ${parsed?.error?.message ?? "parse failed"}. Raw: ${rawText.slice(0, 400)}`,
    );
  }
  return { parsed: parsed.data, rawText };
}

export const runAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AnalyzeInput.parse(input))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI gateway key not configured.");
    const start = Date.now();
    const model = configuredAiModel();

    // Pull live market context from Upstox if connected
    let liveCtx = "";
    let liveSpot: number | null = null;
    try {
      const { data: integ } = await context.supabase
        .from("integrations")
        .select("credentials")
        .eq("user_id", context.userId)
        .eq("provider", "upstox")
        .maybeSingle();
      const token = (integ?.credentials as { access_token?: string } | null)?.access_token;
      if (token) {
        const { fetchQuote, fetchExpiries, fetchOptionChain } = await import("./upstox.server");
        const q = await fetchQuote(token, data.market_index).catch(() => null);
        if (q) {
          liveSpot = q.ltp;
          liveCtx = `\nLIVE MARKET DATA (Upstox, ${q.ts}):\n- Spot: ${q.ltp.toFixed(2)} (O ${q.open} H ${q.high} L ${q.low} prev close ${q.close})\n- Change: ${q.change.toFixed(2)} (${q.changePct.toFixed(2)}%)`;
        }
        if (["NIFTY50", "BANKNIFTY", "FINNIFTY", "SENSEX"].includes(data.market_index)) {
          const exps = await fetchExpiries(token, data.market_index).catch(() => [] as string[]);
          if (exps[0]) {
            const chain = await fetchOptionChain(token, data.market_index, exps[0]).catch(() => null);
            if (chain) {
              liveCtx += `\n- Nearest expiry: ${chain.expiry} | PCR: ${chain.pcr.toFixed(2)} | Max Pain: ${chain.max_pain} | Call OI: ${chain.total_call_oi} | Put OI: ${chain.total_put_oi}`;
            }
          }
        }
      }
    } catch (e) {
      console.warn("Upstox enrich failed", e);
    }

    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: newsRows } = await context.supabase
      .from("news")
      .select("title,raw,sentiment(sentiment_score,impact_score,rationale)")
      .eq("user_id", context.userId)
      .gte("published_at", since)
      .order("published_at", { ascending: false })
      .limit(40);
    const indexNews = (newsRows ?? []).filter(
      (r) => (r.raw as { market_index?: string } | null)?.market_index === data.market_index,
    );
    const topNews = indexNews
      .map((r) => ({ ...r, s: Array.isArray(r.sentiment) ? r.sentiment[0] : r.sentiment }))
      .filter((r) => r.s)
      .sort((a, b) => (b.s?.impact_score ?? 0) - (a.s?.impact_score ?? 0))
      .slice(0, 8);
    const newsCtx = topNews.length
      ? `\n\nTOP SCORED HEADLINES (last 24h, ${data.market_index}):\n` +
        topNews.map((r) => `- [sent ${r.s?.sentiment_score?.toFixed(2)} impact ${Math.round(r.s?.impact_score ?? 0)}] ${r.title}`).join("\n")
      : "";

    const { data: econRows } = await context.supabase
      .from("economic_events")
      .select("event_name,event_date,importance,category")
      .eq("user_id", context.userId)
      .gte("event_date", new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10))
      .order("event_date", { ascending: true })
      .limit(10);
    const econCtx = econRows?.length
      ? `\n\nUPCOMING ECONOMIC EVENTS:\n` +
        econRows.map((e) => `- ${e.event_date?.slice(0, 10)} [${e.importance ?? "low"}] ${e.event_name} (${e.category ?? ""})`).join("\n")
      : "";

    const userPrompt = `Analyze this scenario for the Indian market.

Index: ${data.market_index}
Trading style: ${data.style}
Risk profile: ${data.risk}
Time horizon: ${data.horizon}
Capital: ₹${data.capital.toLocaleString("en-IN")}
${data.notes ? `User notes: ${data.notes}` : ""}
${liveCtx || "\n(No live market data — user has not connected Upstox; produce a structural view and return null for entry/SL/targets.)"}${newsCtx}${econCtx}

Decide how to dynamically WEIGHT the five factor buckets (technical, options, news, economic, candlestick) based on what currently matters most, then produce the structured analysis.${liveSpot ? ` Use the live spot of ${liveSpot.toFixed(2)} as anchor for entry/SL/targets.` : ""}

Return ONLY the JSON object.`;

    let out: z.infer<typeof AnalysisSchema>;
    let rawText = "";
    try {
      const r = await callGeminiForAnalysis(key, userPrompt);
      out = r.parsed;
      rawText = r.rawText;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[ai.runAnalysis] failed:", msg);
      await context.supabase.from("ai_logs").insert({
        user_id: context.userId,
        kind: "analysis",
        model,
        prompt: { input: data },
        error: msg,
        duration_ms: Date.now() - start,
      });
      throw new Error(`Gemini error: ${msg}`);
    }

    // Ensure weights sum to 100 even after successful parse
    out.weights = normalizeWeights(out.weights as unknown as Record<string, number>) as typeof out.weights;

    const { data: analysis, error: aErr } = await context.supabase
      .from("analyses")
      .insert({
        user_id: context.userId,
        market_index: data.market_index,
        style: data.style,
        risk: data.risk,
        horizon: data.horizon,
        capital: data.capital,
        direction: out.direction,
        signal: out.signal,
        confidence: out.confidence,
        entry: out.entry,
        stop_loss: out.stop_loss,
        target1: out.target1,
        target2: out.target2,
        target3: out.target3,
        risk_reward: out.risk_reward,
        weights: out.weights,
        reasoning: out.reasoning,
        market_summary: out.market_summary,
        risk_analysis: out.risk_analysis,
        inputs: data,
        model,
      })
      .select()
      .single();
    if (aErr) throw new Error(aErr.message);

    await Promise.all([
      context.supabase.from("signals").insert({
        user_id: context.userId,
        analysis_id: analysis.id,
        market_index: data.market_index,
        signal: out.signal,
        confidence: out.confidence,
        entry: out.entry,
        stop_loss: out.stop_loss,
        target1: out.target1,
      }),
      context.supabase.from("weights_history").insert({
        user_id: context.userId,
        analysis_id: analysis.id,
        weights: out.weights,
        rationale: out.weighting_rationale,
      }),
      context.supabase.from("forecasts").insert({
        user_id: context.userId,
        market_index: data.market_index,
        horizon: data.horizon,
        direction: out.direction,
        predicted_price: out.target1,
        confidence: out.confidence,
        reasoning: out.reasoning.slice(0, 1200),
      }),
      context.supabase.from("ai_logs").insert({
        user_id: context.userId,
        kind: "analysis",
        model,
        prompt: { input: data },
        response: { parsed: out, raw_text: rawText.slice(0, 8000) },
        duration_ms: Date.now() - start,
      }),
    ]);

    return analysis;
  });

const ChatInput = z.object({
  thread_id: z.string().uuid().nullable(),
  message: z.string().min(1).max(4000),
});

export const sendChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ChatInput.parse(input))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI gateway key not configured.");
    const model = configuredAiModel();

    let threadId = data.thread_id;
    if (!threadId) {
      const { data: t, error } = await context.supabase
        .from("chat_threads")
        .insert({ user_id: context.userId, title: data.message.slice(0, 60) })
        .select()
        .single();
      if (error) throw new Error(error.message);
      threadId = t.id;
    }

    const { data: history } = await context.supabase
      .from("chat_history")
      .select("role,content")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(40);

    await context.supabase.from("chat_history").insert({
      user_id: context.userId,
      thread_id: threadId,
      role: "user",
      content: data.message,
    });

    const { data: recent } = await context.supabase
      .from("analyses")
      .select("market_index,signal,direction,confidence,reasoning,created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(3);

    const recentCtx = (recent ?? [])
      .map(
        (r) =>
          `- ${new Date(r.created_at).toLocaleString()} ${r.market_index} ${r.signal} (${r.direction}, ${r.confidence}%)`,
      )
      .join("\n");

    const { geminiGenerate } = await import("./gemini.server");
    const system = `You are AI Algo's market assistant. You help users understand Indian market dynamics, option Greeks, AI-generated signals, weighting rationale, and risk. Educational analysis only; never personal financial advice or trade execution.

User's recent analyses:
${recentCtx || "(none yet)"}`;

    const contents = [
      ...(history ?? []).map((m) => ({
        role: (m.role === "assistant" ? "model" : "user") as "user" | "model",
        parts: [{ text: m.content }],
      })),
      { role: "user" as const, parts: [{ text: data.message }] },
    ];

    const { text } = await geminiGenerate(key, contents, { model, system, temperature: 0.6 });

    await context.supabase.from("chat_history").insert({
      user_id: context.userId,
      thread_id: threadId,
      role: "assistant",
      content: text,
    });

    return { thread_id: threadId, reply: text };
  });

// Simple test: generate "Hello World" via Gemini
export const helloWorldGemini = createServerFn({ method: "GET" })
  .handler(async () => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI gateway key not configured.");
    const model = configuredAiModel();
    const { geminiGenerate } = await import("./gemini.server");
    const { text } = await geminiGenerate(key, "Say exactly: Hello World", { model, temperature: 0 });
    return { reply: text.trim() };
  });
