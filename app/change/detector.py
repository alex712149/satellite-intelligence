"""
Stage 11 -- Temporal Pairing
Stage 12 -- Hybrid Change Scoring
Stage 13 -- False-Alarm Suppression
Stage 15 -- Earliest Supported Observation

Refinement 3.3 from the architecture review: CLIP embedding drift alone
is not the whole detector -- it also moves for season/illumination
reasons that have nothing to do with real change. So every pair gets
TWO independent signals combined into one score:
  - embedding_drift   : 1 - cosine_similarity(vec_before, vec_after)
  - spectral_delta    : |NDVI_after - NDVI_before| (a physically
                         grounded second opinion the embedding can't fake)
A pair is only promoted to the review queue if BOTH signals agree
there's something there AND the quality gates in Stage 13 pass.
"""
from dataclasses import dataclass

import numpy as np

from app.config import DEFAULT_CHANGE_THRESHOLD, MAX_CLOUD_FRACTION, MIN_VALID_PIXEL_FRACTION
from app.geospatial import catalog_db as db
from app.index.vector_index import VectorIndex


@dataclass
class ChangeCandidate:
    tile_id: str
    vector_id_before: int
    vector_id_after: int
    date_before: str
    date_after: str
    embedding_drift: float
    spectral_delta: float
    combined_score: float
    suppressed: bool
    suppression_reason: str | None


def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    # Vectors are already L2-normalized by the embedder, but we
    # normalize again defensively -- cheap, and safe if that ever changes.
    a = a / (np.linalg.norm(a) + 1e-8)
    b = b / (np.linalg.norm(b) + 1e-8)
    return float(np.dot(a, b))


def _quality_gate(before_row, after_row) -> str | None:
    """Stage 13. Returns a suppression reason string, or None if the
    pair is clean enough to trust. Order matters only for readability
    of the logged reason -- checks are independent."""
    for row, label in ((before_row, "before"), (after_row, "after")):
        if row["cloud_fraction"] is not None and row["cloud_fraction"] > MAX_CLOUD_FRACTION:
            return f"cloud_fraction_too_high_{label}={row['cloud_fraction']:.2f}"
        if row["cloud_fraction"] is not None and row["valid_pixel_fraction"] < MIN_VALID_PIXEL_FRACTION:
            return f"insufficient_valid_pixels_{label}={row['valid_pixel_fraction']:.2f}"
        if row["snow_fraction"] is not None and row["snow_fraction"] > 0.30:
            return f"snow_cover_too_high_{label}={row['snow_fraction']:.2f}"
    # Seasonal water-extent swing that is fully explained by NDWI, not
    # a real structural change -- a common false positive source.
    ndwi_delta = abs(after_row["ndwi_mean"] - before_row["ndwi_mean"])
    if ndwi_delta > 0.35 and abs(after_row["ndvi_mean"] - before_row["ndvi_mean"]) < 0.05:
        return f"likely_seasonal_water_variation_ndwi_delta={ndwi_delta:.2f}"
    return None


def analyze_tile_pair(before_row, after_row, threshold: float = DEFAULT_CHANGE_THRESHOLD) -> ChangeCandidate:
    index = VectorIndex()
    vec_before = index.get_vector(before_row["vector_id"])
    vec_after = index.get_vector(after_row["vector_id"])

    embedding_drift = 1.0 - _cosine_similarity(vec_before, vec_after)
    spectral_delta = abs(after_row["ndvi_mean"] - before_row["ndvi_mean"])

    # Weighted combination: embedding drift captures broad visual/semantic
    # change, spectral delta anchors it to a physical vegetation/structure
    # signal so a pure-embedding artifact can't pass alone.
    combined_score = 0.65 * embedding_drift + 0.35 * min(spectral_delta / 0.5, 1.0)

    suppression_reason = _quality_gate(before_row, after_row)
    suppressed = suppression_reason is not None or combined_score < threshold

    return ChangeCandidate(
        tile_id=before_row["tile_id"],
        vector_id_before=before_row["vector_id"], vector_id_after=after_row["vector_id"],
        date_before=before_row["acquisition_date"], date_after=after_row["acquisition_date"],
        embedding_drift=embedding_drift, spectral_delta=spectral_delta,
        combined_score=combined_score, suppressed=suppressed,
        suppression_reason=suppression_reason if suppression_reason else
            (None if not suppressed else f"below_threshold_{combined_score:.3f}<{threshold}"),
    )


def analyze_tile_timeline(tile_id: str, threshold: float = DEFAULT_CHANGE_THRESHOLD) -> list[ChangeCandidate]:
    """Stage 11: walk one ground cell's observations chronologically
    and score every consecutive pair. Consecutive (not all-pairs) is
    what lets Stage 15 report an 'earliest supported observation'
    instead of just a single before/after."""
    history = db.get_tile_history(tile_id)
    candidates = []
    for i in range(len(history) - 1):
        candidates.append(analyze_tile_pair(history[i], history[i + 1], threshold))
    return candidates


def earliest_supported_observation(candidates: list[ChangeCandidate]) -> str | None:
    """Stage 15: scan chronologically-ordered candidates (as returned by
    analyze_tile_timeline) and return the date of the FIRST pair where
    change was supported and NOT suppressed, i.e. the earliest point the
    evidence actually holds up -- not just the most recent flag."""
    for c in candidates:
        if not c.suppressed:
            return c.date_after
    return None


def run_change_detection_for_all_tiles(threshold: float = DEFAULT_CHANGE_THRESHOLD) -> list[int]:
    """Orchestrator used by the CLI / future /change/analyze endpoint:
    scans every ground cell with 2+ observations, persists every
    candidate (suppressed or not, for audit completeness), and returns
    the candidate_ids that made it past suppression."""
    promoted_ids = []
    for tile_id in db.get_all_tile_ids():
        candidates = analyze_tile_timeline(tile_id, threshold)
        for c in candidates:
            candidate_id = db.insert_change_candidate(
                tile_id=c.tile_id,
                vector_id_before=c.vector_id_before, vector_id_after=c.vector_id_after,
                date_before=c.date_before, date_after=c.date_after,
                embedding_drift=c.embedding_drift, spectral_delta=c.spectral_delta,
                combined_score=c.combined_score, suppressed=int(c.suppressed),
                suppression_reason=c.suppression_reason,
                change_type=None, change_type_confidence=None, earliest_supported_date=None,
            )
            if not c.suppressed:
                from app.change.classifier import classify_change_type

                after_tile = db.get_tile(c.vector_id_after)
                if after_tile is None:
                    raise ValueError(f"Promoted candidate references missing after tile: {c.vector_id_after}")
                interpretation = classify_change_type(after_tile["tile_path"])
                with db.get_conn() as conn:
                    conn.execute(
                        "UPDATE change_candidates SET change_type=?, change_type_confidence=? WHERE candidate_id=?",
                        (interpretation.change_type, interpretation.confidence, candidate_id),
                    )
                promoted_ids.append(candidate_id)
    return promoted_ids
