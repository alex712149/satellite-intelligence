/** API contract types. Field names mirror the backend SQLite catalog columns. */

export interface AOI {
  aoi_id: string;
  name: string;
  bbox: [number, number, number, number];
  start_date: string | null;
  end_date: string | null;
  scene_count: number;
  tile_count: number;
  mosaic_thumbnail_url: string | null;
  last_activity: string | null;
}

export interface TimelineEntry {
  date: string;
  scene_id: string;
  sensor: string | null;
  cloud_fraction: number | null;
  tile_count: number;
  acquisition_date_source: string | null;
  thumbnail_url: string | null;
}

export interface MosaicTile {
  tile_id: string;
  vector_id: number | null;
  x: number;
  y: number;
  width: number;
  height: number;
  cluster_id: number | null;
  has_change_candidate: boolean;
}

export interface Mosaic {
  aoi_id: string;
  date: string;
  image_url: string;
  width: number;
  height: number;
  tiles: MosaicTile[];
}

export interface TileDetail {
  tile_id: string;
  vector_id: number | null;
  aoi_id: string;
  scene_id: string;
  date: string;
  acquisition_date_source: string | null;
  sensor: string | null;
  lat: number;
  lon: number;
  bbox: [number, number, number, number];
  ndvi_mean: number | null;
  ndwi_mean: number | null;
  cloud_fraction: number | null;
  valid_pixel_fraction: number | null;
  cluster_id: number | null;
  processing_version: string | null;
  thumbnail_url: string | null;
}

export interface SearchResult {
  tile_id: string;
  vector_id: number | null;
  aoi_id: string;
  aoi_name: string | null;
  date: string;
  similarity: number;
  lat: number;
  lon: number;
  thumbnail_url: string | null;
}

export interface SearchResponse {
  query: string | null;
  results: SearchResult[];
}

export interface TextSearchRequest {
  query: string;
  aoi_id?: string | null;
  date?: string | null;
  k?: number;
}

export type ReviewStatus = "OPEN" | "CONFIRMED" | "REJECTED" | "SUPPRESSED";

export interface ChangeCandidate {
  candidate_id: string;
  vector_id: number | null;
  tile_id: string;
  aoi_id: string;
  aoi_name: string | null;
  before_date: string;
  after_date: string;
  embedding_drift: number | null;
  spectral_delta: number | null;
  combined_score: number | null;
  change_type: string | null;
  confidence: number | null;
  status: ReviewStatus;
  suppressed: boolean;
  suppression_reason: string | null;
  earliest_supported_date: string | null;
  before_thumbnail_url: string | null;
  after_thumbnail_url: string | null;
}

export interface ReviewQuality {
  excluded_source_unavailable: number;
  displayable_candidate_count: number;
}

export interface NdviPoint {
  date: string;
  ndvi_mean: number | null;
  ndwi_mean: number | null;
  cloud_fraction: number | null;
}

export interface ChangeDetail extends ChangeCandidate {
  before_image_url: string | null;
  after_image_url: string | null;
  lat: number;
  lon: number;
  bbox: [number, number, number, number];
  ndvi_series: NdviPoint[];
  quality_notes: string[];
  acquisition_date_source: string | null;
  processing_version: string | null;
  evidence: ChangeEvidence;
}

export interface ChangeEvidence {
  before_date: string;
  after_date: string;
  change_region: string | null;
  visual_difference_summary: string;
  before_ndvi: number | null;
  after_ndvi: number | null;
  ndvi_change: number | null;
  spectral_change: number | null;
  semantic_change: number | null;
  quality: string;
  confound_information: string[];
  candidate_interpretation: string;
  confidence: number | null;
  difference_image_url: string | null;
}

export interface ReviewDecisionRequest {
  decision: "CONFIRM" | "REJECT";
  reason?: string | null;
}

export interface AuditLogEntry {
  log_id: string;
  candidate_id: string;
  tile_id: string | null;
  decision: string;
  reason: string | null;
  created_at: string;
}

export interface Cluster {
  cluster_id: number;
  member_count: number;
  representative_thumbnail_url: string | null;
  aoi_ids: string[];
  label: string | null;
  start_date: string | null;
  end_date: string | null;
}

export interface ClusterMember {
  tile_id: string;
  vector_id: number | null;
  aoi_id: string;
  date: string;
  thumbnail_url: string | null;
}

export interface Stats {
  aoi_count: number;
  scene_count: number;
  tile_count: number;
  vector_count: number;
  candidates_scored: number;
  candidates_promoted: number;
  candidates_confirmed: number;
  candidates_suppressed: number;
  processing_version: string | null;
  last_run: string | null;
}

export interface OnboardScene {
  scene_id: string;
  date: string | null;
  status: string;
  message: string | null;
}

export interface OnboardJob {
  job_id: string;
  status: "queued" | "running" | "done" | "failed";
  progress: number;
  message: string | null;
  aoi_id: string | null;
  scenes_found: number | null;
  scenes_ingested: number | null;
  scenes_failed: number | null;
  tiles_added: number | null;
  warnings: string[];
  scenes: OnboardScene[];
}

export interface OnboardRequest {
  name: string;
  source_folder: string;
}
