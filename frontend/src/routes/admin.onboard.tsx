import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState, Field, LoadingState, Panel } from "@/components/common/states";
import { AppShell } from "@/components/layout/AppShell";
import * as api from "@/lib/api";
import { int, pct } from "@/lib/format";
import { onboardJobQuery, qk } from "@/lib/queries";

export const Route = createFileRoute("/admin/onboard")({
  head: () => ({
    meta: [
      { title: "AOI Onboarding — Sentinel Intelligence" },
      {
        name: "description",
        content:
          "Register a new area of interest from a local imagery folder and follow the backend ingest report.",
      },
      { property: "og:title", content: "AOI Onboarding — Sentinel Intelligence" },
      {
        property: "og:description",
        content: "Trigger local ingest jobs and read the backend's real progress report.",
      },
    ],
  }),
  component: OnboardPage,
});

function OnboardPage() {
  const [name, setName] = useState("");
  const [sourcePath, setSourcePath] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const previousStatus = useRef<string | undefined>(undefined);

  const start = useMutation({
    mutationFn: () => api.startOnboard({ name: name.trim(), source_folder: sourcePath.trim() }),
    onSuccess: (job) => {
      setJobId(job.job_id);
      toast.success(`Backend accepted onboarding job ${job.job_id}`);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Onboarding request failed"),
  });

  const job = useQuery(onboardJobQuery(jobId));
  const status = job.data?.status;

  useEffect(() => {
    if (status === "done" && previousStatus.current !== "done") {
      void queryClient.invalidateQueries({ queryKey: qk.aois });
      void queryClient.invalidateQueries({ queryKey: qk.stats });
      void queryClient.invalidateQueries({ queryKey: ["timeline"] });
      void queryClient.invalidateQueries({ queryKey: ["mosaic"] });
      void queryClient.invalidateQueries({ queryKey: ["candidates"] });
    }
    previousStatus.current = status;
  }, [queryClient, status]);

  return (
    <AppShell
      title="AOI Onboarding"
      subtitle="Ingestion runs entirely inside the local backend. Progress shown here is reported by the backend job, never simulated."
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <Panel title="New AOI">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim() || !sourcePath.trim()) {
                toast.error("AOI name and local source path are both required");
                return;
              }
              if (start.isPending) return;
              start.mutate();
            }}
          >
            <label className="block">
              <span className="tele block text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                AOI name
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="tele mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
                placeholder="Coastal Sector 7"
              />
            </label>
            <label className="block">
              <span className="tele block text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Local source folder
              </span>
              <input
                value={sourcePath}
                onChange={(e) => setSourcePath(e.target.value)}
                className="tele mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
                placeholder="/data/sentinel2/coastal_sector_7"
              />
            </label>
            <button
              type="submit"
              disabled={start.isPending}
              className="tele w-full rounded border border-telemetry/60 bg-telemetry/10 px-3 py-2 text-[11px] uppercase tracking-widest text-telemetry disabled:opacity-50"
            >
              {start.isPending ? "Submitting" : "Start ingest"}
            </button>
            <p className="tele text-[10px] leading-relaxed text-muted-foreground">
              The path is resolved by the backend host. No imagery is uploaded from the browser.
            </p>
          </form>
        </Panel>

        <Panel title={jobId ? `Job ${jobId}` : "Job report"}>
          {!jobId ? (
            <EmptyState label="No onboarding job submitted in this session" />
          ) : job.isPending ? (
            <LoadingState label="Waiting for backend job state" />
          ) : job.isError ? (
            <ErrorState error={job.error} onRetry={() => void job.refetch()} />
          ) : !job.data ? (
            <EmptyState label="Backend returned no job record" />
          ) : (
            <div className="space-y-3">
              <div className="grid gap-x-6 sm:grid-cols-2">
                <Field label="Status" value={job.data.status} />
                <Field label="Progress" value={pct(job.data.progress)} />
                <Field label="AOI" value={job.data.aoi_id ?? "—"} />
                <Field label="Scenes found" value={int(job.data.scenes_found)} />
                <Field label="Scenes ingested" value={int(job.data.scenes_ingested)} />
                <Field label="Scenes failed" value={int(job.data.scenes_failed)} />
                <Field label="Tiles added" value={int(job.data.tiles_added)} />
                <Field label="Message" value={job.data.message ?? "—"} />
              </div>

              {status === "queued" || status === "running" ? (
                <p className="tele text-[11px] text-telemetry">Polling backend for updates…</p>
              ) : null}

              {job.data.warnings.length > 0 && (
                <div className="rounded border border-warning/40 bg-warning/10 p-3">
                  <p className="tele text-[10px] uppercase tracking-widest text-warning">
                    Validation warnings
                  </p>
                  <ul className="mt-1 space-y-1">
                    {job.data.warnings.map((w) => (
                      <li key={w} className="tele text-[11px] text-foreground">
                        · {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {job.data.scenes.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="tele text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        <th className="py-2 pr-4">Scene</th>
                        <th className="py-2 pr-4">Date</th>
                        <th className="py-2 pr-4">Outcome</th>
                        <th className="py-2">Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {job.data.scenes.map((scene) => (
                        <tr
                          key={scene.scene_id}
                          className="tele border-t border-border/60 text-[11px]"
                        >
                          <td className="py-2 pr-4">{scene.scene_id}</td>
                          <td className="py-2 pr-4">{scene.date ?? "—"}</td>
                          <td className="py-2 pr-4">{scene.status}</td>
                          <td className="py-2">{scene.message ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
