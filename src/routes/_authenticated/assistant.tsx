import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { sendChat } from "@/lib/ai.functions";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send, Sparkles, User } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({ meta: [{ title: "AI Assistant — AI Algo" }] }),
  component: AssistantPage,
});

const SUGGESTIONS = [
  "Why is NIFTY bullish today?",
  "Explain Delta and Gamma simply.",
  "What does PCR > 1.3 mean?",
  "Walk me through my latest signal.",
];

function AssistantPage() {
  const qc = useQueryClient();
  const send = useServerFn(sendChat);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const threads = useQuery({
    queryKey: ["chat-threads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_threads").select("*").order("updated_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data;
    },
  });

  const messages = useQuery({
    queryKey: ["chat-messages", threadId],
    enabled: !!threadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_history").select("*").eq("thread_id", threadId!).order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.data]);

  const mutation = useMutation({
    mutationFn: (msg: string) => send({ data: { thread_id: threadId, message: msg } }),
    onSuccess: (res) => {
      setThreadId(res.thread_id);
      qc.invalidateQueries({ queryKey: ["chat-messages", res.thread_id] });
      qc.invalidateQueries({ queryKey: ["chat-threads"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Chat failed"),
  });

  function submit() {
    const msg = input.trim();
    if (!msg) return;
    setInput("");
    mutation.mutate(msg);
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader title="AI Assistant" subtitle="Ask anything about signals, options & macro" icon={MessageSquare} />

      <div className="grid lg:grid-cols-[260px_1fr] gap-4 h-[calc(100vh-220px)]">
        <div className="glass rounded-2xl p-3 overflow-y-auto">
          <button
            onClick={() => setThreadId(null)}
            className="w-full text-left text-sm px-3 py-2 rounded-md hover:bg-white/5 border border-white/5 mb-2"
          >
            + New chat
          </button>
          {threads.data?.map((t) => (
            <button
              key={t.id}
              onClick={() => setThreadId(t.id)}
              className={`w-full text-left text-sm px-3 py-2 rounded-md hover:bg-white/5 truncate ${threadId === t.id ? "bg-white/5" : ""}`}
            >
              {t.title}
            </button>
          ))}
        </div>

        <div className="glass rounded-2xl flex flex-col">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
            {!messages.data?.length ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <Sparkles className="size-10 text-[color:var(--primary)] mb-3 opacity-70" />
                <h3 className="font-semibold">Ask AI Algo anything</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">
                  Get explanations of signals, market structure, option Greeks, or what just moved the market.
                </p>
                <div className="mt-5 flex flex-wrap gap-2 justify-center max-w-lg">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => mutation.mutate(s)}
                      className="text-xs px-3 py-1.5 rounded-full border border-white/10 hover:bg-white/5"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.data.map((m) => (
                <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
                  {m.role !== "user" && (
                    <div className="size-8 rounded-lg bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--secondary)] grid place-items-center shrink-0">
                      <Sparkles className="size-4 text-white" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-[color:var(--primary)] text-white" : "glass"}`}>
                    {m.content}
                  </div>
                  {m.role === "user" && (
                    <div className="size-8 rounded-lg bg-white/5 grid place-items-center shrink-0">
                      <User className="size-4" />
                    </div>
                  )}
                </div>
              ))
            )}
            {mutation.isPending && (
              <div className="flex gap-3">
                <div className="size-8 rounded-lg bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--secondary)] grid place-items-center shrink-0">
                  <Sparkles className="size-4 text-white animate-pulse" />
                </div>
                <div className="glass rounded-xl px-4 py-2.5 text-sm text-muted-foreground">Thinking…</div>
              </div>
            )}
          </div>

          <div className="border-t border-white/5 p-3 flex gap-2 items-end">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
              placeholder="Ask anything…"
              rows={1}
              className="resize-none"
            />
            <Button onClick={submit} disabled={mutation.isPending || !input.trim()}>
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
