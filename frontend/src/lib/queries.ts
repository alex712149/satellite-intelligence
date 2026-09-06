import { queryOptions } from "@tanstack/react-query";

import * as api from "./api";
import type { ReviewStatus } from "./types";

export const qk = {
  stats: ["stats"] as const,
  aois: ["aois"] as const,
  timeline: (aoiId: string) => ["timeline", aoiId] as const,
  mosaic: (aoiId: string, date: string) => ["mosaic", aoiId, date] as const,
  tile: (tileId: string) => ["tile", tileId] as const,
  similar: (tileId: string) => ["similar", tileId] as const,
  textSearch: (query: string, aoiId: string, dateFrom: string, dateTo: string, k: number) =>
    ["text-search", query, aoiId, dateFrom, dateTo, k] as const,
  candidates: (status: ReviewStatus | null, aoiId: string | null) =>
    ["candidates", status, aoiId] as const,
  reviewQuality: ["review-quality"] as const,
  change: (vectorId: string) => ["change", vectorId] as const,
  audit: ["audit"] as const,
  clusters: ["clusters"] as const,
  clusterMembers: (id: number) => ["cluster-members", id] as const,
  onboardJob: (jobId: string) => ["onboard-job", jobId] as const,
};

export const statsQuery = () =>
  queryOptions({ queryKey: qk.stats, queryFn: ({ signal }) => api.getStats(signal), retry: false });

export const aoisQuery = () =>
  queryOptions({ queryKey: qk.aois, queryFn: ({ signal }) => api.getAois(signal) });

export const timelineQuery = (aoiId: string) =>
  queryOptions({
    queryKey: qk.timeline(aoiId),
    queryFn: ({ signal }) => api.getTimeline(aoiId, signal),
    enabled: Boolean(aoiId),
  });

export const mosaicQuery = (aoiId: string, date: string) =>
  queryOptions({
    queryKey: qk.mosaic(aoiId, date),
    queryFn: ({ signal }) => api.getMosaic(aoiId, date, signal),
    enabled: Boolean(aoiId && date),
  });

export const tileQuery = (tileId: string) =>
  queryOptions({
    queryKey: qk.tile(tileId),
    queryFn: ({ signal }) => api.getTile(tileId, signal),
    enabled: Boolean(tileId),
  });

export const similarQuery = (tileId: string) =>
  queryOptions({
    queryKey: qk.similar(tileId),
    queryFn: ({ signal }) => api.getSimilarTiles(tileId, 12, signal),
    enabled: Boolean(tileId),
  });

export const textSearchQuery = (params: {
  query: string;
  aoiId: string;
  dateFrom: string;
  dateTo: string;
  k: number;
}) =>
  queryOptions({
    queryKey: qk.textSearch(params.query, params.aoiId, params.dateFrom, params.dateTo, params.k),
    queryFn: ({ signal }) =>
      api.searchText(
        {
          query: params.query,
          aoi_id: params.aoiId || null,
          date_from: params.dateFrom || null,
          date_to: params.dateTo || null,
          k: params.k,
        },
        signal,
      ),
    enabled: Boolean(params.query),
    retry: false,
  });

export const candidatesQuery = (status: ReviewStatus | null, aoiId: string | null) =>
  queryOptions({
    queryKey: qk.candidates(status, aoiId),
    queryFn: ({ signal }) => api.getCandidates({ status, aoi_id: aoiId }, signal),
  });

export const reviewQualityQuery = () =>
  queryOptions({ queryKey: qk.reviewQuality, queryFn: ({ signal }) => api.getReviewQuality(signal) });

export const changeQuery = (vectorId: string) =>
  queryOptions({
    queryKey: qk.change(vectorId),
    queryFn: ({ signal }) => api.getChangeByVector(vectorId, signal),
    retry: false,
  });

export const auditQuery = () =>
  queryOptions({ queryKey: qk.audit, queryFn: ({ signal }) => api.getAuditLog(signal) });

export const clustersQuery = () =>
  queryOptions({ queryKey: qk.clusters, queryFn: ({ signal }) => api.getClusters(signal) });

export const clusterMembersQuery = (clusterId: number | null) =>
  queryOptions({
    queryKey: qk.clusterMembers(clusterId ?? -1),
    queryFn: ({ signal }) => api.getClusterMembers(clusterId as number, signal),
    enabled: clusterId !== null,
  });

export const onboardJobQuery = (jobId: string | null) =>
  queryOptions({
    queryKey: qk.onboardJob(jobId ?? ""),
    queryFn: ({ signal }) => api.getOnboardJob(jobId as string, signal),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "done" || status === "failed" ? false : 1500;
    },
  });
