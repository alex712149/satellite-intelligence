# SENTINEL INTELLIGENCE — Frontend API Contract

The frontend talks to the backend **only** through `src/lib/api.ts`.
Set `VITE_API_BASE_URL` (default `http://127.0.0.1:8000`) and `VITE_USE_FIXTURES=false`
for the real FastAPI backend. Fixtures (`src/lib/fixtures/`) are synthetic, watermarked
`FIXTURE — NOT SATELLITE DATA`, and used for frontend development only.

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/stats` | `Stats` — `aoi_count, scene_count, tile_count, vector_count, candidates_scored, candidates_promoted, candidates_confirmed, candidates_suppressed, processing_version, last_run` |
| GET | `/aois` | `AOI[]` — `aoi_id, name, bbox, scene_count, tile_count, first_date, last_date, mosaic_thumbnail_url` |
| GET | `/aois/{aoi_id}/timeline` | `TimelineEntry[]` — `date, scene_id, sensor, cloud_fraction, tile_count, acquisition_date_source, thumbnail_url` |
| GET | `/aois/{aoi_id}/mosaic?date=` | `Mosaic` — `image_url, width, height, tiles[] (tile_id, x, y, w, h, cluster_id, has_change, vector_id)` |
| GET | `/tiles/{tile_id}` | `TileDetail` — ids, `date`, sensor/source provenance, `lat/lon`, `bbox`, `ndvi_mean`, `ndwi_mean`, `cloud_fraction`, `valid_pixel_fraction`, `cluster_id`, `processing_version`, `thumbnail_url` |
| GET | `/tiles/{tile_id}/similar?k=` | `SearchResult[]` |
| POST | `/search/text` | `SearchResult[]` — body `{ query, aoi_id?, date?, k }` |
| POST | `/search/image` | `SearchResult[]` — multipart `file`, `aoi_id?`, `k` |
| GET | `/changes/candidates?status=&aoi_id=` | `ChangeCandidate[]` — includes `embedding_drift, spectral_delta, combined_score, change_type, confidence, suppressed, suppression_reason` (free-form backend text) |
| GET | `/changes/{vector_id}` | `ChangeDetail` — before/after image URLs, `ndvi_series`, `quality_notes`, `earliest_supported_date`, `acquisition_date_source` |
| POST | `/review/{candidate_id}/decision` | body `{ decision: "CONFIRM" \| "REJECT", reason: string \| null }` |
| GET | `/review/audit-log` | `AuditEntry[]` — `log_id, candidate_id, tile_id, decision, reason, created_at` |
| GET | `/clusters` | `Cluster[]` — `cluster_id, member_count, aoi_ids, representative_thumbnail_url` |
| GET | `/clusters/{cluster_id}/members` | `ClusterMember[]` |
| POST | `/aois/onboard` | `OnboardJob` — body `{ name, source_folder }` |
| GET | `/aois/onboard/{job_id}` | `OnboardJob` — `status (queued\|running\|done\|failed), progress, scenes_found/ingested/failed, tiles_added, warnings[], scenes[]` |

All analytical values must be computed by the backend; the frontend renders them
verbatim with explicit loading, empty, unavailable and error states.
