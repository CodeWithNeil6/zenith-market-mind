import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listIntegrations } from "@/lib/integrations.functions";
import { getOptionExpiries, pullOptionChain, getOptionFeedSession } from "@/lib/market.functions";
import { connectUpstoxOptionFeed, type Tick } from "@/lib/upstox-feed";
import { PageHeader, EmptyState } from "@/components/AppShell";
import { BarChart3, Plug, RefreshCw, Radio } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { INDICES } from "@/lib/market";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/option-chain")({
  head: () => ({ meta: [{ title: "Option Chain — AI Algo" }] }),
  component: OptionChainPage,
});

type Leg = {
  ltp: number; oi: number; oi_change: number; volume: number;
  iv: number; delta: number; gamma: number; theta: number; vega: number;
};
type Row = { strike: number; call: Leg; put: Leg };
type Chain = { spot: number; expiry: string; rows: Row[]; pcr: number; max_pain: number; total_call_oi: number; total_put_oi: number };

function OptionChainPage() {
  const list = useServerFn(listIntegrations);
  const expiriesFn = useServerFn(getOptionExpiries);
  const pull = useServerFn(pullOptionChain);

  const integrations = useQuery({ queryKey: ["integrations"], queryFn: () => list({ data: undefined as never }) });
  const upstox = integrations.data?.find((i) => i.provider === "upstox");
  const hasToken = (upstox?.meta as { has_access_token?: boolean } | null)?.has_access_token !== false;
  console.log("[option-chain] integration check", { loading: integrations.isLoading, found: !!upstox, status: upstox?.status, hasToken });

  const [idx, setIdx] = useState("NIFTY50");
  const [expiry, setExpiry] = useState<string | null>(null);

  const expiries = useQuery({
    queryKey: ["expiries", idx],
    queryFn: () => expiriesFn({ data: { market_index: idx as never } }),
    enabled: !!upstox && hasToken,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    const list = expiries.data?.expiries;
    if (list && list.length && (!expiry || !list.includes(expiry))) setExpiry(list[0]);
  }, [expiries.data, expiry]);

  useEffect(() => {
    if (expiries.error) toast.error(expiries.error instanceof Error ? expiries.error.message : "Failed to load expiries");
  }, [expiries.error]);

  const chain = useMutation({
    mutationFn: () => pull({ data: { market_index: idx as never, expiry: expiry! } }) as Promise<Chain>,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to load chain"),
  });

  // Slow REST re-seed (30s) so OI/baseline drifts catch up even without ticks.
  useEffect(() => {
    if (!(upstox && hasToken && expiry)) return;
    chain.mutate();
    const id = setInterval(() => {
      if (document.visibilityState === "visible" && !chain.isPending) chain.mutate();
    }, 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, expiry, upstox?.id, hasToken]);

  // === Live Upstox V3 Market Data Feed (WebSocket, tick-by-tick) ===
  const feedSession = useServerFn(getOptionFeedSession);
  const [ticks, setTicks] = useState<Map<string, Tick>>(() => new Map());
  const [feedStatus, setFeedStatus] = useState<"idle" | "connecting" | "live" | "closed" | "error">("idle");
  const reconnectRef = useRef(0);

  useEffect(() => {
    if (!(upstox && hasToken && expiry)) return;
    let cancelled = false;
    let handle: { close: () => void } | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const start = async () => {
      try {
        setFeedStatus("connecting");
        const session = await feedSession({ data: { market_index: idx as never, expiry } });
        if (cancelled) return;
        const instrumentKeys = session.contracts.flatMap((c) => [c.call_key, c.put_key]);
        handle = connectUpstoxOptionFeed({
          wsUrl: session.ws_url,
          underlyingKey: session.underlying_key,
          instrumentKeys,
          onEvent: (ev) => {
            if (ev.kind === "status") {
              if (ev.status === "open") { setFeedStatus("live"); reconnectRef.current = 0; }
              else if (ev.status === "closed") {
                setFeedStatus("closed");
                if (!cancelled) {
                  const delay = Math.min(1000 * 2 ** reconnectRef.current++, 15_000);
                  retryTimer = setTimeout(start, delay);
                }
              } else if (ev.status === "error") setFeedStatus("error");
              return;
            }
            // tick
            setTicks((prev) => {
              const next = new Map(prev);
              next.set(ev.instrument_key, ev.tick);
              return next;
            });
          },
        });
      } catch (e) {
        console.error("[option-chain] feed start failed", e);
        setFeedStatus("error");
        if (!cancelled) {
          const delay = Math.min(1000 * 2 ** reconnectRef.current++, 15_000);
          retryTimer = setTimeout(start, delay);
        }
      }
    };

    setTicks(new Map());
    start();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      handle?.close();
      setFeedStatus("idle");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, expiry, upstox?.id, hasToken]);

  // Merge live ticks into the REST-seeded chain. Recomputed on every tick.
  const data = useMemo<Chain | undefined>(() => {
    const seed = chain.data;
    if (!seed) return undefined;
    if (ticks.size === 0) return seed;
    // Build instrument_key → (strike, side) map from the seed.
    // The REST chain doesn't carry instrument_keys, so we attach them via the
    // feed session in a separate ref-keyed map.
    const liveRows = seed.rows.map((r) => {
      const callKey = contractKeysRef.current.get(`${r.strike}|CE`);
      const putKey = contractKeysRef.current.get(`${r.strike}|PE`);
      const cTick = callKey ? ticks.get(callKey) : undefined;
      const pTick = putKey ? ticks.get(putKey) : undefined;
      return {
        strike: r.strike,
        call: cTick ? { ...r.call, ltp: cTick.ltp || r.call.ltp, oi: cTick.oi || r.call.oi, iv: cTick.iv || r.call.iv, volume: cTick.volume || r.call.volume, delta: cTick.delta || r.call.delta, gamma: cTick.gamma || r.call.gamma, theta: cTick.theta || r.call.theta, vega: cTick.vega || r.call.vega } : r.call,
        put: pTick ? { ...r.put, ltp: pTick.ltp || r.put.ltp, oi: pTick.oi || r.put.oi, iv: pTick.iv || r.put.iv, volume: pTick.volume || r.put.volume, delta: pTick.delta || r.put.delta, gamma: pTick.gamma || r.put.gamma, theta: pTick.theta || r.put.theta, vega: pTick.vega || r.put.vega } : r.put,
      };
    });
    const underlying = underlyingKeyRef.current ? ticks.get(underlyingKeyRef.current) : undefined;
    const total_call_oi = liveRows.reduce((s, r) => s + r.call.oi, 0);
    const total_put_oi = liveRows.reduce((s, r) => s + r.put.oi, 0);
    return {
      ...seed,
      rows: liveRows,
      spot: underlying?.ltp || seed.spot,
      total_call_oi,
      total_put_oi,
      pcr: total_call_oi ? total_put_oi / total_call_oi : seed.pcr,
    };
  }, [chain.data, ticks]);

  // Track contract instrument_keys per strike for the merge above.
  const contractKeysRef = useRef<Map<string, string>>(new Map());
  const underlyingKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!(upstox && hasToken && expiry)) return;
    let cancelled = false;
    feedSession({ data: { market_index: idx as never, expiry } })
      .then((s) => {
        if (cancelled) return;
        const m = new Map<string, string>();
        for (const c of s.contracts) {
          m.set(`${c.strike}|CE`, c.call_key);
          m.set(`${c.strike}|PE`, c.put_key);
        }
        contractKeysRef.current = m;
        underlyingKeyRef.current = s.underlying_key;
      })
      .catch(() => { /* feed effect already surfaces this */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, expiry, upstox?.id, hasToken]);

  const atmStrike = useMemo(() => {
    if (!data?.rows.length) return null;
    return data.rows.reduce((p, c) =>
      Math.abs(c.strike - data.spot) < Math.abs(p.strike - data.spot) ? c : p,
    ).strike;
  }, [data]);

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Option Chain Terminal"
        subtitle="Strikes, OI, PCR, Max Pain & Greeks via Upstox"
        icon={BarChart3}
        action={
          <div className="flex gap-2 items-center">
            <Select value={idx} onValueChange={setIdx}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {INDICES.filter((i) => ["NIFTY50", "BANKNIFTY", "FINNIFTY", "SENSEX"].includes(i.value)).map((i) => (
                  <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {expiries.data?.expiries.length ? (
              <Select value={expiry ?? ""} onValueChange={setExpiry}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Expiry" /></SelectTrigger>
                <SelectContent>
                  {expiries.data.expiries.map((e) => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <span
              title={`Feed: ${feedStatus}`}
              className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border ${
                feedStatus === "live"
                  ? "border-bullish/40 text-bullish bg-bullish-soft"
                  : feedStatus === "connecting"
                  ? "border-white/20 text-muted-foreground"
                  : feedStatus === "error"
                  ? "border-bearish/40 text-bearish"
                  : "border-white/15 text-muted-foreground"
              }`}
            >
              <Radio className={`size-3 ${feedStatus === "live" ? "animate-pulse" : ""}`} />
              {feedStatus === "live" ? "LIVE" : feedStatus === "connecting" ? "…" : feedStatus === "error" ? "OFF" : "—"}
            </span>
            <Button size="sm" variant="outline" onClick={() => chain.mutate()} disabled={!upstox || !expiry || chain.isPending}>
              <RefreshCw className={`size-4 mr-1 ${chain.isPending ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        }
      />

      {integrations.isLoading ? (
        <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">Checking Upstox connection…</div>
      ) : !upstox ? (
        <EmptyState
          icon={Plug}
          title="Connect Upstox to load the option chain"
          description="Live NSE option chain requires Upstox credentials. AI Algo only reads market data — it never places trades."
          action={
            <Link to="/integrations" className="px-4 py-2 rounded-md bg-[color:var(--primary)] text-white text-sm">
              Connect Upstox
            </Link>
          }
        />
      ) : !hasToken ? (
        <EmptyState
          icon={Plug}
          title="Upstox access token required"
          description="Your Upstox API key and secret are saved, but a daily access token is needed to fetch live option chain data. Generate a token from your Upstox developer console and paste it on the Integrations page."
          action={
            <Link to="/integrations" className="px-4 py-2 rounded-md bg-[color:var(--primary)] text-white text-sm">
              Add access token
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Stat label="Spot" value={data ? data.spot.toFixed(2) : "—"} />
            <Stat label="PCR" value={data ? data.pcr.toFixed(2) : "—"}
              tone={data ? (data.pcr > 1.2 ? "bullish" : data.pcr < 0.8 ? "bearish" : undefined) : undefined} />
            <Stat label="Max Pain" value={data ? data.max_pain.toFixed(0) : "—"} />
            <Stat label="Total OI (C / P)" value={data ? `${fmt(data.total_call_oi)} / ${fmt(data.total_put_oi)}` : "—"} />
          </div>

          <div className="glass rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead className="bg-white/5 text-muted-foreground">
                  <tr>
                    <Th colSpan={5} className="text-bullish">CALLS</Th>
                    <Th className="text-center bg-white/5">STRIKE</Th>
                    <Th colSpan={5} className="text-bearish">PUTS</Th>
                  </tr>
                  <tr>
                    <Th>OI</Th><Th>ΔOI</Th><Th>Vol</Th><Th>IV</Th><Th>LTP</Th>
                    <Th className="text-center bg-white/5">Strike</Th>
                    <Th>LTP</Th><Th>IV</Th><Th>Vol</Th><Th>ΔOI</Th><Th>OI</Th>
                  </tr>
                </thead>
                <tbody>
                  {chain.isPending && !data ? (
                    <tr><td colSpan={11} className="p-8 text-center text-muted-foreground">Loading chain…</td></tr>
                  ) : !data?.rows.length ? (
                    <tr><td colSpan={11} className="p-8 text-center text-muted-foreground">No data</td></tr>
                  ) : (
                    data.rows.map((r) => {
                      const itmCall = r.strike < data.spot;
                      const itmPut = r.strike > data.spot;
                      const isAtm = r.strike === atmStrike;
                      return (
                        <tr key={r.strike} className={`border-t border-white/5 ${isAtm ? "bg-[color:var(--primary)]/10" : ""}`}>
                          <Td highlight={itmCall}>{fmt(r.call.oi)}</Td>
                          <Td tone={r.call.oi_change}>{signed(r.call.oi_change)}</Td>
                          <Td highlight={itmCall}>{fmt(r.call.volume)}</Td>
                          <Td highlight={itmCall}>{r.call.iv.toFixed(1)}</Td>
                          <Td highlight={itmCall} bold>{r.call.ltp.toFixed(2)}</Td>
                          <Td center className={`bg-white/5 ${isAtm ? "font-bold text-[color:var(--accent)]" : ""}`}>{r.strike}</Td>
                          <Td highlight={itmPut} bold>{r.put.ltp.toFixed(2)}</Td>
                          <Td highlight={itmPut}>{r.put.iv.toFixed(1)}</Td>
                          <Td highlight={itmPut}>{fmt(r.put.volume)}</Td>
                          <Td tone={r.put.oi_change}>{signed(r.put.oi_change)}</Td>
                          <Td highlight={itmPut}>{fmt(r.put.oi)}</Td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "bullish" | "bearish" }) {
  const t = tone === "bullish" ? "text-bullish" : tone === "bearish" ? "text-bearish" : "";
  return (
    <div className="glass rounded-xl p-4">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`text-xl font-mono mt-1 ${t}`}>{value}</div>
    </div>
  );
}
function Th({ children, className = "", colSpan }: { children: React.ReactNode; className?: string; colSpan?: number }) {
  return <th colSpan={colSpan} className={`px-2 py-2 text-right font-medium ${className}`}>{children}</th>;
}
function Td({ children, highlight, tone, bold, center, className = "" }: {
  children: React.ReactNode; highlight?: boolean; tone?: number; bold?: boolean; center?: boolean; className?: string;
}) {
  const t = tone == null ? "" : tone > 0 ? "text-bullish" : tone < 0 ? "text-bearish" : "";
  return (
    <td className={`px-2 py-1.5 ${center ? "text-center" : "text-right"} ${highlight ? "bg-white/[0.03]" : ""} ${bold ? "font-semibold" : ""} ${t} ${className}`}>
      {children}
    </td>
  );
}
function fmt(n: number) { return n >= 1e7 ? (n / 1e7).toFixed(2) + "Cr" : n >= 1e5 ? (n / 1e5).toFixed(2) + "L" : n >= 1e3 ? (n / 1e3).toFixed(1) + "k" : String(n); }
function signed(n: number) { return (n > 0 ? "+" : "") + fmt(n); }
