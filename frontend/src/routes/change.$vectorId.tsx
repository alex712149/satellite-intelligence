import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { CompareSlider } from "@/components/change/CompareSlider";
import { EmptyState, ErrorState, Field, LoadingState, Metric, Panel } from "@/components/common/states";
import { AppShell } from "@/components/layout/AppShell";
import { bboxText, candidateChangeType, coord, dateText, num, pct, suppressionText } from "@/lib/format";
import { changeQuery } from "@/lib/queries";

export const Route = createFileRoute("/change/$vectorId")({
  head: () => ({
    meta: [
      { title: "Change Analysis — Sentinel Intelligence" },
      {
        name: "description",
        content: "Before/after comparison, embedding drift and spectral delta for a backend change candidate.",
      },
      { property: "og:title", content: "Change Analysis — Sentinel Intelligence" },
      { property: "og:description", content: "Candidate change evidence served by the local FastAPI backend." },
    ],
  }),
  component: ChangePage,
});

function ChangePage() {
  const { vectorId } = Route.useParams();
  const change = useQuery(changeQuery(vectorId));

  return (
    <AppShell
      title="Change Analysis"
      subtitle="Candidate assessment produced by the backend change pipeline. Values shown are candidate signals, not confirmed ground truth."
    >
      {change.isPending ? (
        <LoadingState label="Loading change candidate" />
      ) : change.isError ? (
        <ErrorState error={change.error} onRetry={() => void change.refetch()} />
      ) : !change.data ? (
        <EmptyState label="No change candidate for this vector" />
      ) : (
        (() => {
          const d = change.data;
          const suppression = suppressionText(d.suppression_reason);
          const sourceUnavailable = !d.before_image_url;
          return (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Combined score" value={num(d.combined_score)} />
                <Metric label="Embedding drift" value={num(d.embedding_drift)} tone="warning" />
                <Metric label="Spectral delta" value={num(d.spectral_delta)} tone="warning" />
                <Metric label="Confidence" value={pct(d.confidence)} tone={d.suppressed ? "alert" : "confirm"} />
              </div>

              <Panel title={`${candidateChangeType(d.change_type)} · candidate change`}>
                {sourceUnavailable ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="flex min-h-64 items-center justify-center rounded border border-warning/50 bg-warning/5 p-6 text-center">
                      <div>
                        <p className="tele text-xs uppercase tracking-widest text-warning">Before</p>
                        <p className="mt-3 text-lg font-medium text-warning">SOURCE IMAGERY UNAVAILABLE</p>
                        <p className="mt-2 text-xs text-muted-foreground">The source raster for the BEFORE observation is invalid/unavailable.</p>
                      </div>
                    </div>
                    <div className="rounded border border-border bg-black/20 p-3">
                      <p className="tele mb-2 text-xs uppercase tracking-widest text-telemetry">After · {dateText(d.after_date)}</p>
                      {d.after_image_url ? (
                        <img src={d.after_image_url} alt={`After observation ${dateText(d.after_date)}`} className="max-h-64 w-full object-contain" />
                      ) : (
                        <p className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">After imagery unavailable</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <CompareSlider
                    beforeUrl={d.before_image_url}
                    afterUrl={d.after_image_url}
                    differenceUrl={d.evidence.difference_image_url}
                    beforeLabel={dateText(d.before_date)}
                    afterLabel={dateText(d.after_date)}
                  />
                )}
              </Panel>

              {sourceUnavailable && (
                <Panel title="WHY UNAVAILABLE">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Source date" value={dateText(d.before_date)} />
                    <Field label="After date" value={dateText(d.after_date)} />
                    <Field label="Candidate type" value={candidateChangeType(d.change_type)} />
                    <Field label="Confidence" value={pct(d.confidence)} />
                    <Field label="Embedding drift" value={num(d.embedding_drift)} />
                    <Field label="Spectral delta" value={num(d.spectral_delta)} />
                    <Field label="Combined score" value={num(d.combined_score)} />
                    <Field label="Review status" value={d.status} />
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded border border-warning/30 bg-warning/5 p-3">
                      <p className="tele text-[10px] uppercase tracking-widest text-warning">Quality / provenance</p>
                      <p className="mt-2 text-sm text-foreground">The BEFORE source cannot be used for visual confirmation.</p>
                      <p className="mt-2 text-xs text-muted-foreground">{d.suppression_reason ?? "Source imagery unavailable"}</p>
                    </div>
                    <div className="rounded border border-border bg-background/30 p-3">
                      <p className="tele text-[10px] uppercase tracking-widest text-muted-foreground">What can be verified</p>
                      <p className="mt-2 text-sm text-foreground">The candidate cannot be visually confirmed because the BEFORE source imagery is unavailable.</p>
                    </div>
                  </div>
                </Panel>
              )}

              <Panel title="WHAT CHANGED?">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <div className="rounded border border-telemetry/30 bg-telemetry/5 p-3">
                      <p className="tele text-[10px] uppercase tracking-widest text-telemetry">Evidence summary</p>
                      <p className="mt-2 text-sm leading-6 text-foreground">{d.evidence.visual_difference_summary}</p>
                      <p className="mt-2 text-sm text-muted-foreground">{d.evidence.candidate_interpretation}</p>
                    </div>
                    <Field label="Before" value={dateText(d.evidence.before_date)} />
                    <Field label="After" value={dateText(d.evidence.after_date)} />
                    <Field label="Detected region" value={d.evidence.change_region ?? "Unavailable from backend"} />
                  </div>
                  <div className="space-y-3">
                    <Field
                      label="NDVI change"
                      value={d.evidence.ndvi_change === null ? "Unavailable" : `${d.evidence.ndvi_change < 0 ? "Decreased" : "Increased"} by ${num(Math.abs(d.evidence.ndvi_change))} (${num(d.evidence.before_ndvi)} to ${num(d.evidence.after_ndvi)})`}
                    />
                    <Field label="Spectral change" value={num(d.evidence.spectral_change)} />
                    <Field label="Semantic / embedding change" value={num(d.evidence.semantic_change)} />
                    <Field label="Quality" value={d.evidence.quality} />
                    <Field label="Confidence" value={pct(d.evidence.confidence)} />
                    {d.evidence.confound_information.length > 0 && (
                      <div className="rounded border border-warning/30 bg-warning/5 p-3">
                        <p className="tele text-[10px] uppercase tracking-widest text-warning">Quality / confounds</p>
                        <ul className="mt-2 space-y-1">
                          {d.evidence.confound_information.map((note) => (
                            <li key={note} className="text-xs text-muted-foreground">{note}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
                <p className="mt-4 text-[11px] text-muted-foreground">
                  The difference layer is a backend-generated evidence visualization. It highlights RGB disagreement and is not ground truth or a confirmed land-cover mask.
                </p>
              </Panel>

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="Provenance & quality">
                  <Field label="Candidate ID" value={d.candidate_id} />
                  <Field label="Vector ID" value={d.vector_id ?? "—"} />
                  <Field label="Tile" value={d.tile_id} />
                  <Field label="AOI" value={d.aoi_name ?? d.aoi_id} />
                  <Field label="Centre" value={coord(d.lat, d.lon)} />
                  <Field label="BBox" value={<span className="text-[11px]">{bboxText(d.bbox)}</span>} />
                  <Field label="Earliest supported observation" value={dateText(d.earliest_supported_date)} />
                  <Field label="Date source" value={d.acquisition_date_source ?? "—"} />
                  <Field label="Processing version" value={d.processing_version ?? "—"} />
                  <Field label="Review status" value={d.status} />
                  {d.suppressed && (
                    <div className="mt-3 rounded border border-warning/40 bg-warning/10 p-3">
                      <p className="tele text-[11px] uppercase tracking-widest text-warning">Suppressed by backend</p>
                      <p className="mt-1 text-sm text-foreground">{suppression.readable}</p>
                      <p className="tele mt-1 text-[11px] text-muted-foreground">raw: {suppression.raw}</p>
                    </div>
                  )}
                  {d.quality_notes.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {d.quality_notes.map((note) => (
                        <li key={note} className="tele text-[11px] text-muted-foreground">
                          · {note}
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>

                <Panel title="Backend index series">
                  {d.ndvi_series.length === 0 ? (
                    <EmptyState label="No index series provided by backend" />
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={d.ndvi_series}>
                          <CartesianGrid stroke="var(--border)" />
                          <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={10} />
                          <YAxis stroke="var(--muted-foreground)" fontSize={10} />
                          <Tooltip
                            contentStyle={{
                              background: "var(--panel)",
                              border: "1px solid var(--border)",
                              fontSize: 12,
                            }}
                          />
                          <Line type="monotone" dataKey="ndvi_mean" stroke="var(--confirm)" dot={false} />
                          <Line type="monotone" dataKey="ndwi_mean" stroke="var(--telemetry)" dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </Panel>
              </div>
            </div>
          );
        })()
      )}
    </AppShell>
  );
}
