import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const IndexEnum = z.enum(["NIFTY50", "BANKNIFTY", "SENSEX", "FINNIFTY", "MIDCPNIFTY", "NIFTYNXT50"]);

async function getUpstoxToken(supabase: {
  from: (t: string) => {
    select: (s: string) => {
      eq: (
        c: string,
        v: string,
      ) => {
        eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: { credentials: { access_token?: string | null } } | null }> };
      };
    };
  };
}, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("integrations")
    .select("credentials")
    .eq("user_id", userId)
    .eq("provider", "upstox")
    .maybeSingle();
  const tok = data?.credentials?.access_token;
  return tok ? String(tok) : null;
}

export const getLiveQuotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ indices: z.array(IndexEnum).min(1).max(6) }).parse(input))
  .handler(async ({ data, context }) => {
    const token = await getUpstoxToken(context.supabase as never, context.userId);
    if (!token) return { connected: false as const, quotes: [] };
    const { fetchQuote } = await import("./upstox.server");
    const out = await Promise.allSettled(data.indices.map((i) => fetchQuote(token, i)));
    return {
      connected: true as const,
      quotes: out.map((r, i) =>
        r.status === "fulfilled"
          ? { ok: true as const, ...r.value }
          : { ok: false as const, symbol: data.indices[i], error: r.reason instanceof Error ? r.reason.message : "Failed" },
      ),
    };
  });

export const getOptionExpiries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ market_index: IndexEnum }).parse(input))
  .handler(async ({ data, context }) => {
    const token = await getUpstoxToken(context.supabase as never, context.userId);
    if (!token) throw new Error("Upstox not connected");
    const { fetchExpiries } = await import("./upstox.server");
    return { expiries: await fetchExpiries(token, data.market_index) };
  });

export const pullOptionChain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ market_index: IndexEnum, expiry: z.string().min(8) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const token = await getUpstoxToken(context.supabase as never, context.userId);
    if (!token) throw new Error("Upstox not connected. Save an Upstox access token in Integrations.");
    const { fetchOptionChain } = await import("./upstox.server");
    const chain = await fetchOptionChain(token, data.market_index, data.expiry);

    await context.supabase.from("option_chain").insert({
      user_id: context.userId,
      market_index: data.market_index,
      expiry: data.expiry,
      spot: chain.spot,
      pcr: chain.pcr,
      max_pain: chain.max_pain,
      rows: chain.rows as unknown as object,
    });

    return chain;
  });
