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

const AnalysisSchema = z.object({
  direction: z.enum(["bullish", "bearish", "neutral"]),
  signal: z.enum(["BUY", "SELL", "CALL", "PUT", "HOLD"]),
  confidence: z.number().min(0).max(100),
  entry: z.number().nullable(),
  stop_loss: z.number().nullable(),
  target1: z.number().nullable(),
  target2: z.number().nullable(),
  target3: z.number().nullable(),
  risk_reward: z.number().nullable(),
  weights: z.object({
    technical: z.number(),
    options: z.number(),
    news: z.number(),
    economic: z.number(),
    candlestick: z.number(),
  }),
  weighting_rationale: z.string(),
  reasoning: z.string(),
  market_summary: z.string(),
  risk_analysis: z.string(),
});

const SYSTEM = `You are AI Algo, an Indian-market intelligence reasoning engine. You analyze NSE/BSE indices and produce structured trading insights. You DO NOT execute trades. You provide educational analysis only.

Your job:
1. Dynamically WEIGHT factors (technical, options, news, economic, candlestick) based on the current context the user describes — e.g. RBI-day favors economic; geopolitical shock favors news; clean breakout favors technical. Weights MUST sum to 100.
2. Produce a direction (bullish/bearish/neutral), a signal (BUY/SELL/CALL/PUT/HOLD), and a 0-100 confidence score.
3. Provide entry, stop-loss, three targets and risk:reward ratio when actionable. If you do not have live price data, return null for numeric fields and explain in reasoning that live data is required (the user must connect a market-data provider).
4. Tailor everything to the user's trading style, risk profile, time horizon and capital.
5. Reasoning must be specific and disciplined — name the levels, patterns, OI clusters, macro events or news themes that drive your view.

Return ONLY valid JSON matching the requested schema.`;

export const runAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AnalyzeInput.parse(input))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY not configured");
    const start = Date.now();

    const { generateText, Output } = await import("ai");
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);

    const userPrompt = `Analyze this scenario for the Indian market.

Index: ${data.market_index}
Trading style: ${data.style}
Risk profile: ${data.risk}
Time horizon: ${data.horizon}
Capital: ₹${data.capital.toLocaleString("en-IN")}
${data.notes ? `User notes: ${data.notes}` : ""}

Decide how to dynamically WEIGHT the five factor buckets (technical, options, news, economic, candlestick) based on what currently matters most for this scenario, then produce the structured analysis.`;

    let result;
    try {
      result = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        system: SYSTEM,
        prompt: userPrompt,
        experimental_output: Output.object({ schema: AnalysisSchema }),
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      await context.supabase.from("ai_logs").insert({
        user_id: context.userId,
        kind: "analysis",
        model: "google/gemini-3-flash-preview",
        prompt: { input: data },
        error: msg,
        duration_ms: Date.now() - start,
      });
      throw new Error(`AI gateway error: ${msg}`);
    }

    const out = result.experimental_output as z.infer<typeof AnalysisSchema>;

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
        model: "google/gemini-3-flash-preview",
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
        model: "google/gemini-3-flash-preview",
        prompt: { input: data },
        response: out,
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
    if (!key) throw new Error("LOVABLE_API_KEY not configured");

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

    const { generateText } = await import("ai");
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      {
        role: "system",
        content: `You are AI Algo's market assistant. You help users understand Indian market dynamics, option Greeks, AI-generated signals, weighting rationale, and risk. You give educational analysis only; you never give personal financial advice or place trades.

User's recent analyses:
${recentCtx || "(none yet)"}`,
      },
      ...(history ?? []).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: data.message },
    ];

    const result = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      messages,
    });

    await context.supabase.from("chat_history").insert({
      user_id: context.userId,
      thread_id: threadId,
      role: "assistant",
      content: result.text,
    });

    return { thread_id: threadId, reply: result.text };
  });
