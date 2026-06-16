import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatusPill, EmptyState } from "@/components/AppShell";
import { TrendingUp } from "lucide-react";
import { indexLabel } from "@/lib/market";

export const Route = createFileRoute("/_authenticated/signals")({
  head: () => ({ meta: [{ title: "Signals — AI Algo" }] }),
  component: SignalsPage,
});

function SignalsPage() {
  const q = useQuery({
    queryKey: ["signals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signals")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader title="Signals" subtitle="Every AI-generated call across your sessions" icon={TrendingUp} />
      {q.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : !q.data?.length ? (
        <EmptyState title="No signals yet" description="Run an analysis to generate your first signal." icon={TrendingUp} />
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5">
              <tr className="text-left text-xs uppercase tracking-widest text-muted-foreground">
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Index</th>
                <th className="px-4 py-3">Signal</th>
                <th className="px-4 py-3 text-right">Confidence</th>
                <th className="px-4 py-3 text-right">Entry</th>
                <th className="px-4 py-3 text-right">SL</th>
                <th className="px-4 py-3 text-right">T1</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {q.data.map((s) => (
                <tr key={s.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-muted-foreground">{new Date(s.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 font-medium">{indexLabel(s.market_index)}</td>
                  <td className="px-4 py-3">
                    <StatusPill tone={["BUY", "CALL"].includes(s.signal) ? "bullish" : ["SELL", "PUT"].includes(s.signal) ? "bearish" : "neutral"}>
                      {s.signal}
                    </StatusPill>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{Math.round(Number(s.confidence ?? 0))}%</td>
                  <td className="px-4 py-3 text-right font-mono">{s.entry ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono text-bearish">{s.stop_loss ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono text-bullish">{s.target1 ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{s.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
