import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Panel({
  title,
  actions,
  className,
  children,
}: {
  title?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("panel relative p-4", className)}>
      {(title || actions) && (
        <header className="mb-3 flex items-center justify-between gap-3 border-b border-border pb-2">
          {title ? (
            <h2 className="tele text-xs uppercase tracking-[0.18em] text-muted-foreground">{title}</h2>
          ) : (
            <span />
          )}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function LoadingState({ label = "Awaiting backend response" }: { label?: string }) {
  return (
    <div className="scanline relative overflow-hidden rounded border border-border/60 bg-muted/20 px-4 py-8 text-center">
      <p className="tele text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}…</p>
    </div>
  );
}

export function EmptyState({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="rounded border border-dashed border-border px-4 py-8 text-center">
      <p className="text-sm text-foreground">{label}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function UnavailableState({ label = "Value not provided by backend" }: { label?: string }) {
  return <p className="tele text-xs text-muted-foreground">{label}</p>;
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return (
    <div className="rounded border border-alert/40 bg-alert/10 px-4 py-6 text-center">
      <p className="tele text-xs uppercase tracking-[0.18em] text-alert">Backend error</p>
      <p className="mt-2 text-sm text-foreground">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="tele mt-3 rounded border border-border px-3 py-1 text-xs uppercase tracking-widest hover:bg-accent"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 py-1.5">
      <span className="tele text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <span className="tele text-sm text-foreground">{value}</span>
    </div>
  );
}

export function Metric({ label, value, tone }: { label: string; value: ReactNode; tone?: "telemetry" | "warning" | "alert" | "confirm" }) {
  const toneClass =
    tone === "warning"
      ? "text-warning"
      : tone === "alert"
        ? "text-alert"
        : tone === "confirm"
          ? "text-confirm"
          : "text-telemetry";
  return (
    <div className="panel p-3">
      <p className="tele text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className={cn("tele mt-1 text-2xl", toneClass)}>{value}</p>
    </div>
  );
}
