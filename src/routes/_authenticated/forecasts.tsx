import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatusPill, EmptyState } from "@/components/AppShell";
import { LineChart } from "lucide-react";
import { indexLabel } from "@/lib/market";

export const Route = createFileRoute("/_authenticated/forecasts")({
  head: () => ({ meta: [{ title: "Forecasts — AI Algo" }] }),
  component: ForecastsPage,
});

function ForecastsPage() {
  const q = useQuery({
    queryKey: ["forecasts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forecasts").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });

  const resolved = (q.data ?? []).filter((f) => f.accuracy != null);
  const avgAccuracy = resolved.length
    ? resolved.reduce((a, b) => a + Number(b.accuracy ?? 0), 0) / resolved.length
    : null;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader title="Forecasts" subtitle="Predictions tracked over time" icon={LineChart} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card label="Total forecasts" value={q.data?.length ?? 0} />
        <Card label="Resolved" value={resolved.length} />
        <Card label="Avg accuracy" value={avgAccuracy != null ? `${avgAccuracy.toFixed(1)}%` : "—"} />
      </div>

      {!q.data?.length ? (
        <EmptyState title="No forecasts yet" description="Run an analysis to generate your first forecast." icon={LineChart} />
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5">
              <tr className="text-left text-xs uppercase tracking-widest text-muted-foreground">
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Index</th>
                <th className="px-4 py-3">Horizon</th>
                <th className="px-4 py-3">Direction</th>
                <th className="px-4 py-3 text-right">Predicted</th>
                <th className="px-4 py-3 text-right">Actual</th>
                <th className="px-4 py-3 text-right">Accuracy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {q.data.map((f) => (
                <tr key={f.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-muted-foreground">{new Date(f.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3">{indexLabel(f.market_index)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{f.horizon}</td>
                  <td className="px-4 py-3">
                    {f.direction && <StatusPill tone={f.direction as "bullish" | "bearish" | "neutral"}>{f.direction}</StatusPill>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{f.predicted_price ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono">{f.actual_price ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono">{f.accuracy != null ? `${f.accuracy}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Card({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="glass rounded-xl p-5">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-3xl font-mono mt-1">{value}</div>
    </div>
  );
}
