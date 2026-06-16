import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, Brain, CandlestickChart, Globe2, MessageSquare, Newspaper, Sparkles, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI Algo — AI-Powered Indian Market Intelligence" },
      {
        name: "description",
        content:
          "Real-time AI analysis for NIFTY, BANK NIFTY, SENSEX & more. Signals, option chain, sentiment and macro — in one terminal.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: Brain, title: "AI Reasoning Engine", desc: "Dynamic factor weighting across technicals, options, news and macro — explained in plain English." },
  { icon: TrendingUp, title: "Signals & Forecasts", desc: "BUY / SELL / CALL / PUT calls with entry, SL, targets and confidence — tracked over time." },
  { icon: CandlestickChart, title: "Live Charts", desc: "Embedded TradingView candlesticks with multi-timeframe analysis." },
  { icon: Activity, title: "Option Chain Terminal", desc: "OI, PCR, Max Pain, Greeks — and the AI tells you what it means." },
  { icon: Newspaper, title: "News Intelligence", desc: "Sentiment scoring on RBI, policy, corporate and global headlines." },
  { icon: Globe2, title: "Economic Intelligence", desc: "RBI policy, CPI, GDP, rates — wired into the reasoning engine." },
  { icon: MessageSquare, title: "AI Assistant", desc: "Ask why a signal fired, what Delta means, what changed today." },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="size-9 rounded-lg bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--secondary)] grid place-items-center glow-ring">
              <Sparkles className="size-5 text-white" />
            </div>
            <span className="font-semibold tracking-tight">AI Algo</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
            <Link
              to="/auth"
              className="text-sm px-4 py-2 rounded-md bg-[color:var(--primary)] text-white hover:opacity-90"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
        <div className="max-w-6xl mx-auto px-6 py-24 relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs text-muted-foreground mb-6">
            <span className="size-1.5 rounded-full bg-[color:var(--bullish)] animate-pulse" />
            Built for NSE & BSE
          </div>
          <h1 className="text-5xl md:text-6xl font-semibold tracking-tight max-w-3xl">
            AI-powered intelligence for the{" "}
            <span className="bg-gradient-to-br from-[color:var(--primary)] via-[color:var(--accent)] to-[color:var(--secondary)] bg-clip-text text-transparent">
              Indian markets
            </span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
            Signals, option chain, sentiment and macro — fused by an AI reasoning engine that
            explains its weights. Analysis only. No trades, no brokers.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="px-5 py-3 rounded-md bg-[color:var(--primary)] text-white font-medium glow-ring hover:opacity-90"
            >
              Launch terminal
            </Link>
            <Link
              to="/auth"
              className="px-5 py-3 rounded-md border border-white/10 hover:bg-white/5"
            >
              Create account
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="glass rounded-xl p-5 hover:bg-white/[0.04] transition-colors">
              <div className="size-10 rounded-lg bg-white/5 grid place-items-center mb-4">
                <f.icon className="size-5 text-[color:var(--primary)]" />
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/5 mt-16">
        <div className="max-w-6xl mx-auto px-6 py-8 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-3">
          <div>© {new Date().getFullYear()} AI Algo. Educational analysis only — not investment advice.</div>
          <div>NIFTY · BANK NIFTY · SENSEX · FINNIFTY · MIDCAP · NIFTY NEXT 50</div>
        </div>
      </footer>
    </div>
  );
}
