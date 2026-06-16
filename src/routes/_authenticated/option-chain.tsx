import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listIntegrations } from "@/lib/integrations.functions";
import { PageHeader, EmptyState } from "@/components/AppShell";
import { BarChart3, Plug } from "lucide-react";
import { useState } from "react";
import { INDICES } from "@/lib/market";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/option-chain")({
  head: () => ({ meta: [{ title: "Option Chain — AI Algo" }] }),
  component: OptionChain,
});

function OptionChain() {
  const list = useServerFn(listIntegrations);
  const q = useQuery({ queryKey: ["integrations"], queryFn: () => list({ data: undefined as never }) });
  const upstox = q.data?.find((i) => i.provider === "upstox" && i.status === "connected");
  const [idx, setIdx] = useState("NIFTY50");

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Option Chain Terminal"
        subtitle="Strikes, OI, PCR, Max Pain & Greeks"
        icon={BarChart3}
        action={
          <Select value={idx} onValueChange={setIdx}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {INDICES.filter((i) => ["NIFTY50", "BANKNIFTY", "FINNIFTY", "SENSEX"].includes(i.value)).map((i) => (
                <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {!upstox ? (
        <EmptyState
          icon={Plug}
          title="Connect Upstox to load the option chain"
          description="Live NSE option chain data requires an Upstox account with a valid access token. AI Algo does not place trades — it only reads market data."
          action={
            <Link
              to="/integrations"
              className="px-4 py-2 rounded-md bg-[color:var(--primary)] text-white text-sm"
            >
              Connect Upstox
            </Link>
          }
        />
      ) : (
        <div className="glass rounded-2xl p-6">
          <div className="text-sm text-muted-foreground">
            Upstox is connected. Option chain pull worker is part of Phase 2 — the data pipeline
            (Upstox REST → option_chain table → AI reasoning) is scaffolded in the schema and ready
            to wire next session.
          </div>
        </div>
      )}
    </div>
  );
}
