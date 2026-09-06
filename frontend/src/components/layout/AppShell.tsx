import { Link } from "@tanstack/react-router";
import { Activity, Boxes, Layers, Radar, Search, Upload } from "lucide-react";
import type { ReactNode } from "react";

import { BackendStatusPill, BackendUnavailableBanner } from "./BackendStatus";
import { PROVENANCE_NOTE } from "@/lib/config";

const nav = [
  { to: "/", label: "Mission Control", icon: Activity },
  { to: "/explorer", label: "AOI Explorer", icon: Layers },
  { to: "/search", label: "Semantic Search", icon: Search },
  { to: "/clusters", label: "Discovery", icon: Boxes },
  { to: "/review", label: "Review Queue", icon: Radar },
  { to: "/admin/onboard", label: "AOI Onboarding", icon: Upload },
] as const;

export function AppShell({
  title,
  subtitle,
  toolbar,
  children,
  fullBleed,
}: {
  title: string;
  subtitle?: string;
  toolbar?: ReactNode;
  children: ReactNode;
  fullBleed?: boolean;
}) {
  return (
    <div className="min-h-screen">
      <BackendUnavailableBanner />
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rotate-45 border border-telemetry bg-telemetry/30" />
            <span className="tele text-sm uppercase tracking-[0.28em] text-foreground">Sentinel Intelligence</span>
          </Link>
          <nav className="flex flex-1 flex-wrap items-center gap-1">
            {nav.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: to === "/" }}
                className="tele flex items-center gap-1.5 rounded px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                activeProps={{ className: "bg-accent text-telemetry" }}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {label}
              </Link>
            ))}
          </nav>
          <BackendStatusPill />
        </div>
      </header>

      <main className={fullBleed ? "px-4 py-6" : "mx-auto max-w-7xl px-4 py-6"}>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
            {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {toolbar}
        </div>
        {children}
      </main>

      <footer className="mt-10 border-t border-border px-4 py-6">
        <p className="mx-auto max-w-7xl tele text-[11px] leading-relaxed text-muted-foreground">
          {PROVENANCE_NOTE} All analytical values are produced by the local offline pipeline and served by the local
          FastAPI backend; this interface performs no analysis of its own.
        </p>
      </footer>
    </div>
  );
}
