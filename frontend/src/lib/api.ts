/**
 * THE ONLY HTTP BOUNDARY IN THE APPLICATION.
 *
 * UI components never call fetch(). Every backend-specific change (endpoint
 * paths, payload shapes, field mapping) happens in this file only.
 *
 * VITE_USE_FIXTURES=true  -> deterministic synthetic dev fixtures
 * VITE_USE_FIXTURES=false -> real local FastAPI backend at VITE_API_BASE_URL
 */

import { apiBaseUrl, useFixtures } from "./config";
import * as fx from "./fixtures";
import type {
  AOI,
  AuditLogEntry,
  ChangeCandidate,
  ChangeDetail,
  Cluster,
  ClusterMember,
  Mosaic,
  OnboardJob,
  OnboardRequest,
  ReviewDecisionRequest,
  ReviewQuality,
  ReviewStatus,
  SearchResponse,
  SearchResult,
  Stats,
  TileDetail,
  TimelineEntry,
} from "./types";

export const isFixtureMode = useFixtures;
export { apiBaseUrl };

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface RequestOptions {
  method?: "GET" | "POST";
  json?: unknown;
  form?: FormData;
  signal?: AbortSignal | undefined;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const init: RequestInit = { method: options.method ?? "GET" };
  if (options.signal) init.signal = options.signal;
  if (options.form) {
    init.body = options.form;
  } else if (options.json !== undefined) {
    init.body = JSON.stringify(options.json);
    init.headers = { "Content-Type": "application/json" };
  }

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(`Backend unreachable at ${apiBaseUrl}`, 0);
  }
  if (!response.ok) {
    let detail = "";
    try {
      const body = (await response.json()) as { detail?: string };
      detail = body.detail ? `: ${body.detail}` : "";
    } catch {
      // Keep the status-based error when the backend did not return JSON.
    }
    throw new ApiError(
      `${response.status} ${response.statusText}${detail} — ${path}`,
      response.status,
    );
  }
  return (await response.json()) as T;
}

const delay = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));

function query(params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

/* ------------------------------- endpoints ------------------------------- */

export async function getStats(signal?: AbortSignal): Promise<Stats> {
  if (isFixtureMode) {
    await delay();
    return fx.fixtureStats;
  }
  return request<Stats>("/stats", { signal });
}

export async function getAois(signal?: AbortSignal): Promise<AOI[]> {
  if (isFixtureMode) {
    await delay();
    return fx.fixtureAois;
  }
  return request<AOI[]>("/aois", { signal });
}

export async function getTimeline(aoiId: string, signal?: AbortSignal): Promise<TimelineEntry[]> {
  if (isFixtureMode) {
    await delay();
    return fx.fixtureTimeline(aoiId);
  }
  return request<TimelineEntry[]>(`/aois/${encodeURIComponent(aoiId)}/timeline`, { signal });
}

export async function getMosaic(
  aoiId: string,
  date: string,
  signal?: AbortSignal,
): Promise<Mosaic> {
  if (isFixtureMode) {
    await delay();
    return fx.fixtureMosaic(aoiId, date);
  }
  return request<Mosaic>(`/aois/${encodeURIComponent(aoiId)}/mosaic${query({ date })}`, { signal });
}

export async function getTile(tileId: string, signal?: AbortSignal): Promise<TileDetail> {
  if (isFixtureMode) {
    await delay();
    return fx.fixtureTile(tileId);
  }
  return request<TileDetail>(`/tiles/${encodeURIComponent(tileId)}`, { signal });
}

export async function getSimilarTiles(
  tileId: string,
  topK = 12,
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  if (isFixtureMode) {
    await delay();
    return fx.fixtureSearchResults(topK);
  }
  const data = await request<SearchResponse | SearchResult[]>(
    `/tiles/${encodeURIComponent(tileId)}/similar${query({ k: topK })}`,
    { signal },
  );
  return Array.isArray(data) ? data : data.results;
}

export async function searchText(
  body: {
    query: string;
    aoi_id?: string | null;
    date?: string | null;
    date_from?: string | null;
    date_to?: string | null;
    k?: number;
  },
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  if (isFixtureMode) {
    await delay(250);
    return fx.fixtureSearchResults(body.k ?? 12);
  }
  const data = await request<SearchResponse | SearchResult[]>("/search/text", {
    method: "POST",
    json: body,
    signal,
  });
  return Array.isArray(data) ? data : data.results;
}

export async function searchImage(
  file: File,
  opts: { aoi_id?: string | null; k?: number } = {},
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  if (isFixtureMode) {
    await delay(320);
    return fx.fixtureSearchResults(opts.k ?? 12);
  }
  const form = new FormData();
  form.append("file", file);
  if (opts.aoi_id) form.append("aoi_id", opts.aoi_id);
  form.append("k", String(opts.k ?? 12));
  const data = await request<SearchResponse | SearchResult[]>("/search/image", {
    method: "POST",
    form,
    signal,
  });
  return Array.isArray(data) ? data : data.results;
}

export async function getCandidates(
  filters: { status?: ReviewStatus | null; aoi_id?: string | null } = {},
  signal?: AbortSignal,
): Promise<ChangeCandidate[]> {
  if (isFixtureMode) {
    await delay();
    return fx.fixtureCandidates.filter(
      (c) =>
        (!filters.status || c.status === filters.status) &&
        (!filters.aoi_id || c.aoi_id === filters.aoi_id),
    );
  }
  return request<ChangeCandidate[]>(
    `/changes/candidates${query({ status: filters.status, aoi_id: filters.aoi_id })}`,
    {
      signal,
    },
  );
}

export async function getReviewQuality(signal?: AbortSignal): Promise<ReviewQuality> {
  if (isFixtureMode) {
    await delay();
    const excluded = fx.fixtureCandidates.filter((candidate) => candidate.suppression_reason?.includes("source_imagery_unavailable")).length;
    return { excluded_source_unavailable: excluded, displayable_candidate_count: fx.fixtureCandidates.length - excluded };
  }
  return request<ReviewQuality>("/changes/candidates/data-quality", { signal });
}

export async function getChangeByVector(
  vectorId: string,
  signal?: AbortSignal,
): Promise<ChangeDetail> {
  if (isFixtureMode) {
    await delay();
    const candidate =
      fx.fixtureCandidates.find((c) => String(c.vector_id) === vectorId) ??
      fx.fixtureCandidates.find((c) => c.candidate_id === vectorId);
    if (!candidate) throw new ApiError(`No change candidate for vector ${vectorId}`, 404);
    return fx.fixtureChangeDetail(candidate);
  }
  return request<ChangeDetail>(`/changes/${encodeURIComponent(vectorId)}`, { signal });
}

export async function submitReviewDecision(
  candidateId: string,
  body: ReviewDecisionRequest,
): Promise<{ ok: boolean }> {
  if (isFixtureMode) {
    await delay(200);
    const candidate = fx.fixtureCandidates.find((c) => c.candidate_id === candidateId);
    if (candidate && !candidate.suppressed) {
      candidate.status = body.decision === "CONFIRM" ? "CONFIRMED" : "REJECTED";
      fx.fixtureAudit.unshift({
        log_id: `log-${fx.fixtureAudit.length + 1}`,
        candidate_id: candidateId,
        tile_id: candidate.tile_id,
        decision: body.decision,
        reason: body.reason ?? null,
        created_at: new Date().toISOString(),
      });
    }
    return { ok: true };
  }
  return request<{ ok: boolean }>(`/review/${encodeURIComponent(candidateId)}/decision`, {
    method: "POST",
    json: body,
  });
}

export async function getAuditLog(signal?: AbortSignal): Promise<AuditLogEntry[]> {
  if (isFixtureMode) {
    await delay();
    return fx.fixtureAudit;
  }
  return request<AuditLogEntry[]>("/review/audit-log", { signal });
}

export async function getClusters(signal?: AbortSignal): Promise<Cluster[]> {
  if (isFixtureMode) {
    await delay();
    return fx.fixtureClusters;
  }
  return request<Cluster[]>("/clusters", { signal });
}

export async function getClusterMembers(
  clusterId: number,
  signal?: AbortSignal,
): Promise<ClusterMember[]> {
  if (isFixtureMode) {
    await delay();
    return fx.fixtureClusterMembers(clusterId);
  }
  return request<ClusterMember[]>(`/clusters/${clusterId}/members`, { signal });
}

export async function startOnboard(body: OnboardRequest): Promise<OnboardJob> {
  if (isFixtureMode) {
    await delay(200);
    return fx.fixtureStartOnboard(body.name);
  }
  return request<OnboardJob>("/aois/onboard", { method: "POST", json: body });
}

export async function getOnboardJob(jobId: string, signal?: AbortSignal): Promise<OnboardJob> {
  if (isFixtureMode) {
    await delay(150);
    return fx.fixtureOnboardJob(jobId);
  }
  return request<OnboardJob>(`/aois/onboard/${encodeURIComponent(jobId)}`, { signal });
}
