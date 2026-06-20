import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { TradingViewWidget } from "@/components/TradingViewWidget";
import { PageHeader } from "@/components/AppShell";
import { CandlestickChart } from "lucide-react";
import { INDICES, tvSymbol } from "@/lib/market";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const INTERVALS = [
  ["1", "1m"], ["5", "5m"], ["15", "15m"], ["60", "1h"], ["D", "1D"], ["W", "1W"],
] as const;

export const Route = createFileRoute("/_authenticated/charts")({
  head: () => ({ meta: [{ title: "Live Charts — AI Algo" }] }),
  component: ChartsPage,
});

function ChartsPage() {
  const [idx, setIdx] = useState("NIFTY50");
  const [intv, setIntv] = useState("15");

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto">
      <PageHeader
        title="Live Charts"
        subtitle="TradingView candlestick charts with EMA, RSI & MACD"
        icon={CandlestickChart}
        action={
          <div className="flex gap-2">
            <Select value={idx} onValueChange={setIdx}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {INDICES.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={intv} onValueChange={setIntv}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                {INTERVALS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        }
      />
      <div className="h-[calc(100vh-180px)] min-h-[680px]">
        <TradingViewWidget symbol={tvSymbol(idx)} interval={intv} height="100%" />
      </div>
    </div>
  );
}
