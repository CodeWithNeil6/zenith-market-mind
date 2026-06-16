import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Settings as SettingsIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HORIZONS, INDICES, RISKS, STYLES } from "@/lib/market";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — AI Algo" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [idx, setIdx] = useState("NIFTY50");
  const [style, setStyle] = useState("intraday");
  const [risk, setRisk] = useState("moderate");
  const [horizon, setHorizon] = useState("same_day");
  const [capital, setCapital] = useState("100000");

  useEffect(() => {
    if (!q.data) return;
    setIdx(q.data.default_index ?? "NIFTY50");
    setStyle(q.data.default_style ?? "intraday");
    setRisk(q.data.default_risk ?? "moderate");
    setHorizon(q.data.default_horizon ?? "same_day");
    setCapital(String(q.data.default_capital ?? 100000));
  }, [q.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("settings").upsert({
        user_id: user!.id,
        default_index: idx as "NIFTY50",
        default_style: style as "intraday",
        default_risk: risk as "moderate",
        default_horizon: horizon as "same_day",
        default_capital: Number(capital),
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Settings saved"); qc.invalidateQueries({ queryKey: ["settings"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      <PageHeader title="Settings" subtitle="Defaults applied to new analyses" icon={SettingsIcon} />
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="glass rounded-2xl p-6 space-y-4">
        <Pair label="Default index">
          <Select value={idx} onValueChange={setIdx}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{INDICES.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
          </Select>
        </Pair>
        <Pair label="Default style">
          <Select value={style} onValueChange={setStyle}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STYLES.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
          </Select>
        </Pair>
        <Pair label="Default risk">
          <Select value={risk} onValueChange={setRisk}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{RISKS.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
          </Select>
        </Pair>
        <Pair label="Default horizon">
          <Select value={horizon} onValueChange={setHorizon}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{HORIZONS.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
          </Select>
        </Pair>
        <Pair label="Default capital (₹)">
          <Input type="number" value={capital} onChange={(e) => setCapital(e.target.value)} />
        </Pair>
        <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save settings"}</Button>
      </form>
    </div>
  );
}

function Pair({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_1fr] items-center gap-4">
      <Label>{label}</Label>
      <div>{children}</div>
    </div>
  );
}
