import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listEconomicEvents, refreshEconomicEvents } from "@/lib/news.functions";
import { PageHeader, EmptyState } from "@/components/AppShell";
import { Globe2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/economic")({
  head: () => ({ meta: [{ title: "Economic Intelligence — AI Algo" }] }),
  component: EconPage,
});

function EconPage() {
  const qc = useQueryClient();
  const list = useServerFn(listEconomicEvents);
  const refresh = useServerFn(refreshEconomicEvents);

  const events = useQuery({
    queryKey: ["economic-events"],
    queryFn: () => list({ data: undefined as never }),
  });

  const refreshMut = useMutation({
    mutationFn: () => refresh({ data: undefined as never }),
    onSuccess: (r) => {
      toast.success(`${r.inserted} events extracted`);
      qc.invalidateQueries({ queryKey: ["economic-events"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const items = events.data ?? [];
  const now = Date.now();
  const upcoming = items.filter((e) => e.event_date && new Date(e.event_date).getTime() >= now - 24 * 3600 * 1000);
  const past = items.filter((e) => e.event_date && new Date(e.event_date).getTime() < now - 24 * 3600 * 1000).reverse();

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Economic Intelligence"
        subtitle="RBI · CPI · GDP · FOMC · Rates — AI-extracted from live news"
        icon={Globe2}
        action={
          <Button size="sm" onClick={() => refreshMut.mutate()} disabled={refreshMut.isPending}>
            <RefreshCw className={`size-4 mr-1 ${refreshMut.isPending ? "animate-spin" : ""}`} />
            {refreshMut.isPending ? "Extracting…" : "Refresh events"}
          </Button>
        }
      />

      {events.isLoading ? (
        <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">Loading…</div>
      ) : !items.length ? (
        <EmptyState
          icon={Globe2}
          title="No economic events yet"
          description="Click Refresh — AI will scan global & Indian economic headlines (RBI, CPI, GDP, FOMC, etc.) and extract structured events with dates, forecasts, and importance."
          action={<Button onClick={() => refreshMut.mutate()} disabled={refreshMut.isPending}>Refresh now</Button>}
        />
      ) : (
        <div className="space-y-6">
          <Section title={`Upcoming & today (${upcoming.length})`} events={upcoming} />
          {past.length > 0 && <Section title={`Recent (${past.length})`} events={past} muted />}
        </div>
      )}
    </div>
  );
}

type Event = {
  id: string;
  event_name: string;
  event_date: string | null;
  category: string | null;
  importance: string | null;
  forecast: string | null;
  previous: string | null;
  actual: string | null;
  meta: unknown;
};

function Section({ title, events, muted }: { title: string; events: Event[]; muted?: boolean }) {
  if (!events.length) return null;
  return (
    <div>
      <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-2">{title}</h2>
      <div className={`glass rounded-2xl divide-y divide-white/5 ${muted ? "opacity-70" : ""}`}>
        {events.map((e) => {
          const summary = (e.meta as { summary?: string } | null)?.summary ?? "";
          const imp = e.importance ?? "low";
          return (
            <div key={e.id} className="p-4 grid grid-cols-12 gap-3 items-center">
              <div className="col-span-12 md:col-span-2">
                <div className="text-xs font-mono">{e.event_date ? new Date(e.event_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "TBD"}</div>
                <div className="text-[10px] text-muted-foreground uppercase mt-0.5">{e.category?.replace("_", " ")}</div>
              </div>
              <div className="col-span-12 md:col-span-7">
                <div className="text-sm font-medium">{e.event_name}</div>
                {summary && <div className="text-xs text-muted-foreground mt-1">{summary}</div>}
              </div>
              <div className="col-span-8 md:col-span-2 flex gap-3 text-xs font-mono text-muted-foreground">
                {e.previous && <span title="Previous">P:{e.previous}</span>}
                {e.forecast && <span title="Forecast">F:{e.forecast}</span>}
                {e.actual && <span className="text-foreground" title="Actual">A:{e.actual}</span>}
              </div>
              <div className="col-span-4 md:col-span-1 text-right">
                <span
                  className={`text-[10px] font-mono px-2 py-1 rounded-full uppercase ${
                    imp === "high" ? "bg-bearish-soft text-bearish"
                    : imp === "medium" ? "bg-yellow-500/10 text-yellow-400"
                    : "bg-white/5 text-muted-foreground"
                  }`}
                >
                  {imp}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
