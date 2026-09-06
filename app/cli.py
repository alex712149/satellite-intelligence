"""
Single command-line entry point for every stage of the pipeline.
This is deliberately a thin dispatcher -- all real logic lives in
app/*, so this file is what changes least when you later wrap the
same functions in FastAPI endpoints.

Usage:
    python -m app.cli ingest data/raw/aoi_2025-01-15.tif 2025-01-15 SENTINEL2_SYNTHETIC
    python -m app.cli detect-changes
    python -m app.cli cluster
    python -m app.cli search-text "newly built structures near a river"
    python -m app.cli review-queue
    python -m app.cli decide 5 confirm
    python -m app.cli stats
"""
import argparse
import json
import logging
from pathlib import Path
import sys
import time

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


def cmd_ingest(args):
    from app.pipeline.ingest import ingest_scene
    t0 = time.time()
    result = ingest_scene(args.scene_path, args.date, args.sensor)
    result["seconds"] = round(time.time() - t0, 2)
    print(json.dumps(result, indent=2))


def cmd_reingest(args):
    from app.geospatial import catalog_db as db
    from app.index.vector_index import VectorIndex
    from app.pipeline.ingest import ingest_scene

    scene_path = str(Path(args.scene_path))
    with db.get_conn() as conn:
        existing = conn.execute("SELECT * FROM scenes WHERE scene_path = ?", (scene_path,)).fetchone()
    if existing is None:
        raise ValueError(f"Scene is not registered and cannot be reingested: {scene_path}")
    metadata = json.loads(existing["source_metadata"]) if existing["source_metadata"] else None
    removed = db.purge_scene(scene_path)
    for tile_path in removed["tile_paths"]:
        Path(tile_path).unlink(missing_ok=True)
    index = VectorIndex()
    index.remove(removed["vector_ids"])
    index.save()
    result = ingest_scene(
        scene_path,
        existing["acquisition_date"],
        existing["sensor"],
        aoi_id=existing["aoi_id"],
        acquisition_date_source=existing["acquisition_date_source"],
        cloud_cover_percent=existing["cloud_cover_percent"],
        source_metadata=metadata,
    )
    result.update({"removed_vectors": len(removed["vector_ids"]), "removed_tiles": len(removed["tile_paths"])})
    print(json.dumps(result, indent=2))


def cmd_detect_changes(args):
    from app.change.detector import run_change_detection_for_all_tiles
    from app.change.classifier import classify_change_type
    from app.geospatial import catalog_db as db

    promoted_ids = run_change_detection_for_all_tiles(threshold=args.threshold)
    print(f"Promoted {len(promoted_ids)} candidates past suppression (threshold={args.threshold})")

    if args.classify:
        with db.get_conn() as conn:
            for cid in promoted_ids:
                row = conn.execute(
                    "SELECT * FROM change_candidates WHERE candidate_id = ?", (cid,)
                ).fetchone()
                after_tile = db.get_tile(row["vector_id_after"])
                result = classify_change_type(after_tile["tile_path"])
                conn.execute(
                    "UPDATE change_candidates SET change_type=?, change_type_confidence=? WHERE candidate_id=?",
                    (result.change_type, result.confidence, cid),
                )
                print(f"  candidate {cid}: {result.change_type} ({result.confidence:.2f})")


def cmd_cluster(args):
    from app.discovery.clustering import cluster_all_tiles
    assignment = cluster_all_tiles(min_cluster_size=args.min_cluster_size)
    n_clusters = len(set(assignment.values()) - {-1})
    n_noise = sum(1 for v in assignment.values() if v == -1)
    print(f"Clustered {len(assignment)} tiles into {n_clusters} clusters ({n_noise} unclustered/noise)")


def cmd_search_text(args):
    from app.index.search import text_search
    results = text_search(args.query, top_k=args.top_k)
    for r in results:
        print(f"{r.similarity:.4f}  {r.tile_id}  {r.acquisition_date}  {r.tile_path}")


def cmd_review_queue(args):
    from app.review.queue import get_review_queue
    for item in get_review_queue(limit=args.limit):
        print(f"[{item.candidate_id}] {item.tile_id} {item.date_before}->{item.date_after} "
              f"score={item.combined_score:.3f} type={item.change_type}")


def cmd_decide(args):
    from app.review.queue import submit_decision
    submit_decision(args.candidate_id, args.decision, reason=args.reason)
    print(f"Recorded '{args.decision}' for candidate {args.candidate_id}")


def cmd_stats(args):
    from app.geospatial import catalog_db as db
    from app.index.vector_index import VectorIndex
    with db.get_conn() as conn:
        n_scenes = conn.execute("SELECT COUNT(*) c FROM scenes").fetchone()["c"]
        n_tiles = conn.execute("SELECT COUNT(*) c FROM tiles").fetchone()["c"]
        n_candidates = conn.execute("SELECT COUNT(*) c FROM change_candidates").fetchone()["c"]
        n_promoted = conn.execute("SELECT COUNT(*) c FROM change_candidates WHERE suppressed=0").fetchone()["c"]
    index = VectorIndex()
    print(json.dumps({
        "scenes_ingested": n_scenes,
        "tiles_indexed": n_tiles,
        "faiss_ntotal": index.ntotal,
        "change_candidates_scored": n_candidates,
        "change_candidates_promoted": n_promoted,
    }, indent=2))


def cmd_add_aoi(args):
    from app.pipeline.onboard_aoi import onboard_aoi, print_onboard_report
    report = onboard_aoi(args.aoi_name, args.source_folder, sensor=args.sensor)
    print_onboard_report(report)


def cmd_inspect_zip(args):
    from app.geospatial.copernicus_metadata import inspect_zip
    info = inspect_zip(args.zip_path)
    print("Files inside zip:")
    for f in info["files"]:
        print(" -", f)
    print("\nParsed JSON contents:")
    print(json.dumps(info["json_contents"], indent=2))


def cmd_list_aois(args):
    from app.geospatial import catalog_db as db
    for aoi in db.list_aois():
        print(dict(aoi))


def main():
    parser = argparse.ArgumentParser(description="Satellite Intelligence pipeline CLI")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("ingest", help="Ingest one GeoTIFF/COG scene")
    p.add_argument("scene_path")
    p.add_argument("date", help="Acquisition date, e.g. 2025-06-10")
    p.add_argument("sensor", help="e.g. SENTINEL2")
    p.set_defaults(func=cmd_ingest)

    p = sub.add_parser("reingest", help="Purge and reingest one already registered repaired scene")
    p.add_argument("scene_path")
    p.set_defaults(func=cmd_reingest)

    p = sub.add_parser("detect-changes", help="Run temporal change detection over all ingested tiles")
    p.add_argument("--threshold", type=float, default=0.22)
    p.add_argument("--classify", action="store_true", default=True, help="Run zero-shot change-type classification (default)")
    p.set_defaults(func=cmd_detect_changes)

    p = sub.add_parser("cluster", help="Run discovery clustering over all indexed tiles")
    p.add_argument("--min-cluster-size", dest="min_cluster_size", type=int, default=3)
    p.set_defaults(func=cmd_cluster)

    p = sub.add_parser("search-text", help="Semantic text search")
    p.add_argument("query")
    p.add_argument("--top-k", dest="top_k", type=int, default=10)
    p.set_defaults(func=cmd_search_text)

    p = sub.add_parser("review-queue", help="List unresolved change candidates")
    p.add_argument("--limit", type=int, default=50)
    p.set_defaults(func=cmd_review_queue)

    p = sub.add_parser("decide", help="Confirm or reject a change candidate")
    p.add_argument("candidate_id", type=int)
    p.add_argument("decision", choices=["confirm", "reject"])
    p.add_argument("--reason", default=None)
    p.set_defaults(func=cmd_decide)

    p = sub.add_parser("stats", help="Print pipeline / evaluation-report numbers")
    p.set_defaults(func=cmd_stats)

    p = sub.add_parser("add-aoi", help="Onboard a brand-new AOI from a folder of Copernicus zips or tifs")
    p.add_argument("aoi_name", help="e.g. dholera, site2, site3")
    p.add_argument("source_folder", help="Folder containing .zip (Copernicus export) and/or .tif files")
    p.add_argument("--sensor", default="SENTINEL2_L2A")
    p.set_defaults(func=cmd_add_aoi)

    p = sub.add_parser("inspect-zip", help="Debug: show every file + parsed JSON inside one Copernicus zip")
    p.add_argument("zip_path")
    p.set_defaults(func=cmd_inspect_zip)

    p = sub.add_parser("list-aois", help="List every onboarded AOI and its date/bbox extent")
    p.set_defaults(func=cmd_list_aois)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    sys.exit(main())
