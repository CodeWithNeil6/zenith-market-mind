import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listIntegrations } from "@/lib/integrations.functions";
import { getLiveQuotes } from "@/lib/market.functions";
import { listNews, refreshNews, getNewsSummary, listEconomicEvents } from "@/lib/news.functions";
import { PageHeader, EmptyState, StatusPill } from "@/components/AppShell";
import { Activity, Brain, Plug, TrendingUp, Newspaper, Globe2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { indexLabel, INDICES } from "@/lib/market";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — AI Algo" }] }),
  component: Dashboard,
});

function Dashboard() {
  const qc = useQueryClient();
  const list = useServerFn(listIntegrations);
  const quotesFn = useServerFn(getLiveQuotes);
  const newsFn = useServerFn(listNews);
  const newsSummaryFn = useServerFn(getNewsSummary);
  const refreshNewsFn = useServerFn(refreshNews);
  const econFn = useServerFn(listEconomicEvents);

  const [newsIdx, setNewsIdx] = useState("NIFTY50");

  const integrations = useQuery({
    queryKey: ["integrations"],
    queryFn: () => list({ data: undefined as never }),
  });
  const connected = !!integrations.data?.find((i) => i.provider === "upstox");
  const quotes = useQuery({
    queryKey: ["live-quotes"],
    queryFn: () => quotesFn({ data: { indices: INDICES.map((i) => i.value) as never } }),
    enabled: connected,
    refetchInterval: 15000,
  });

  const newsList = useQuery({
    queryKey: ["news", newsIdx],
    queryFn: () => newsFn({ data: { market_index: newsIdx as never, limit: 6 } }),
  });
  const newsSummary = useQuery({
    queryKey: ["news-summary-dashboard", newsIdx],
    queryFn: () => newsSummaryFn({ data: { market_index: newsIdx as never } }),
  });
  const econ = useQuery({
    queryKey: ["economic-events"],
    queryFn: () => econFn({ data: undefined as never }),
  });

  const refreshNewsMut = useMutation({
    mutationFn: () => refreshNewsFn({ data: { market_index: newsIdx as never } }),
    onSuccess: (r) => {
      toast.success(r.inserted ? `${r.inserted} new headlines scored` : "Up to date");
      qc.invalidateQueries({ queryKey: ["news", newsIdx] });
      qc.invalidateQueries({ queryKey: ["news-summary-dashboard", newsIdx] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const upcomingEvents = (econ.data ?? [])
    .filter((e) => e.event_date && new Date(e.event_date).getTime() >= Date.now() - 24 * 3600 * 1000)
    .slice(0, 5);

  const recent = useQuery({
    queryKey: ["recent-analyses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analyses")
        .select("id,market_index,signal,direction,confidence,created_at")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
  });

  const stats = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [a, s, f] = await Promise.all([
        supabase.from("analyses").select("id", { count: "exact", head: true }),
        supabase.from("signals").select("id", { count: "exact", head: true }),
        supabase.from("forecasts").select("id", { count: "exact", head: true }),
      ]);
      return { analyses: a.count ?? 0, signals: s.count ?? 0, forecasts: f.count ?? 0 };
    },
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Dashboard"
        subtitle="Your live AI market intelligence terminal"
        icon={Activity}
        action={
          <Link
            to="/analysis"
            className="px-4 py-2 rounded-md bg-[color:var(--primary)] text-white text-sm hover:opacity-90"
          >
            Run new analysis
          </Link>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard label="Analyses" value={stats.data?.analyses ?? 0} icon={Brain} />
        <StatCard label="Signals" value={stats.data?.signals ?? 0} icon={TrendingUp} />
        <StatCard label="Forecasts" value={stats.data?.forecasts ?? 0} icon={Activity} />
      </div>

      {connected && quotes.data?.connected && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
          {quotes.data.quotes.map((q) => (
            <div key={q.symbol} className="glass rounded-xl p-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{indexLabel(q.symbol)}</div>
              {q.ok ? (
                <>
                  <div className="text-base font-mono mt-1">{q.ltp.toFixed(2)}</div>
                  <div className={`text-xs font-mono ${q.change >= 0 ? "text-bullish" : "text-bearish"}`}>
                    {q.change >= 0 ? "+" : ""}{q.change.toFixed(2)} ({q.changePct.toFixed(2)}%)
                  </div>
                </>
              ) : (
                <div className="text-xs text-muted-foreground mt-1">{q.error}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {integrations.data && !integrations.data.some((i) => i.provider === "upstox") && (
        <div className="glass rounded-xl p-4 mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Plug className="size-5 text-[color:var(--accent)]" />
            <div>
              <div className="text-sm font-medium">Connect a market data provider</div>
              <div className="text-xs text-muted-foreground">
                Upstox provides live NSE/BSE quotes and option chain. Without it, AI analysis runs
                without live prices.
              </div>
            </div>
          </div>
          <Link
            to="/integrations"
            className="text-sm px-3 py-2 rounded-md border border-white/10 hover:bg-white/5"
          >
            Connect
          </Link>
        </div>
      )}

      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Recent analyses</h2>
          <Link to="/signals" className="text-xs text-muted-foreground hover:text-foreground">
            View all signals →
          </Link>
        </div>
        {recent.isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : !recent.data?.length ? (
          <EmptyState
            title="No analyses yet"
            description="Run your first AI analysis to see signals, forecasts and confidence here."
            icon={Brain}
            action={
              <Link
                to="/analysis"
                className="px-4 py-2 rounded-md bg-[color:var(--primary)] text-white text-sm"
              >
                Run analysis
              </Link>
            }
          />
        ) : (
          <div className="divide-y divide-white/5">
            {recent.data.map((r) => (
              <div key={r.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">{indexLabel(r.market_index)}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusPill tone={r.direction === "bullish" ? "bullish" : r.direction === "bearish" ? "bearish" : "neutral"}>
                    {r.signal}
                  </StatusPill>
                  <div className="text-sm font-mono w-12 text-right">{Math.round(Number(r.confidence ?? 0))}%</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* News sentiment + economic events */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="glass rounded-2xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Newspaper className="size-4 text-[color:var(--primary)]" />
              <h2 className="font-semibold">News & Sentiment</h2>
            </div>
            <div className="flex items-center gap-2">
              <Select value={newsIdx} onValueChange={setNewsIdx}>
                <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INDICES.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={() => refreshNewsMut.mutate()} disabled={refreshNewsMut.isPending}>
                <RefreshCw className={`size-3.5 mr-1 ${refreshNewsMut.isPending ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Link to="/news" className="text-xs text-muted-foreground hover:text-foreground">All →</Link>
            </div>
          </div>

          {newsSummary.data && newsSummary.data.count > 0 && (
            <div className="grid grid-cols-4 gap-2 mb-3 text-xs">
              <SentTile label="Bull" value={newsSummary.data.bullish.toFixed(0)} tone="bullish" />
              <SentTile label="Bear" value={newsSummary.data.bearish.toFixed(0)} tone="bearish" />
              <SentTile label="Impact" value={newsSummary.data.impact.toFixed(0)} />
              <SentTile label="24h" value={String(newsSummary.data.headlines_24h)} />
            </div>
          )}

          {newsList.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : !newsList.data?.length ? (
            <div className="text-sm text-muted-foreground py-3">
              No headlines yet. Click <b>Refresh</b> to pull and AI-score live news for {indexLabel(newsIdx)}.
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {newsList.data.map((n) => {
                const s = n.sentiment_score;
                const tone = s == null ? "neutral" : s > 0.1 ? "bullish" : s < -0.1 ? "bearish" : "neutral";
                return (
                  <a key={n.id} href={n.url ?? "#"} target="_blank" rel="noreferrer" className="py-2.5 flex items-start justify-between gap-3 hover:bg-white/5 -mx-2 px-2 rounded">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium leading-snug line-clamp-2">{n.title}</div>
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {n.source} · {n.published_at ? new Date(n.published_at).toLocaleString() : ""}
                      </div>
                    </div>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-mono shrink-0 ${
                      tone === "bullish" ? "bg-bullish-soft text-bullish"
                      : tone === "bearish" ? "bg-bearish-soft text-bearish"
                      : "bg-white/5 text-muted-foreground"
                    }`}>
                      {s == null ? "—" : (s > 0 ? "+" : "") + s.toFixed(2)}
                    </span>
                  </a>
                );
              })}
            </div>
          )}
        </div>

        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Globe2 className="size-4 text-[color:var(--primary)]" />
              <h2 className="font-semibold">Economic events</h2>
            </div>
            <Link to="/economic" className="text-xs text-muted-foreground hover:text-foreground">All →</Link>
          </div>
          {!upcomingEvents.length ? (
            <div className="text-sm text-muted-foreground">
              No events loaded. Open <Link to="/economic" className="text-[color:var(--accent)] hover:underline">Economic Intelligence</Link> and click Refresh.
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingEvents.map((e) => (
                <div key={e.id} className="border border-white/5 rounded-lg p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-mono text-muted-foreground">
                      {e.event_date ? new Date(e.event_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "TBD"}
                    </div>
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded uppercase ${
                      e.importance === "high" ? "bg-bearish-soft text-bearish"
                      : e.importance === "medium" ? "bg-yellow-500/10 text-yellow-400"
                      : "bg-white/5 text-muted-foreground"
                    }`}>{e.importance ?? "low"}</span>
                  </div>
                  <div className="text-sm font-medium mt-1 leading-snug">{e.event_name}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SentTile({ label, value, tone }: { label: string; value: string; tone?: "bullish" | "bearish" }) {
  const t = tone === "bullish" ? "text-bullish" : tone === "bearish" ? "text-bearish" : "";
  return (
    <div className="bg-white/5 rounded-lg p-2 text-center">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`text-base font-mono ${t}`}>{value}</div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="glass rounded-xl p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
        <Icon className="size-4 text-[color:var(--primary)]" />
      </div>
      <div className="text-3xl font-semibold mt-2 font-mono">{value}</div>
    </div>
  );
}
