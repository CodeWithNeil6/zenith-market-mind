import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { runAnalysis } from "@/lib/ai.functions";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatusPill } from "@/components/AppShell";
import { Brain, Loader2, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { HORIZONS, INDICES, RISKS, STYLES, indexLabel } from "@/lib/market";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/analysis")({
  head: () => ({ meta: [{ title: "AI Analysis — AI Algo" }] }),
  component: AnalysisPage,
});

function AnalysisPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const run = useServerFn(runAnalysis);

  const [marketIndex, setMarketIndex] = useState<string>("NIFTY50");
  const [style, setStyle] = useState<string>("intraday");
  const [risk, setRisk] = useState<string>("moderate");
  const [horizon, setHorizon] = useState<string>("same_day");
  const [capital, setCapital] = useState<string>("100000");
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      run({
        data: {
          market_index: marketIndex as "NIFTY50",
          style: style as "intraday",
          risk: risk as "moderate",
          horizon: horizon as "same_day",
          capital: Number(capital),
          notes: notes || undefined,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["latest-analysis"] });
      qc.invalidateQueries({ queryKey: ["recent-analyses"] });
      toast.success("Analysis complete");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Analysis failed"),
  });

  const latest = useQuery({
    queryKey: ["latest-analysis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analyses").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const result = mutation.data ?? latest.data;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="AI Analysis"
        subtitle="Dynamic factor weighting across technicals, options, news & macro"
        icon={Brain}
      />

      <div className="grid lg:grid-cols-[400px_1fr] gap-6">
        <form
          onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
          className="glass rounded-2xl p-5 space-y-4 h-fit"
        >
          <Field label="Index">
            <Select value={marketIndex} onValueChange={setMarketIndex}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {INDICES.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Trading style">
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STYLES.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Risk profile">
              <Select value={risk} onValueChange={setRisk}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RISKS.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Time horizon">
              <Select value={horizon} onValueChange={setHorizon}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HORIZONS.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Capital (₹)">
            <Input
              type="number" min={1000} step={1000} required
              value={capital} onChange={(e) => setCapital(e.target.value)}
            />
          </Field>
          <Field label="Context (optional)">
            <Textarea
              placeholder="e.g. RBI policy at 10am, FII selling yesterday"
              value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={500}
            />
          </Field>
          <Button type="submit" disabled={mutation.isPending} className="w-full">
            {mutation.isPending ? (<><Loader2 className="size-4 mr-2 animate-spin" />Analyzing…</>) : "Run AI analysis"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Educational analysis only. No trade execution.
          </p>
        </form>

        <div>
          {!result ? (
            <div className="glass rounded-2xl p-10 text-center">
              <Brain className="size-10 mx-auto text-[color:var(--primary)] mb-3 opacity-60" />
              <h3 className="font-semibold">Run your first analysis</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Fill the form and the AI reasoning engine will produce a signal, confidence, weights & risk plan.
              </p>
            </div>
          ) : (
            <AnalysisResult a={result} />
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block">{label}</Label>
      {children}
    </div>
  );
}

function AnalysisResult({ a }: { a: any }) {
  const dir = a.direction as "bullish" | "bearish" | "neutral" | null;
  return (
    <div className="space-y-4">
      <div className="glass-strong rounded-2xl p-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              {indexLabel(a.market_index)} · {a.style} · {a.horizon}
            </div>
            <div className="mt-2 flex items-center gap-3">
              <div className="text-4xl font-semibold font-mono">{a.signal}</div>
              {dir && <StatusPill tone={dir}>{dir.toUpperCase()}</StatusPill>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Confidence</div>
            <div className="text-4xl font-semibold font-mono">{Math.round(Number(a.confidence ?? 0))}%</div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat label="Entry" v={a.entry} />
          <Stat label="Stop Loss" v={a.stop_loss} tone="bearish" />
          <Stat label="Target 1" v={a.target1} tone="bullish" />
          <Stat label="Target 2" v={a.target2} tone="bullish" />
          <Stat label="Target 3" v={a.target3} tone="bullish" />
        </div>
        {a.risk_reward != null && (
          <div className="mt-3 text-sm text-muted-foreground flex items-center gap-2">
            <Target className="size-4" /> Risk:Reward {Number(a.risk_reward).toFixed(2)}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="glass rounded-2xl p-5">
          <h3 className="font-semibold mb-3">Factor weighting</h3>
          <WeightBars weights={a.weights ?? {}} />
        </div>
        <div className="glass rounded-2xl p-5">
          <h3 className="font-semibold mb-2">Market summary</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.market_summary}</p>
        </div>
      </div>

      <div className="glass rounded-2xl p-5">
        <h3 className="font-semibold mb-2">Reasoning</h3>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.reasoning}</p>
      </div>
      <div className="glass rounded-2xl p-5">
        <h3 className="font-semibold mb-2">Risk analysis</h3>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.risk_analysis}</p>
      </div>
    </div>
  );
}

function Stat({ label, v, tone }: { label: string; v: number | null; tone?: "bullish" | "bearish" }) {
  return (
    <div className="glass rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`text-lg font-mono ${tone === "bullish" ? "text-bullish" : tone === "bearish" ? "text-bearish" : ""}`}>
        {v != null ? Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—"}
      </div>
    </div>
  );
}

function WeightBars({ weights }: { weights: Record<string, number> }) {
  const entries = Object.entries(weights);
  if (!entries.length) return <p className="text-sm text-muted-foreground">No weights returned.</p>;
  return (
    <div className="space-y-2">
      {entries.map(([k, v]) => (
        <div key={k}>
          <div className="flex justify-between text-xs mb-1">
            <span className="capitalize">{k}</span>
            <span className="font-mono">{Math.round(Number(v))}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[color:var(--primary)] to-[color:var(--accent)]"
              style={{ width: `${Math.min(100, Math.max(0, Number(v)))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
