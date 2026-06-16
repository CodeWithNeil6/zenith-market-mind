import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listIntegrations } from "@/lib/integrations.functions";
import { PageHeader, EmptyState, StatusPill } from "@/components/AppShell";
import { Activity, Brain, Plug, TrendingUp } from "lucide-react";
import { indexLabel } from "@/lib/market";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — AI Algo" }] }),
  component: Dashboard,
});

function Dashboard() {
  const list = useServerFn(listIntegrations);
  const integrations = useQuery({
    queryKey: ["integrations"],
    queryFn: () => list({ data: undefined as never }),
  });

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

      {integrations.data && integrations.data.every((i) => i.status !== "connected") && (
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
