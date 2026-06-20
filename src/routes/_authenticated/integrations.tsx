import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { listIntegrations, saveUpstoxIntegration, disconnectIntegration } from "@/lib/integrations.functions";
import { PageHeader } from "@/components/AppShell";
import { Plug, Check, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/integrations")({
  head: () => ({ meta: [{ title: "Integrations — AI Algo" }] }),
  component: IntegrationsPage,
});

function IntegrationsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listIntegrations);
  const save = useServerFn(saveUpstoxIntegration);
  const disconnect = useServerFn(disconnectIntegration);

  const q = useQuery({ queryKey: ["integrations"], queryFn: () => list({ data: undefined as never }) });
  const upstox = q.data?.find((i) => i.provider === "upstox");

  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [accessToken, setAccessToken] = useState("");

  const mutation = useMutation({
    mutationFn: () => save({ data: { api_key: apiKey, api_secret: apiSecret, access_token: accessToken || null } }),
    onSuccess: () => {
      toast.success("Upstox credentials saved");
      qc.invalidateQueries({ queryKey: ["integrations"] });
      setApiKey(""); setApiSecret(""); setAccessToken("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const dc = useMutation({
    mutationFn: (provider: string) => disconnect({ data: { provider } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["integrations"] }); toast.success("Disconnected"); },
  });

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <PageHeader title="Integrations" subtitle="Connect market data and news providers" icon={Plug} />

      <div className="glass-strong rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="text-lg font-semibold">Upstox</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Live NSE/BSE quotes, historical candles and option chain. Requires an Upstox account.
            </p>
          </div>
          {upstox && (
            <span className="text-xs bg-bullish-soft text-bullish px-2 py-1 rounded-full inline-flex items-center gap-1">
              <Check className="size-3" /> Saved{(upstox.meta as { has_access_token?: boolean } | null)?.has_access_token === false ? " · token needed" : ""}
            </span>
          )}
        </div>

        <a
          href="https://account.upstox.com/developer/apps"
          target="_blank"
          rel="noreferrer"
          className="text-sm text-[color:var(--accent)] hover:underline inline-flex items-center gap-1 mb-4"
        >
          Get Upstox API credentials <ExternalLink className="size-3" />
        </a>

        <form
          onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
          className="space-y-3"
        >
          <div>
            <Label htmlFor="k">API Key</Label>
            <Input id="k" required value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="s">API Secret</Label>
            <Input id="s" required type="password" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="t">Access Token (optional, paste daily token)</Label>
            <Input id="t" type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : upstox ? "Update credentials" : "Save credentials"}
            </Button>
            {upstox && (
              <Button type="button" variant="outline" onClick={() => dc.mutate("upstox")}>
                Disconnect
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Credentials are stored in your private row with row-level security. AI Algo only reads
            market data — it never places trades.
          </p>
        </form>
      </div>

      <div className="glass rounded-2xl p-6 mt-4 opacity-70">
        <h3 className="font-semibold">News & Macro providers</h3>
        <p className="text-sm text-muted-foreground mt-1">
          NewsAPI / GNews / Marketaux and Trading Economics connectors land in Phase 3.
        </p>
      </div>
    </div>
  );
}
