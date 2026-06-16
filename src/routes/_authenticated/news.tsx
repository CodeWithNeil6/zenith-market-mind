import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/AppShell";
import { Newspaper } from "lucide-react";

export const Route = createFileRoute("/_authenticated/news")({
  head: () => ({ meta: [{ title: "News Intelligence — AI Algo" }] }),
  component: NewsPage,
});

function NewsPage() {
  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader title="News Intelligence" subtitle="AI-scored sentiment on Indian & global headlines" icon={Newspaper} />
      <EmptyState
        icon={Newspaper}
        title="Connect a news provider"
        description="Configure NewsAPI, GNews, or Marketaux to start ingesting headlines. The sentiment pipeline (bullish/bearish/impact scores) is already wired in the database and AI engine — it activates once a provider is connected."
      />
    </div>
  );
}
