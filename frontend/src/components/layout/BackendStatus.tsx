import { useQuery } from "@tanstack/react-query";

import { apiBaseUrl, isFixtureMode } from "@/lib/api";
import { statsQuery } from "@/lib/queries";

export function BackendStatusPill() {
  const stats = useQuery({ ...statsQuery(), enabled: !isFixtureMode });

  if (isFixtureMode) {
    return (
      <span className="tele rounded border border-warning/50 bg-warning/10 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-warning">
        Development / Fixture mode
      </span>
    );
  }
  if (stats.isPending) {
    return (
      <span className="tele rounded border border-border px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        Probing backend…
      </span>
    );
  }
  if (stats.isError) {
    return (
      <span className="tele rounded border border-alert/50 bg-alert/10 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-alert">
        Backend unavailable
      </span>
    );
  }
  return (
    <span className="tele rounded border border-confirm/50 bg-confirm/10 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-confirm">
      Backend online
    </span>
  );
}

export function BackendUnavailableBanner() {
  const stats = useQuery({ ...statsQuery(), enabled: !isFixtureMode });
  if (isFixtureMode || !stats.isError) return null;

  return (
    <div className="border-b border-alert/40 bg-alert/15 px-4 py-2 text-center">
      <p className="tele text-xs text-alert">
        Local FastAPI backend unavailable at {apiBaseUrl}. No analytical values can be displayed.
      </p>
      <button
        type="button"
        onClick={() => void stats.refetch()}
        className="tele mt-1 rounded border border-alert/50 px-2 py-0.5 text-[10px] uppercase tracking-widest text-alert"
      >
        Retry connection
      </button>
    </div>
  );
}
