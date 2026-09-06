import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState, Field, LoadingState, Panel } from "@/components/common/states";
import { AppShell } from "@/components/layout/AppShell";
import * as api from "@/lib/api";
import { candidateChangeType, dateText, num, pct, suppressionText, timestampText } from "@/lib/format";
import { auditQuery, candidatesQuery } from "@/lib/queries";
import type { ChangeCandidate, ReviewStatus } from "@/lib/types";

const statuses: ReviewStatus[] = ["OPEN", "CONFIRMED", "REJECTED", "SUPPRESSED"];

export const Route = createFileRoute("/review")({
  validateSearch: (search: Record<string, unknown>) => ({
    status: statuses.includes(search["status"] as ReviewStatus) ? (search["status"] as ReviewStatus) : "OPEN",
  }),
  head: () => ({
    meta: [
      { title: "Review Queue — Sentinel Intelligence" },
      {
        name: "description",
        content: "Analyst review queue for backend change candidates, with decision audit log from the local backend.",
      },
      { property: "og:title", content: "Review Queue — Sentinel Intelligence" },
      { property: "og:description", content: "Confirm or reject candidate changes surfaced by the local pipeline." },
    ],
  }),
  component: ReviewPage,
});

function ReviewPage() {
  const { status } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const queryClient = useQueryClient();
  const candidates = useQuery(candidatesQuery(status, null));
  const audit = useQuery(auditQuery());

  const decide = useMutation({
    mutationFn: (vars: { candidateId: string; decision: "CONFIRM" | "REJECT"; reason: string }) =>
      api.submitReviewDecision(vars.candidateId, {
        decision: vars.decision,
        reason: vars.reason.trim() || null,
      }),
    onSuccess: (_data, vars) => {
      toast.success(`Candidate ${vars.candidateId} recorded as ${vars.decision}`);
      void queryClient.invalidateQueries({ queryKey: ["candidates"] });
      void queryClient.invalidateQueries({ queryKey: ["audit"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Decision failed"),
  });

  return (
    <AppShell
      title="Review Queue"
      subtitle="Candidate changes scored by the backend. Decisions are persisted by the backend audit log."
      toolbar={
        <div className="flex flex-wrap gap-1">
          {statuses.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void navigate({ to: ".", search: () => ({ status: s }) })}
              className={`tele rounded border px-2 py-1 text-[11px] uppercase tracking-widest ${
                s === status ? "border-telemetry text-telemetry" : "border-border text-muted-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      }
    >
      <div className="space-y-4">
        {candidates.isPending ? (
          <LoadingState label="Loading candidates" />
        ) : candidates.isError ? (
          <ErrorState error={candidates.error} onRetry={() => void candidates.refetch()} />
        ) : (candidates.data ?? []).length === 0 ? (
          <EmptyState label={`No ${status.toLowerCase()} candidates returned by backend`} />
        ) : (
          <ul className="space-y-3">
            {(candidates.data ?? []).map((candidate) => (
              <CandidateRow
                key={candidate.candidate_id}
                candidate={candidate}
                busy={decide.isPending}
                onDecide={(decision, reason) =>
                  decide.mutate({ candidateId: candidate.candidate_id, decision, reason })
                }
              />
            ))}
          </ul>
        )}

        <Panel title="Audit log">
          {audit.isPending ? (
            <LoadingState label="Loading audit log" />
          ) : audit.isError ? (
            <ErrorState error={audit.error} onRetry={() => void audit.refetch()} />
          ) : (audit.data ?? []).length === 0 ? (
            <EmptyState label="No decisions recorded by backend yet" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="tele text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    <th className="py-2 pr-4">Log</th>
                    <th className="py-2 pr-4">Candidate</th>
                    <th className="py-2 pr-4">Tile</th>
                    <th className="py-2 pr-4">Decision</th>
                    <th className="py-2 pr-4">Reason</th>
                    <th className="py-2">Recorded</th>
                  </tr>
                </thead>
                <tbody>
                  {(audit.data ?? []).map((entry) => (
                    <tr key={entry.log_id} className="tele border-t border-border/60 text-[11px]">
                      <td className="py-2 pr-4">{entry.log_id}</td>
                      <td className="py-2 pr-4">{entry.candidate_id}</td>
                      <td className="py-2 pr-4">{entry.tile_id ?? "—"}</td>
                      <td className="py-2 pr-4">{entry.decision}</td>
                      <td className="py-2 pr-4">{entry.reason ?? "—"}</td>
                      <td className="py-2">{timestampText(entry.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}

function CandidateRow({
  candidate,
  busy,
  onDecide,
}: {
  candidate: ChangeCandidate;
  busy: boolean;
  onDecide: (decision: "CONFIRM" | "REJECT", reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const suppression = suppressionText(candidate.suppression_reason);

  return (
    <li className="panel p-4">
      <div className="grid gap-4 md:grid-cols-[200px_minmax(0,1fr)_220px]">
        <div className="flex gap-2">
          {candidate.before_thumbnail_url ? (
            <div className="space-y-1">
              <img
                src={candidate.before_thumbnail_url}
                alt={`Before ${candidate.before_date} for tile ${candidate.tile_id}`}
                loading="lazy"
                className="h-24 w-24 rounded border border-border object-cover"
              />
              <p className="tele text-center text-[9px] uppercase tracking-widest text-confirm">Source available</p>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex h-24 w-24 items-center justify-center rounded border border-warning/40 bg-warning/5 p-2 text-center text-[10px] uppercase tracking-widest text-warning">
                Source imagery unavailable
              </div>
              <p className="tele text-center text-[9px] uppercase tracking-widest text-warning">Source unavailable</p>
            </div>
          )}
          {candidate.after_thumbnail_url && (
            <div className="space-y-1">
              <img
                src={candidate.after_thumbnail_url}
                alt={`After ${candidate.after_date} for tile ${candidate.tile_id}`}
                loading="lazy"
                className="h-24 w-24 rounded border border-border object-cover"
              />
              <p className="tele text-center text-[9px] uppercase tracking-widest text-confirm">Source available</p>
            </div>
          )}
        </div>

        <div>
          <p className="text-sm text-foreground">
            {candidateChangeType(candidate.change_type)} · Confidence {pct(candidate.confidence)}
          </p>
          <p className="tele mt-0.5 text-[11px] text-muted-foreground">
            {candidate.aoi_name ?? candidate.aoi_id} · {candidate.tile_id}
          </p>
          <div className="mt-2 grid gap-x-6 sm:grid-cols-2">
            <Field label="Before" value={dateText(candidate.before_date)} />
            <Field label="After" value={dateText(candidate.after_date)} />
            <Field label="Embedding drift" value={num(candidate.embedding_drift)} />
            <Field label="Spectral delta" value={num(candidate.spectral_delta)} />
            <Field label="Combined score" value={num(candidate.combined_score)} />
            <Field label="Earliest supported" value={dateText(candidate.earliest_supported_date)} />
          </div>
          {candidate.suppressed && (
            <div className="mt-2 rounded border border-warning/40 bg-warning/10 p-2">
              <p className="text-xs text-foreground">{suppression.readable}</p>
              <p className="tele mt-1 text-[10px] text-muted-foreground">raw: {suppression.raw}</p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          {candidate.vector_id !== null && (
            <Link
              to="/change/$vectorId"
              params={{ vectorId: String(candidate.vector_id) }}
              className="tele block rounded border border-border px-2 py-1 text-center text-[11px] uppercase tracking-widest hover:text-telemetry"
            >
              Open analysis
            </Link>
          )}
          {candidate.suppressed ? (
            <p className="tele text-[11px] text-muted-foreground">
              Suppressed candidates are read-only until the backend re-promotes them.
            </p>
          ) : (
            <>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Optional reason"
                aria-label={`Decision reason for ${candidate.candidate_id}`}
                className="tele h-16 w-full rounded border border-border bg-background px-2 py-1 text-[11px]"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDecide("CONFIRM", reason)}
                  className="tele flex-1 rounded border border-confirm/60 bg-confirm/10 px-2 py-1 text-[11px] uppercase tracking-widest text-confirm disabled:opacity-50"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDecide("REJECT", reason)}
                  className="tele flex-1 rounded border border-alert/60 bg-alert/10 px-2 py-1 text-[11px] uppercase tracking-widest text-alert disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </li>
  );
}
