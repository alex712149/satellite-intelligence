"""
Per-cluster change-score threshold calibration.

Why this exists: a single global threshold treats a desert tile and a
dense river-delta tile the same, even though "normal" embedding drift
between two dates is very different for each (deserts barely change
visually season to season; river deltas do, a lot, for entirely benign
reasons). Calibrating one threshold PER LAND-COVER CLUSTER (using the
cluster_id already written by app/discovery/clustering.py) gives each
neighbourhood of the embedding space its own notion of "normal", which
is the direct, checkable claim behind the "favour precision over
indiscriminate recall" requirement (2.2.3).

Calibration needs labelled change / no-change pairs. In the SIH
evaluation these are the organiser's held-out set; for local testing,
pass in your own list of (tile_id, is_known_change) pairs from
scores you already trust.
"""
from dataclasses import dataclass

import numpy as np

from app.change.detector import analyze_tile_timeline
from app.geospatial import catalog_db as db


@dataclass
class CalibrationResult:
    cluster_id: int
    threshold: float
    n_examples: int


def calibrate_global_threshold(known_pairs: list[tuple[str, bool]]) -> float:
    """known_pairs: (tile_id, is_known_change). Returns the score that
    best separates the two groups on this sample -- the midpoint
    between the highest-scoring known no-change and the lowest-scoring
    known change, which is the simplest defensible calibration for a
    small prototype labelled set."""
    change_scores, no_change_scores = [], []
    for tile_id, is_change in known_pairs:
        candidates = analyze_tile_timeline(tile_id, threshold=0.0)  # score everything, don't filter yet
        if not candidates:
            continue
        best = max(c.combined_score for c in candidates)
        (change_scores if is_change else no_change_scores).append(best)

    if not change_scores or not no_change_scores:
        raise ValueError("Need at least one labelled change and one labelled no-change example")

    return (min(change_scores) + max(no_change_scores)) / 2.0


def calibrate_per_cluster(known_pairs: list[tuple[str, bool]]) -> dict[int, CalibrationResult]:
    """Same idea as calibrate_global_threshold but grouped by the
    cluster_id of each tile's most recent observation, so each
    land-cover neighbourhood gets its own threshold."""
    by_cluster: dict[int, list[tuple[float, bool]]] = {}

    for tile_id, is_change in known_pairs:
        history = db.get_tile_history(tile_id)
        if not history:
            continue
        cluster_id = history[-1]["cluster_id"]
        if cluster_id is None:
            continue
        candidates = analyze_tile_timeline(tile_id, threshold=0.0)
        if not candidates:
            continue
        best = max(c.combined_score for c in candidates)
        by_cluster.setdefault(cluster_id, []).append((best, is_change))

    results = {}
    for cluster_id, scored in by_cluster.items():
        changes = [s for s, is_c in scored if is_c]
        no_changes = [s for s, is_c in scored if not is_c]
        if not changes or not no_changes:
            continue  # not enough labelled diversity in this cluster to calibrate
        threshold = (min(changes) + max(no_changes)) / 2.0
        results[cluster_id] = CalibrationResult(
            cluster_id=cluster_id, threshold=threshold, n_examples=len(scored)
        )
    return results
