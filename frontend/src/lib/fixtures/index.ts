/**
 * DEVELOPMENT FIXTURES ONLY.
 *
 * Small, deterministic, obviously-synthetic data used to develop the frontend
 * before the local FastAPI backend is running. Reachable only when
 * VITE_USE_FIXTURES=true. Nothing here is a real observation or measurement.
 */

import type {
  AOI,
  AuditLogEntry,
  ChangeCandidate,
  ChangeDetail,
  Cluster,
  ClusterMember,
  Mosaic,
  MosaicTile,
  OnboardJob,
  SearchResult,
  Stats,
  TileDetail,
  TimelineEntry,
} from "../types";
import { fixturePanel } from "./images";

export const FIXTURE_BADGE = "FIXTURE";

export const fixtureAois: AOI[] = [
  {
    aoi_id: "dholera-sir",
    name: "Dholera SIR (FIXTURE)",
    bbox: [72.1, 22.15, 72.35, 22.4],
    start_date: "2023-01-14",
    end_date: "2024-11-08",
    scene_count: 6,
    tile_count: 64,
    mosaic_thumbnail_url: fixturePanel("dholera-thumb", 320, 320),
    last_activity: "2024-11-08T06:12:00Z",
  },
  {
    aoi_id: "jewar-airport",
    name: "Noida International Airport / Jewar (FIXTURE)",
    bbox: [77.53, 28.1, 77.72, 28.28],
    start_date: "2023-02-02",
    end_date: "2024-10-21",
    scene_count: 5,
    tile_count: 64,
    mosaic_thumbnail_url: fixturePanel("jewar-thumb", 320, 320),
    last_activity: "2024-10-21T05:48:00Z",
  },
  {
    aoi_id: "navi-mumbai-airport",
    name: "Navi Mumbai International Airport (FIXTURE)",
    bbox: [73.03, 18.98, 73.16, 19.12],
    start_date: "2023-03-11",
    end_date: "2024-09-30",
    scene_count: 5,
    tile_count: 64,
    mosaic_thumbnail_url: fixturePanel("navi-thumb", 320, 320),
    last_activity: "2024-09-30T05:31:00Z",
  },
];

const dateSets: Record<string, string[]> = {
  "dholera-sir": [
    "2023-01-14",
    "2023-06-22",
    "2023-11-30",
    "2024-04-18",
    "2024-08-02",
    "2024-11-08",
  ],
  "jewar-airport": ["2023-02-02", "2023-07-19", "2024-01-08", "2024-05-27", "2024-10-21"],
  "navi-mumbai-airport": ["2023-03-11", "2023-08-14", "2024-02-05", "2024-06-16", "2024-09-30"],
};

export function fixtureTimeline(aoiId: string): TimelineEntry[] {
  const dates = dateSets[aoiId] ?? [];
  return dates.map((date, i) => ({
    date,
    scene_id: `${aoiId}-S2-${date.replace(/-/g, "")}`,
    sensor: "S2A_MSI",
    cloud_fraction: Number((((i * 7) % 23) / 100).toFixed(2)),
    tile_count: 64,
    acquisition_date_source: i % 3 === 0 ? "metadata_xml" : "filename",
    thumbnail_url: fixturePanel(`${aoiId}-${date}-thumb`, 160, 160),
  }));
}

function tilesFor(aoiId: string, date: string): MosaicTile[] {
  const tiles: MosaicTile[] = [];
  const size = 80;
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const idx = y * 8 + x;
      tiles.push({
        tile_id: `${aoiId}_${date}_r${y}c${x}`,
        vector_id: idx + 1000,
        x: x * size,
        y: y * size,
        width: size,
        height: size,
        cluster_id: (idx % 5) + 1,
        has_change_candidate: idx % 17 === 3,
      });
    }
  }
  return tiles;
}

export function fixtureMosaic(aoiId: string, date: string): Mosaic {
  return {
    aoi_id: aoiId,
    date,
    image_url: fixturePanel(`${aoiId}-${date}-mosaic`, 640, 640),
    width: 640,
    height: 640,
    tiles: tilesFor(aoiId, date),
  };
}

export function fixtureTile(tileId: string): TileDetail {
  const parts = tileId.split("_");
  const aoiId = parts[0] ?? "dholera-sir";
  const date = parts[1] ?? "2024-11-08";
  const aoi = fixtureAois.find((a) => a.aoi_id === aoiId) ?? fixtureAois[0]!;
  const seed = tileId.length;
  return {
    tile_id: tileId,
    vector_id: 1000 + seed,
    aoi_id: aoiId,
    scene_id: `${aoiId}-S2-${date.replace(/-/g, "")}`,
    date,
    acquisition_date_source: "metadata_xml",
    sensor: "S2A_MSI",
    lat: aoi.bbox[1] + 0.05,
    lon: aoi.bbox[0] + 0.05,
    bbox: aoi.bbox,
    ndvi_mean: Number((0.12 + (seed % 20) / 100).toFixed(3)),
    ndwi_mean: Number((-0.18 + (seed % 15) / 100).toFixed(3)),
    cloud_fraction: Number(((seed % 12) / 100).toFixed(2)),
    valid_pixel_fraction: Number((0.88 + (seed % 8) / 100).toFixed(2)),
    cluster_id: (seed % 5) + 1,
    processing_version: "fixture-v0",
    thumbnail_url: fixturePanel(`${tileId}-thumb`, 240, 240),
  };
}

function resultFrom(tileId: string, similarity: number): SearchResult {
  const tile = fixtureTile(tileId);
  const aoi = fixtureAois.find((a) => a.aoi_id === tile.aoi_id);
  return {
    tile_id: tile.tile_id,
    vector_id: tile.vector_id,
    aoi_id: tile.aoi_id,
    aoi_name: aoi?.name ?? null,
    date: tile.date,
    similarity,
    lat: tile.lat,
    lon: tile.lon,
    thumbnail_url: tile.thumbnail_url,
  };
}

export function fixtureSearchResults(topK = 12): SearchResult[] {
  const out: SearchResult[] = [];
  const aois = ["dholera-sir", "jewar-airport", "navi-mumbai-airport"];
  for (let i = 0; i < topK; i += 1) {
    const aoiId = aois[i % 3]!;
    const dates = dateSets[aoiId]!;
    const date = dates[i % dates.length]!;
    out.push(
      resultFrom(`${aoiId}_${date}_r${i % 8}c${(i * 3) % 8}`, Number((0.94 - i * 0.03).toFixed(3))),
    );
  }
  return out;
}

export const fixtureCandidates: ChangeCandidate[] = [
  {
    candidate_id: "cand-001",
    vector_id: 1042,
    tile_id: "dholera-sir_2024-11-08_r3c4",
    aoi_id: "dholera-sir",
    aoi_name: fixtureAois[0]!.name,
    before_date: "2023-06-22",
    after_date: "2024-11-08",
    embedding_drift: 0.418,
    spectral_delta: 0.221,
    combined_score: 0.874,
    change_type: "construction",
    confidence: 0.87,
    status: "OPEN",
    suppressed: false,
    suppression_reason: null,
    earliest_supported_date: "2024-04-18",
    before_thumbnail_url: fixturePanel("cand-001-before", 240, 240),
    after_thumbnail_url: fixturePanel("cand-001-after", 240, 240),
  },
  {
    candidate_id: "cand-002",
    vector_id: 1087,
    tile_id: "jewar-airport_2024-10-21_r5c2",
    aoi_id: "jewar-airport",
    aoi_name: fixtureAois[1]!.name,
    before_date: "2023-07-19",
    after_date: "2024-10-21",
    embedding_drift: 0.362,
    spectral_delta: 0.309,
    combined_score: 0.802,
    change_type: "land_clearing",
    confidence: 0.79,
    status: "CONFIRMED",
    suppressed: false,
    suppression_reason: null,
    earliest_supported_date: "2024-01-08",
    before_thumbnail_url: fixturePanel("cand-002-before", 240, 240),
    after_thumbnail_url: fixturePanel("cand-002-after", 240, 240),
  },
  {
    candidate_id: "cand-003",
    vector_id: 1120,
    tile_id: "navi-mumbai-airport_2024-09-30_r1c6",
    aoi_id: "navi-mumbai-airport",
    aoi_name: fixtureAois[2]!.name,
    before_date: "2023-08-14",
    after_date: "2024-09-30",
    embedding_drift: 0.288,
    spectral_delta: 0.114,
    combined_score: 0.611,
    change_type: "water_change",
    confidence: 0.62,
    status: "SUPPRESSED",
    suppressed: true,
    suppression_reason: "cloud_fraction_too_high_after=0.40, valid_pixel_fraction_low=0.61",
    earliest_supported_date: null,
    before_thumbnail_url: fixturePanel("cand-003-before", 240, 240),
    after_thumbnail_url: fixturePanel("cand-003-after", 240, 240),
  },
  {
    candidate_id: "cand-004",
    vector_id: 1155,
    tile_id: "dholera-sir_2024-08-02_r6c1",
    aoi_id: "dholera-sir",
    aoi_name: fixtureAois[0]!.name,
    before_date: "2023-11-30",
    after_date: "2024-08-02",
    embedding_drift: 0.201,
    spectral_delta: 0.086,
    combined_score: 0.463,
    change_type: "vegetation_loss",
    confidence: 0.48,
    status: "REJECTED",
    suppressed: false,
    suppression_reason: null,
    earliest_supported_date: "2024-04-18",
    before_thumbnail_url: fixturePanel("cand-004-before", 240, 240),
    after_thumbnail_url: fixturePanel("cand-004-after", 240, 240),
  },
];

export function fixtureChangeDetail(candidate: ChangeCandidate): ChangeDetail {
  const tile = fixtureTile(candidate.tile_id);
  const dates = dateSets[candidate.aoi_id] ?? [];
  return {
    ...candidate,
    before_image_url: fixturePanel(`${candidate.candidate_id}-before-full`, 640, 640),
    after_image_url: fixturePanel(`${candidate.candidate_id}-after-full`, 640, 640),
    lat: tile.lat,
    lon: tile.lon,
    bbox: tile.bbox,
    ndvi_series: dates.map((date, i) => ({
      date,
      ndvi_mean: Number((0.34 - i * 0.04).toFixed(3)),
      ndwi_mean: Number((-0.1 - i * 0.01).toFixed(3)),
      cloud_fraction: Number((((i * 5) % 20) / 100).toFixed(2)),
    })),
    quality_notes: candidate.suppressed
      ? ["Backend flagged quality confounds for this pair."]
      : ["Valid pixel fraction within backend threshold."],
    acquisition_date_source: "metadata_xml",
    processing_version: "fixture-v0",
    evidence: {
      before_date: candidate.before_date,
      after_date: candidate.after_date,
      change_region: "tile footprint",
      visual_difference_summary: "Spectral/visual difference is present in the compared tile.",
      before_ndvi: candidate.spectral_delta ? 0.62 : null,
      after_ndvi: candidate.spectral_delta
        ? Number((0.62 - candidate.spectral_delta).toFixed(3))
        : null,
      ndvi_change: candidate.spectral_delta ? -candidate.spectral_delta : null,
      spectral_change: candidate.spectral_delta,
      semantic_change: candidate.embedding_drift,
      quality: candidate.suppressed ? "limited or confounded" : "sufficient",
      confound_information: candidate.suppressed
        ? ["Backend flagged quality confounds for this pair."]
        : [],
      candidate_interpretation: candidate.change_type
        ? `Candidate interpretation: likely ${candidate.change_type.replace("_", " ")}.`
        : "Significant spectral/visual change detected, but change type is uncertain.",
      confidence: candidate.confidence,
      difference_image_url: null,
    },
  };
}

export const fixtureAudit: AuditLogEntry[] = [
  {
    log_id: "log-001",
    candidate_id: "cand-002",
    tile_id: "jewar-airport_2024-10-21_r5c2",
    decision: "CONFIRM",
    reason: "Runway earthworks visible in after image.",
    created_at: "2024-10-22T09:14:00Z",
  },
  {
    log_id: "log-002",
    candidate_id: "cand-004",
    tile_id: "dholera-sir_2024-08-02_r6c1",
    decision: "REJECT",
    reason: "Seasonal vegetation variation.",
    created_at: "2024-08-05T11:02:00Z",
  },
];

export const fixtureClusters: Cluster[] = [1, 2, 3, 4, 5].map((id) => ({
  cluster_id: id,
  member_count: 8 + id * 3,
  representative_thumbnail_url: fixturePanel(`cluster-${id}`, 240, 240),
  aoi_ids: fixtureAois.slice(0, ((id - 1) % 3) + 1).map((a) => a.aoi_id),
  label: null,
  start_date: "2023-01-14",
  end_date: "2024-11-08",
}));

export function fixtureClusterMembers(clusterId: number): ClusterMember[] {
  return Array.from({ length: 8 }, (_, i) => {
    const aoiId = fixtureAois[(clusterId + i) % 3]!.aoi_id;
    const dates = dateSets[aoiId]!;
    const date = dates[i % dates.length]!;
    return {
      tile_id: `${aoiId}_${date}_r${(clusterId + i) % 8}c${i % 8}`,
      vector_id: 2000 + clusterId * 10 + i,
      aoi_id: aoiId,
      date,
      thumbnail_url: fixturePanel(`cluster-${clusterId}-member-${i}`, 200, 200),
    };
  });
}

export const fixtureStats: Stats = {
  aoi_count: 3,
  scene_count: 16,
  tile_count: 192,
  vector_count: 192,
  candidates_scored: 48,
  candidates_promoted: 12,
  candidates_confirmed: 4,
  candidates_suppressed: 6,
  processing_version: "fixture-v0",
  last_run: "2024-11-08T06:12:00Z",
};

const jobs = new Map<string, { started: number; name: string }>();

export function fixtureStartOnboard(name: string): OnboardJob {
  const jobId = `job-${jobs.size + 1}`;
  jobs.set(jobId, { started: Date.now(), name });
  return {
    job_id: jobId,
    status: "queued",
    progress: 0,
    message: "Job queued (FIXTURE)",
    aoi_id: null,
    scenes_found: null,
    scenes_ingested: null,
    scenes_failed: null,
    tiles_added: null,
    warnings: [],
    scenes: [],
  };
}

export function fixtureOnboardJob(jobId: string): OnboardJob {
  const job = jobs.get(jobId);
  const elapsed = job ? (Date.now() - job.started) / 1000 : 99;
  if (elapsed < 2) {
    return {
      job_id: jobId,
      status: "queued",
      progress: 0,
      message: "Job queued (FIXTURE)",
      aoi_id: null,
      scenes_found: null,
      scenes_ingested: null,
      scenes_failed: null,
      tiles_added: null,
      warnings: [],
      scenes: [],
    };
  }
  if (elapsed < 8) {
    return {
      job_id: jobId,
      status: "running",
      progress: Math.min(0.95, (elapsed - 2) / 6),
      message: "Ingesting staged scenes (FIXTURE)",
      aoi_id: null,
      scenes_found: 4,
      scenes_ingested: Math.floor(Math.min(4, (elapsed - 2) / 1.5)),
      scenes_failed: 0,
      tiles_added: null,
      warnings: [],
      scenes: [],
    };
  }
  return {
    job_id: jobId,
    status: "done",
    progress: 1,
    message: "Onboarding complete (FIXTURE)",
    aoi_id: "fixture-new-aoi",
    scenes_found: 4,
    scenes_ingested: 3,
    scenes_failed: 1,
    tiles_added: 192,
    warnings: ["1 scene missing metadata XML; acquisition date derived from filename."],
    scenes: [
      { scene_id: "S2A_20240418", date: "2024-04-18", status: "ingested", message: null },
      { scene_id: "S2A_20240802", date: "2024-08-02", status: "ingested", message: null },
      { scene_id: "S2B_20241108", date: "2024-11-08", status: "ingested", message: null },
      { scene_id: "S2B_unknown", date: null, status: "failed", message: "Unreadable band raster." },
    ],
  };
}
