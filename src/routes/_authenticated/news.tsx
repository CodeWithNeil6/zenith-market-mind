import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listNews, refreshNews, getNewsSummary } from "@/lib/news.functions";
import { PageHeader, EmptyState } from "@/components/AppShell";
import { Newspaper, RefreshCw, TrendingUp, TrendingDown, Zap } from "lucide-react";
import { useState } from "react";
import { INDICES } from "@/lib/market";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/news")({
  head: () => ({ meta: [{ title: "News Intelligence — AI Algo" }] }),
  component: NewsPage,
});

function NewsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listNews);
  const refresh = useServerFn(refreshNews);
  const summaryFn = useServerFn(getNewsSummary);

  const [idx, setIdx] = useState("NIFTY50");

  const news = useQuery({
    queryKey: ["news", idx],
    queryFn: () => list({ data: { market_index: idx as never, limit: 30 } }),
  });
  const summary = useQuery({
    queryKey: ["news-summary", idx],
    queryFn: () => summaryFn({ data: { market_index: idx as never } }),
  });

  const refreshMut = useMutation({
    mutationFn: () => refresh({ data: { market_index: idx as never } }),
    onSuccess: (r) => {
      toast.success(r.inserted ? `${r.inserted} new headlines scored` : "No new headlines");
      qc.invalidateQueries({ queryKey: ["news", idx] });
      qc.invalidateQueries({ queryKey: ["news-summary", idx] });
      qc.invalidateQueries({ queryKey: ["news-summary-dashboard"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const items = news.data ?? [];

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="News Intelligence"
        subtitle="Live headlines scored by AI for impact & sentiment"
        icon={Newspaper}
        action={
          <div className="flex gap-2 items-center">
            <Select value={idx} onValueChange={setIdx}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {INDICES.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => refreshMut.mutate()} disabled={refreshMut.isPending}>
              <RefreshCw className={`size-4 mr-1 ${refreshMut.isPending ? "animate-spin" : ""}`} />
              {refreshMut.isPending ? "Scoring…" : "Refresh"}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <SummaryCard label="Bullish (avg)" value={summary.data?.bullish ?? 0} icon={TrendingUp} tone="bullish" />
        <SummaryCard label="Bearish (avg)" value={summary.data?.bearish ?? 0} icon={TrendingDown} tone="bearish" />
        <SummaryCard label="Impact (avg)" value={summary.data?.impact ?? 0} icon={Zap} />
        <SummaryCard label="Headlines (24h)" value={summary.data?.headlines_24h ?? 0} icon={Newspaper} raw />
      </div>

      {news.isLoading ? (
        <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">Loading headlines…</div>
      ) : !items.length ? (
        <EmptyState
          icon={Newspaper}
          title="No headlines yet"
          description="Click Refresh to pull the latest Indian market headlines and score them with AI."
          action={<Button onClick={() => refreshMut.mutate()} disabled={refreshMut.isPending}>Refresh now</Button>}
        />
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const score = n.sentiment_score;
            const tone = score == null ? "" : score > 0.1 ? "bullish" : score < -0.1 ? "bearish" : "neutral";
            return (
              <a
                key={n.id}
                href={n.url ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="glass rounded-xl p-4 block hover:bg-white/5 transition"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium leading-snug">{n.title}</div>
                    {n.rationale && (
                      <div className="text-xs text-muted-foreground mt-1.5">{n.rationale}</div>
                    )}
                    <div className="text-[11px] text-muted-foreground mt-2 flex items-center gap-2">
                      <span>{n.source}</span>
                      <span>·</span>
                      <span>{n.published_at ? new Date(n.published_at).toLocaleString() : ""}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-mono ${
                        tone === "bullish" ? "bg-bullish-soft text-bullish"
                        : tone === "bearish" ? "bg-bearish-soft text-bearish"
                        : "bg-white/5 text-muted-foreground"
                      }`}
                    >
                      {score == null ? "—" : (score > 0 ? "+" : "") + score.toFixed(2)}
                    </span>
                    {n.impact_score != null && (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        impact {Math.round(n.impact_score)}
                      </span>
                    )}
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label, value, icon: Icon, tone, raw,
}: {
  label: string; value: number; icon: React.ComponentType<{ className?: string }>;
  tone?: "bullish" | "bearish"; raw?: boolean;
}) {
  const t = tone === "bullish" ? "text-bullish" : tone === "bearish" ? "text-bearish" : "";
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <Icon className={`size-4 ${t || "text-muted-foreground"}`} />
      </div>
      <div className={`text-2xl font-mono mt-1 ${t}`}>
        {raw ? value : value.toFixed(1)}
      </div>
    </div>
  );
}
