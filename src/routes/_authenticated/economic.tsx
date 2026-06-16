import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/AppShell";
import { Globe2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/economic")({
  head: () => ({ meta: [{ title: "Economic Intelligence — AI Algo" }] }),
  component: EconPage,
});

function EconPage() {
  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader title="Economic Intelligence" subtitle="RBI · CPI · GDP · Rates · Policy" icon={Globe2} />
      <EmptyState
        icon={Globe2}
        title="Connect an economic data provider"
        description="Trading Economics or FRED can populate the economic_events table. RBI release scraping is also supported and runs server-side."
      />
    </div>
  );
}
