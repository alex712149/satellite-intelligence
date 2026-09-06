import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { EmptyState, ErrorState, Field, LoadingState, Metric, Panel } from "@/components/common/states";
import { AppShell } from "@/components/layout/AppShell";
import { candidateChangeType, dateText, int, num, pct, timestampText } from "@/lib/format";
import { aoisQuery, auditQuery, candidatesQuery, statsQuery } from "@/lib/queries";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mission Control — Sentinel Intelligence" },
      {
        name: "description",
        content:
          "Satellite analyst mission control: catalog telemetry, monitored areas of interest, recent candidate changes and review activity from the local pipeline.",
      },
      { property: "og:title", content: "Mission Control — Sentinel Intelligence" },
      {
        property: "og:description",
        content: "Live catalog telemetry and candidate change activity from the offline Sentinel-2 pipeline.",
      },
    ],
  }),
  component: MissionControl,
});

function MissionControl() {
  const stats = useQuery(statsQuery());
  const aois = useQuery(aoisQuery());
  const open = useQuery(candidatesQuery("OPEN", null));
  const audit = useQuery(auditQuery());

  return (
    <AppShell
      title="Mission Control"
      subtitle="Every value below is reported by the local backend catalog. Nothing on this screen is computed in the browser."
    >
      <div className="space-y-4">
        <Panel title="Catalog telemetry">
          {stats.isPending ? (
            <LoadingState label="Reading backend catalog" />
          ) : stats.isError ? (
            <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />
          ) : !stats.data ? (
            <EmptyState label="Backend returned no statistics" />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Areas of interest" value={int(stats.data.aoi_count)} tone="telemetry" />
                <Metric label="Scenes ingested" value={int(stats.data.scene_count)} />
                <Metric label="Tiles catalogued" value={int(stats.data.tile_count)} />
                <Metric label="Indexed vectors" value={int(stats.data.vector_count)} tone="telemetry" />
                <Metric label="Candidates scored" value={int(stats.data.candidates_scored)} />
                <Metric label="Promoted" value={int(stats.data.candidates_promoted)} tone="warning" />
                <Metric label="Confirmed" value={int(stats.data.candidates_confirmed)} tone="confirm" />
                <Metric label="Suppressed" value={int(stats.data.candidates_suppressed)} tone="alert" />
              </div>
              <div className="mt-3 grid gap-x-6 sm:grid-cols-2">
                <Field label="Processing version" value={stats.data.processing_version ?? "—"} />
                <Field label="Last pipeline run" value={timestampText(stats.data.last_run)} />
              </div>
            </>
          )}
        </Panel>

        <Panel title="Monitored areas of interest">
          {aois.isPending ? (
            <LoadingState label="Loading areas of interest" />
          ) : aois.isError ? (
            <ErrorState error={aois.error} onRetry={() => void aois.refetch()} />
          ) : (aois.data ?? []).length === 0 ? (
            <EmptyState label="No AOIs registered" hint="Register one from AOI Onboarding." />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {(aois.data ?? []).map((aoi) => (
                <li key={aoi.aoi_id} className="panel overflow-hidden">
                  {aoi.mosaic_thumbnail_url ? (
                    <img
                      src={aoi.mosaic_thumbnail_url}
                      alt={`Preview mosaic for ${aoi.name}`}
                      loading="lazy"
                      className="aspect-video w-full object-cover"
                    />
                  ) : (
                    <div className="tele flex aspect-video items-center justify-center border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground">
                      No preview mosaic from backend
                    </div>
                  )}
                  <div className="space-y-1 p-3">
                    <p className="text-sm text-foreground">{aoi.name}</p>
                    <p className="tele text-[11px] text-muted-foreground">
                      {dateText(aoi.start_date)} → {dateText(aoi.end_date)}
                    </p>
                    <p className="tele text-[11px] text-muted-foreground">
                      {int(aoi.scene_count)} scenes · {int(aoi.tile_count)} tiles
                    </p>
                    <p className="tele text-[10px] text-muted-foreground">
                      Latest activity {timestampText(aoi.last_activity)}
                    </p>
                    <Link
                      to="/explorer"
                      search={{ aoi_id: aoi.aoi_id, date: undefined, tile: undefined, clusters: undefined }}
                      className="tele mt-1 inline-block rounded border border-border px-2 py-1 text-[10px] uppercase tracking-widest hover:text-telemetry"
                    >
                      Open explorer
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel
            title="Open change candidates"
            actions={
              <Link to="/review" search={{ status: "OPEN" }} className="tele text-[10px] uppercase text-telemetry">
                Review queue
              </Link>
            }
          >
            {open.isPending ? (
              <LoadingState label="Loading candidates" />
            ) : open.isError ? (
              <ErrorState error={open.error} onRetry={() => void open.refetch()} />
            ) : (open.data ?? []).length === 0 ? (
              <EmptyState label="No open candidates reported by backend" />
            ) : (
              <ul className="space-y-2">
                {(open.data ?? []).slice(0, 8).map((c) => (
                  <li
                    key={c.candidate_id}
                    className="flex items-center justify-between gap-3 rounded border border-border p-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-foreground">
                        {candidateChangeType(c.change_type)} · {pct(c.confidence)}
                      </p>
                      <p className="tele truncate text-[11px] text-muted-foreground">
                        {c.aoi_name ?? c.aoi_id} · {c.tile_id} · {dateText(c.before_date)} →{" "}
                        {dateText(c.after_date)}
                      </p>
                      <p className="tele text-[10px] text-muted-foreground">
                        drift {num(c.embedding_drift)} · spectral {num(c.spectral_delta)} · score{" "}
                        {num(c.combined_score)}
                      </p>
                    </div>
                    {c.vector_id !== null && (
                      <Link
                        to="/change/$vectorId"
                        params={{ vectorId: String(c.vector_id) }}
                        className="tele shrink-0 rounded border border-border px-2 py-1 text-[10px] uppercase hover:text-telemetry"
                      >
                        Analyse
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Recent review activity">
            {audit.isPending ? (
              <LoadingState label="Loading audit log" />
            ) : audit.isError ? (
              <ErrorState error={audit.error} onRetry={() => void audit.refetch()} />
            ) : (audit.data ?? []).length === 0 ? (
              <EmptyState label="No analyst decisions recorded yet" />
            ) : (
              <ul className="space-y-2">
                {(audit.data ?? []).slice(0, 8).map((entry) => (
                  <li key={entry.log_id} className="rounded border border-border p-2">
                    <p className="tele text-[11px] text-foreground">
                      {entry.decision} · {entry.candidate_id}
                    </p>
                    <p className="tele text-[10px] text-muted-foreground">
                      {entry.tile_id ?? "—"} · {timestampText(entry.created_at)}
                    </p>
                    {entry.reason && <p className="tele text-[10px] text-muted-foreground">{entry.reason}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
