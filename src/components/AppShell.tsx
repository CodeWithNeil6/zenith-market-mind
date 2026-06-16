import { Link, useRouter } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  Activity,
  BarChart3,
  Brain,
  CandlestickChart,
  Globe2,
  LineChart,
  ListChecks,
  MessageSquare,
  Newspaper,
  Plug,
  Settings as SettingsIcon,
  Sparkles,
  TrendingUp,
  User,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: Activity },
  { to: "/analysis", label: "AI Analysis", icon: Brain },
  { to: "/signals", label: "Signals", icon: TrendingUp },
  { to: "/forecasts", label: "Forecasts", icon: LineChart },
  { to: "/charts", label: "Charts", icon: CandlestickChart },
  { to: "/option-chain", label: "Option Chain", icon: BarChart3 },
  { to: "/news", label: "News Intelligence", icon: Newspaper },
  { to: "/economic", label: "Economic", icon: Globe2 },
  { to: "/assistant", label: "AI Assistant", icon: MessageSquare },
  { to: "/integrations", label: "Integrations", icon: Plug },
  { to: "/profile", label: "Profile", icon: User },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen flex">
      <aside className="hidden md:flex w-64 flex-col border-r border-white/5 bg-[color:var(--surface)]/60 backdrop-blur-xl">
        <Link to="/dashboard" className="px-5 pt-6 pb-4 flex items-center gap-2">
          <div className="size-9 rounded-lg bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--secondary)] grid place-items-center glow-ring">
            <Sparkles className="size-5 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">AI Algo</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Market Intelligence
            </div>
          </div>
        </Link>
        <nav className="px-2 py-2 flex-1 overflow-y-auto">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeProps={{
                className:
                  "bg-white/5 text-foreground border-l-2 border-[color:var(--primary)]",
              }}
              inactiveProps={{ className: "text-muted-foreground hover:text-foreground hover:bg-white/[0.03]" }}
              className="flex items-center gap-3 px-4 py-2.5 text-sm rounded-md transition-colors border-l-2 border-transparent"
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-white/5">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="size-8 rounded-full bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--secondary)] grid place-items-center text-xs font-semibold">
              {user?.email?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs truncate">{user?.email}</div>
            </div>
            <Button size="icon" variant="ghost" onClick={signOut} title="Sign out">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="size-10 rounded-lg glass grid place-items-center">
            <Icon className="size-5 text-[color:var(--primary)]" />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function StatusPill({ tone, children }: { tone: "bullish" | "bearish" | "neutral"; children: ReactNode }) {
  const classes =
    tone === "bullish"
      ? "bg-bullish-soft text-bullish"
      : tone === "bearish"
        ? "bg-bearish-soft text-bearish"
        : "bg-white/5 text-neutral";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${classes}`}>
      <ListChecks className="size-3" />
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Sparkles,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="glass rounded-2xl p-10 text-center">
      <div className="size-12 mx-auto rounded-xl bg-white/5 grid place-items-center mb-4">
        <Icon className="size-6 text-[color:var(--primary)]" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
