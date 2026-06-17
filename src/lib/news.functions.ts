import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const IndexEnum = z.enum(["NIFTY50", "BANKNIFTY", "SENSEX", "FINNIFTY", "MIDCPNIFTY", "NIFTYNXT50"]);

const SentimentArraySchema = z.object({
  items: z
    .array(
      z.object({
        sentiment_score: z.number().min(-1).max(1),
        bullish_score: z.number().min(0).max(100),
        bearish_score: z.number().min(0).max(100),
        impact_score: z.number().min(0).max(100),
        rationale: z.string().max(280),
      }),
    )
    .min(1),
});

async function scoreSentiment(
  headlines: { title: string; summary: string }[],
  marketIndex: string,
): Promise<z.infer<typeof SentimentArraySchema>["items"]> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY not configured");
  const { generateText, Output } = await import("ai");
  const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
  const gateway = createLovableAiGatewayProvider(key);

  const numbered = headlines
    .map((h, i) => `${i + 1}. ${h.title}${h.summary ? ` — ${h.summary.slice(0, 200)}` : ""}`)
    .join("\n");

  const result = await generateText({
    model: gateway("google/gemini-3-flash-preview"),
    system: `You are a financial sentiment analyst for Indian markets. For each headline, score how it likely affects ${marketIndex}. Return one item per headline in the SAME ORDER. sentiment_score: -1 (very bearish) to +1 (very bullish). bullish_score & bearish_score: 0-100 (independent). impact_score: 0-100 (market-moving potential). rationale: <= 280 chars.`,
    prompt: `Score these ${headlines.length} headlines for ${marketIndex}:\n${numbered}`,
    experimental_output: Output.object({ schema: SentimentArraySchema }),
  });
  const out = result.experimental_output as z.infer<typeof SentimentArraySchema>;
  return out.items.slice(0, headlines.length);
}

export const refreshNews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ market_index: IndexEnum }).parse(input))
  .handler(async ({ data, context }) => {
    const { fetchIndexNews } = await import("./news.server");
    const items = await fetchIndexNews(data.market_index, 15);
    if (!items.length) return { inserted: 0 };

    // Dedupe against last 48h
    const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    const { data: existing } = await context.supabase
      .from("news")
      .select("url")
      .eq("user_id", context.userId)
      .gte("created_at", since);
    const seen = new Set((existing ?? []).map((r) => r.url));
    const fresh = items.filter((i) => !seen.has(i.url));
    if (!fresh.length) return { inserted: 0 };

    const scores = await scoreSentiment(fresh, data.market_index).catch(() => null);

    const { data: inserted, error } = await context.supabase
      .from("news")
      .insert(
        fresh.map((n) => ({
          user_id: context.userId,
          title: n.title,
          url: n.url,
          source: n.source,
          summary: n.summary,
          published_at: n.published_at,
          raw: { market_index: data.market_index } as never,
        })),
      )
      .select("id");
    if (error) throw new Error(error.message);

    if (scores && inserted) {
      const sentRows = inserted.map((row, i) => ({
        user_id: context.userId,
        news_id: row.id,
        sentiment_score: scores[i]?.sentiment_score ?? 0,
        bullish_score: scores[i]?.bullish_score ?? 0,
        bearish_score: scores[i]?.bearish_score ?? 0,
        impact_score: scores[i]?.impact_score ?? 0,
        rationale: scores[i]?.rationale ?? "",
      }));
      await context.supabase.from("sentiment").insert(sentRows);
    }
    return { inserted: fresh.length };
  });

export const listNews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ market_index: IndexEnum, limit: z.number().int().min(1).max(50).default(20) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("news")
      .select("id,title,url,source,summary,published_at,raw,sentiment(sentiment_score,bullish_score,bearish_score,impact_score,rationale)")
      .eq("user_id", context.userId)
      .order("published_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    const filtered = (rows ?? []).filter(
      (r) => (r.raw as { market_index?: string } | null)?.market_index === data.market_index,
    );
    return filtered.map((r) => {
      const s = Array.isArray(r.sentiment) ? r.sentiment[0] : r.sentiment;
      return {
        id: r.id,
        title: r.title,
        url: r.url,
        source: r.source,
        summary: r.summary,
        published_at: r.published_at,
        sentiment_score: s?.sentiment_score ?? null,
        bullish_score: s?.bullish_score ?? null,
        bearish_score: s?.bearish_score ?? null,
        impact_score: s?.impact_score ?? null,
        rationale: s?.rationale ?? null,
      };
    });
  });

export const getNewsSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ market_index: IndexEnum }).parse(input))
  .handler(async ({ data, context }) => {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: rows } = await context.supabase
      .from("news")
      .select("id,title,raw,sentiment(sentiment_score,bullish_score,bearish_score,impact_score)")
      .eq("user_id", context.userId)
      .gte("published_at", since)
      .order("published_at", { ascending: false })
      .limit(50);
    const filtered = (rows ?? []).filter(
      (r) => (r.raw as { market_index?: string } | null)?.market_index === data.market_index,
    );
    let bull = 0, bear = 0, impact = 0, count = 0, net = 0;
    for (const r of filtered) {
      const s = Array.isArray(r.sentiment) ? r.sentiment[0] : r.sentiment;
      if (!s) continue;
      bull += s.bullish_score ?? 0;
      bear += s.bearish_score ?? 0;
      impact += s.impact_score ?? 0;
      net += s.sentiment_score ?? 0;
      count++;
    }
    return {
      count,
      bullish: count ? bull / count : 0,
      bearish: count ? bear / count : 0,
      impact: count ? impact / count : 0,
      net: count ? net / count : 0,
      headlines_24h: filtered.length,
    };
  });

// ---------- Economic events ----------

const EventSchema = z.object({
  events: z.array(
    z.object({
      event_name: z.string().max(140),
      event_date: z.string().describe("YYYY-MM-DD or ISO datetime; best estimate of release/announcement date"),
      category: z.enum(["monetary_policy", "inflation", "growth", "trade", "employment", "global", "other"]),
      importance: z.enum(["low", "medium", "high"]),
      forecast: z.string().max(80).nullable(),
      previous: z.string().max(80).nullable(),
      actual: z.string().max(80).nullable(),
      summary: z.string().max(280),
    }),
  ),
});

export const refreshEconomicEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { fetchEconomicNews } = await import("./news.server");
    const items = await fetchEconomicNews(40);
    if (!items.length) return { inserted: 0 };

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY not configured");
    const { generateText, Output } = await import("ai");
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);

    const today = new Date().toISOString().slice(0, 10);
    const numbered = items
      .map((h, i) => `${i + 1}. [${h.published_at.slice(0, 10)}] ${h.title} — ${h.summary.slice(0, 160)}`)
      .join("\n");

    const result = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system: `You extract structured Indian & global economic events from news headlines. Focus on RBI policy, CPI, GDP, IIP, trade, FOMC, central bank actions. Today is ${today}. Estimate event_date when not explicit. Skip pure opinion pieces. Return UNIQUE events (dedupe across overlapping headlines). Importance: high = market-moving central bank/inflation/GDP, medium = secondary indicators, low = commentary.`,
      prompt: `Extract distinct economic events from these headlines:\n${numbered}`,
      experimental_output: Output.object({ schema: EventSchema }),
    });
    const out = result.experimental_output as z.infer<typeof EventSchema>;

    // Replace this user's recent extracted events (keep table fresh)
    await context.supabase
      .from("economic_events")
      .delete()
      .eq("user_id", context.userId)
      .gte("created_at", new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString());

    if (!out.events.length) return { inserted: 0 };

    const { error } = await context.supabase.from("economic_events").insert(
      out.events.map((e) => ({
        user_id: context.userId,
        event_name: e.event_name,
        event_date: e.event_date,
        category: e.category,
        importance: e.importance,
        forecast: e.forecast,
        previous: e.previous,
        actual: e.actual,
        meta: { summary: e.summary } as never,
      })),
    );
    if (error) throw new Error(error.message);
    return { inserted: out.events.length };
  });

export const listEconomicEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("economic_events")
      .select("*")
      .eq("user_id", context.userId)
      .order("event_date", { ascending: true })
      .limit(60);
    if (error) throw new Error(error.message);
    return data;
  });
