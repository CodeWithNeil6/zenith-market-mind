import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listIntegrations } from "@/lib/integrations.functions";
import { getOptionExpiries, pullOptionChain } from "@/lib/market.functions";
import { PageHeader, EmptyState } from "@/components/AppShell";
import { BarChart3, Plug, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  const upstox = integrations.data?.find((i) => i.provider === "upstox" && i.status === "connected");

  const [idx, setIdx] = useState("NIFTY50");
  const [expiry, setExpiry] = useState<string | null>(null);

  const expiries = useQuery({
    queryKey: ["expiries", idx],
    queryFn: () => expiriesFn({ data: { market_index: idx as never } }),
    enabled: !!upstox,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const list = expiries.data?.expiries;
    if (list && list.length && (!expiry || !list.includes(expiry))) setExpiry(list[0]);
  }, [expiries.data, expiry]);

  const chain = useMutation({
    mutationFn: () => pull({ data: { market_index: idx as never, expiry: expiry! } }) as Promise<Chain>,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to load chain"),
  });

  useEffect(() => {
    if (upstox && expiry) chain.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, expiry, upstox?.id]);

  const data = chain.data;
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
            <Button size="sm" variant="outline" onClick={() => chain.mutate()} disabled={!upstox || !expiry || chain.isPending}>
              <RefreshCw className={`size-4 mr-1 ${chain.isPending ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        }
      />

      {!upstox ? (
        <EmptyState
          icon={Plug}
          title="Connect Upstox to load the option chain"
          description="Live NSE option chain requires an Upstox access token. AI Algo only reads market data — it never places trades."
          action={
            <Link to="/integrations" className="px-4 py-2 rounded-md bg-[color:var(--primary)] text-white text-sm">
              Connect Upstox
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
