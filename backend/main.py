import io
import os
import threading
import uuid
from pathlib import Path
from typing import Annotated, Literal

import numpy as np
from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image
from pydantic import BaseModel, Field

from app.config import TILE_SIZE_PX
from app.discovery import clustering
from app.geospatial import catalog_db as db
from app.index import search as index_search
from app.index.vector_index import VectorIndex
from app.pipeline import onboard_aoi as onboarding
from app.review import queue as review_queue
from app.geospatial.rendering import has_valid_multispectral_data
from .rendering import difference_image, mosaic_thumbnail, tile_thumbnail

ROOT = Path(__file__).resolve().parent.parent
GENERATED_DIR = Path(os.getenv("SI_GENERATED_DIR", ROOT / "data" / "generated"))
FRONTEND_DIST = ROOT / "src" / "dist"
JOB_LOCK = threading.Lock()
JOBS: dict[str, dict] = {}


class ReviewDecision(BaseModel):
	decision: Literal["CONFIRM", "REJECT"]
	reason: str | None = None


class OnboardRequest(BaseModel):
	name: str
	source_folder: str


class Stats(BaseModel):
	aoi_count: int
	scene_count: int
	tile_count: int
	vector_count: int
	candidates_scored: int
	candidates_promoted: int
	candidates_confirmed: int
	candidates_suppressed: int
	processing_version: str | None
	last_run: str | None


class AOI(BaseModel):
	aoi_id: str
	name: str
	bbox: tuple[float, float, float, float]
	start_date: str | None
	end_date: str | None
	scene_count: int
	tile_count: int
	mosaic_thumbnail_url: str | None
	last_activity: str | None


class TimelineEntry(BaseModel):
	date: str
	scene_id: str
	sensor: str | None
	cloud_fraction: float | None
	tile_count: int
	acquisition_date_source: str | None
	thumbnail_url: str | None


class MosaicTile(BaseModel):
	tile_id: str
	vector_id: int | None
	x: int
	y: int
	width: int
	height: int
	cluster_id: int | None
	has_change_candidate: bool


class Mosaic(BaseModel):
	aoi_id: str
	date: str
	image_url: str
	width: int
	height: int
	tiles: list[MosaicTile]


class TileDetail(BaseModel):
	tile_id: str
	vector_id: int | None
	aoi_id: str
	scene_id: str
	date: str
	acquisition_date_source: str | None
	sensor: str | None
	lat: float
	lon: float
	bbox: tuple[float, float, float, float]
	ndvi_mean: float | None
	ndwi_mean: float | None
	cloud_fraction: float | None
	valid_pixel_fraction: float | None
	cluster_id: int | None
	processing_version: str | None
	thumbnail_url: str | None


class SearchResult(BaseModel):
	tile_id: str
	vector_id: int | None
	aoi_id: str
	aoi_name: str | None
	date: str
	similarity: float
	lat: float
	lon: float
	thumbnail_url: str | None


class ChangeCandidate(BaseModel):
	candidate_id: str
	vector_id: int | None
	tile_id: str
	aoi_id: str
	aoi_name: str | None
	before_date: str
	after_date: str
	embedding_drift: float | None
	spectral_delta: float | None
	combined_score: float | None
	change_type: str | None
	confidence: float | None
	status: Literal["OPEN", "CONFIRMED", "REJECTED", "SUPPRESSED"]
	suppressed: bool
	suppression_reason: str | None
	earliest_supported_date: str | None
	before_thumbnail_url: str | None
	after_thumbnail_url: str | None


class ReviewQuality(BaseModel):
	excluded_source_unavailable: int
	displayable_candidate_count: int


class NdviPoint(BaseModel):
	date: str
	ndvi_mean: float | None
	ndwi_mean: float | None
	cloud_fraction: float | None


class ChangeEvidence(BaseModel):
	before_date: str
	after_date: str
	change_region: str | None
	visual_difference_summary: str
	before_ndvi: float | None
	after_ndvi: float | None
	ndvi_change: float | None
	spectral_change: float | None
	semantic_change: float | None
	quality: str
	confound_information: list[str]
	candidate_interpretation: str
	confidence: float | None
	difference_image_url: str | None


class ChangeDetail(ChangeCandidate):
	before_image_url: str | None
	after_image_url: str | None
	lat: float
	lon: float
	bbox: tuple[float, float, float, float]
	ndvi_series: list[NdviPoint]
	quality_notes: list[str]
	acquisition_date_source: str | None
	processing_version: str | None
	evidence: ChangeEvidence


class ReviewResponse(BaseModel):
	ok: bool


class AuditLogEntry(BaseModel):
	log_id: str
	candidate_id: str
	tile_id: str | None
	decision: str
	reason: str | None
	created_at: str


class Cluster(BaseModel):
	cluster_id: int
	member_count: int
	aoi_ids: list[str]
	representative_thumbnail_url: str | None
	label: str | None
	start_date: str | None
	end_date: str | None


class ClusterMember(BaseModel):
	tile_id: str
	vector_id: int | None
	aoi_id: str
	date: str
	thumbnail_url: str | None


class OnboardScene(BaseModel):
	scene_id: str
	date: str | None
	status: str
	message: str | None


class OnboardJob(BaseModel):
	job_id: str
	status: Literal["queued", "running", "done", "failed"]
	progress: int
	message: str | None
	aoi_id: str | None
	scenes_found: int | None
	scenes_ingested: int | None
	scenes_failed: int | None
	tiles_added: int | None
	warnings: list[str]
	scenes: list[OnboardScene]


class TextSearchRequest(BaseModel):
	query: str
	aoi_id: str | None = None
	date: str | None = None
	date_from: str | None = None
	date_to: str | None = None
	k: int = Field(default=12, ge=1, le=100)


app = FastAPI(title="Satellite Intelligence API")
origins = [item.strip() for item in os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if item.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.mount("/generated", StaticFiles(directory=GENERATED_DIR, check_dir=False), name="generated")
db.init_db()


def public_url(request: Request, path: Path | None) -> str | None:
	if path is None:
		return None
	return f"{str(request.base_url).rstrip('/')}/generated/{path.relative_to(GENERATED_DIR).as_posix()}"


def scene_id(aoi_slug: str, date: str | None) -> str | None:
	return f"{aoi_slug}-S2-{date.replace('-', '')}" if date else None


def aoi_row(slug: str):
	row = db.get_aoi_by_name(slug)
	if row is None:
		raise HTTPException(404, f"AOI not found: {slug}")
	return row


def tile_bbox(row) -> list[float]:
	return [row["minlon"], row["minlat"], row["maxlon"], row["maxlat"]]


def tile_public(row, request: Request) -> dict:
	aoi = db.get_aoi(row["aoi_id"])
	thumbnail = None
	if row["tile_path"] and Path(row["tile_path"]).exists() and has_valid_multispectral_data(row["tile_path"]):
		thumbnail = public_url(request, tile_thumbnail(row["tile_path"], GENERATED_DIR / "thumbnails", row["vector_id"]))
	return {
		"tile_id": row["tile_id"], "vector_id": row["vector_id"], "aoi_id": aoi["name"] if aoi else str(row["aoi_id"]),
		"scene_id": scene_id(aoi["name"] if aoi else str(row["aoi_id"]), row["acquisition_date"]),
		"date": row["acquisition_date"], "acquisition_date_source": scene_source(row["scene_path"]),
		"sensor": row["sensor"], "lat": (row["minlat"] + row["maxlat"]) / 2, "lon": (row["minlon"] + row["maxlon"]) / 2,
		"bbox": tile_bbox(row), "ndvi_mean": row["ndvi_mean"], "ndwi_mean": row["ndwi_mean"],
		"cloud_fraction": row["cloud_fraction"], "valid_pixel_fraction": row["valid_pixel_fraction"],
		"cluster_id": row["cluster_id"], "processing_version": row["processing_version"], "thumbnail_url": thumbnail,
	}


def scene_source(scene_path: str) -> str | None:
	with db.get_conn() as conn:
		row = conn.execute("SELECT acquisition_date_source FROM scenes WHERE scene_path = ?", (scene_path,)).fetchone()
	return row["acquisition_date_source"] if row else None


def latest_decisions() -> dict[int, object]:
	with db.get_conn() as conn:
		rows = conn.execute("SELECT * FROM audit_log ORDER BY decided_at DESC, log_id DESC").fetchall()
	return {row["candidate_id"]: row for row in rows}


def candidate_status(row, decisions: dict[int, object]) -> str:
	if row["suppressed"]:
		return "SUPPRESSED"
	decision = decisions.get(row["candidate_id"])
	if decision is None:
		return "OPEN"
	return "CONFIRMED" if decision["analyst_decision"] == "confirm" else "REJECTED"


def candidate_public(row, request: Request, decisions: dict[int, object]) -> dict:
	before = db.get_tile(row["vector_id_before"])
	after = db.get_tile(row["vector_id_after"])
	aoi = db.get_aoi(after["aoi_id"] if after else None)
	before_url = public_url(request, tile_thumbnail(before["tile_path"], GENERATED_DIR / "thumbnails", before["vector_id"])) if before and Path(before["tile_path"]).exists() and has_valid_multispectral_data(before["tile_path"]) else None
	after_url = public_url(request, tile_thumbnail(after["tile_path"], GENERATED_DIR / "thumbnails", after["vector_id"])) if after and Path(after["tile_path"]).exists() and has_valid_multispectral_data(after["tile_path"]) else None
	return {
		"candidate_id": str(row["candidate_id"]), "vector_id": row["vector_id_after"], "tile_id": row["tile_id"],
		"aoi_id": aoi["name"] if aoi else None, "aoi_name": aoi["name"] if aoi else None,
		"before_date": row["date_before"], "after_date": row["date_after"], "embedding_drift": row["embedding_drift"],
		"spectral_delta": row["spectral_delta"], "combined_score": row["combined_score"], "change_type": row["change_type"],
		"confidence": row["change_type_confidence"], "status": candidate_status(row, decisions), "suppressed": bool(row["suppressed"]),
		"suppression_reason": row["suppression_reason"], "earliest_supported_date": row["earliest_supported_date"],
		"before_thumbnail_url": before_url, "after_thumbnail_url": after_url,
	}


def search_public(result, request: Request) -> dict:
	row = db.get_tile(result.vector_id)
	if row is None:
		return {}
	aoi = db.get_aoi(row["aoi_id"])
	thumbnail = public_url(request, tile_thumbnail(row["tile_path"], GENERATED_DIR / "thumbnails", row["vector_id"])) if Path(row["tile_path"]).exists() and has_valid_multispectral_data(row["tile_path"]) else None
	return {"tile_id": row["tile_id"], "vector_id": row["vector_id"], "aoi_id": aoi["name"] if aoi else None, "aoi_name": aoi["name"] if aoi else None,
			"date": row["acquisition_date"], "similarity": result.similarity, "lat": (row["minlat"] + row["maxlat"]) / 2,
			"lon": (row["minlon"] + row["maxlon"]) / 2, "thumbnail_url": thumbnail}


@app.get("/stats", response_model=Stats)
def stats():
	with db.get_conn() as conn:
		counts = {table: conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0] for table in ("aois", "scenes", "tiles", "change_candidates")}
		last_run = conn.execute("SELECT MAX(ingested_at) FROM scenes").fetchone()[0]
		confirmed = conn.execute("""SELECT COUNT(*) FROM change_candidates cc WHERE EXISTS
			(SELECT 1 FROM audit_log al WHERE al.candidate_id=cc.candidate_id AND al.analyst_decision='confirm'
			 AND al.log_id=(SELECT MAX(log_id) FROM audit_log WHERE candidate_id=cc.candidate_id))""").fetchone()[0]
	try:
		vector_count = VectorIndex().ntotal
	except Exception:
		vector_count = 0
	return {"aoi_count": counts["aois"], "scene_count": counts["scenes"], "tile_count": counts["tiles"], "vector_count": vector_count,
			"candidates_scored": counts["change_candidates"], "candidates_promoted": _count_unsuppressed(),
			"candidates_confirmed": confirmed, "candidates_suppressed": _count_suppressed(), "processing_version": db.PROCESSING_VERSION, "last_run": last_run}


def _count_suppressed() -> int:
	with db.get_conn() as conn:
		return conn.execute("SELECT COUNT(*) FROM change_candidates WHERE suppressed=1").fetchone()[0]


def _count_unsuppressed() -> int:
	with db.get_conn() as conn:
		return conn.execute("SELECT COUNT(*) FROM change_candidates WHERE suppressed=0").fetchone()[0]


def _index_count() -> int:
	try:
		return VectorIndex().ntotal
	except Exception:
		return 0


@app.get("/aois", response_model=list[AOI])
def aois(request: Request):
	with db.get_conn() as conn:
		rows = conn.execute("""SELECT a.*, COUNT(DISTINCT s.scene_path) scene_count, COUNT(DISTINCT t.vector_id) tile_count,
			MAX(cc.created_at) last_candidate FROM aois a LEFT JOIN scenes s ON s.aoi_id=a.aoi_id
			LEFT JOIN tiles t ON t.aoi_id=a.aoi_id LEFT JOIN change_candidates cc ON cc.tile_id=t.tile_id GROUP BY a.aoi_id ORDER BY a.name""").fetchall()
	result = []
	for row in rows:
		thumb = _latest_aoi_mosaic(row["aoi_id"], request)
		result.append({"aoi_id": row["name"], "name": row["name"], "bbox": [row["minlon"], row["minlat"], row["maxlon"], row["maxlat"]],
					   "start_date": row["first_date"], "end_date": row["last_date"], "scene_count": row["scene_count"], "tile_count": row["tile_count"],
					   "mosaic_thumbnail_url": thumb, "last_activity": row["last_candidate"] or row["last_date"]})
	return result


def _latest_aoi_mosaic(aoi_id: int, request: Request) -> str | None:
	with db.get_conn() as conn:
		date = conn.execute("SELECT MAX(acquisition_date) FROM tiles WHERE aoi_id=?", (aoi_id,)).fetchone()[0]
	if not date:
		return None
	rows = _mosaic_rows(aoi_id, date)
	if not rows:
		return None
	path, _, _ = mosaic_thumbnail(rows, GENERATED_DIR / "mosaics", f"{aoi_id}-{date[:7]}")
	return public_url(request, path)


def _mosaic_rows(aoi_id: int, date: str) -> list:
	with db.get_conn() as conn:
		return conn.execute("SELECT * FROM tiles WHERE aoi_id=? AND acquisition_date LIKE ? ORDER BY row_idx,col_idx", (aoi_id, f"{date[:7]}%" if len(date) > 7 else f"{date}%")).fetchall()


@app.get("/aois/{aoi_id}/timeline", response_model=list[TimelineEntry])
def timeline(aoi_id: str, request: Request):
	aoi = aoi_row(aoi_id)
	with db.get_conn() as conn:
		scenes = conn.execute("SELECT * FROM scenes WHERE aoi_id=? ORDER BY acquisition_date", (aoi["aoi_id"],)).fetchall()
	output = []
	for scene in scenes:
		with db.get_conn() as conn:
			tile_count = conn.execute("SELECT COUNT(*) FROM tiles WHERE scene_path=?", (scene["scene_path"],)).fetchone()[0]
		with db.get_conn() as conn:
			rows = conn.execute("SELECT * FROM tiles WHERE scene_path=? ORDER BY row_idx,col_idx", (scene["scene_path"],)).fetchall()
		thumb = None
		if rows:
			path, _, _ = mosaic_thumbnail(rows, GENERATED_DIR / "mosaics", f"{aoi['aoi_id']}-{scene['scene_path']}")
			thumb = public_url(request, path)
		output.append({"date": scene["acquisition_date"], "scene_id": scene_id(aoi_id, scene["acquisition_date"]), "sensor": scene["sensor"],
					   "cloud_fraction": scene["cloud_cover_percent"] / 100 if scene["cloud_cover_percent"] is not None else None,
					   "tile_count": tile_count, "acquisition_date_source": scene["acquisition_date_source"], "thumbnail_url": thumb})
	return output


@app.get("/aois/{aoi_id}/mosaic", response_model=Mosaic)
def mosaic(aoi_id: str, request: Request, date: str = Query(...)):
	aoi = aoi_row(aoi_id)
	rows = _mosaic_rows(aoi["aoi_id"], date)
	if not rows:
		raise HTTPException(404, "No tiles for that AOI and month")
	path, width, height = mosaic_thumbnail(rows, GENERATED_DIR / "mosaics", f"{aoi['aoi_id']}-{date[:7]}")
	changed = _changed_vectors()
	return {"aoi_id": aoi_id, "date": date, "image_url": public_url(request, path), "width": width, "height": height,
			"tiles": [{"tile_id": row["tile_id"], "vector_id": row["vector_id"], "x": (row["col_idx"] or 0) * TILE_SIZE_PX,
					   "y": (row["row_idx"] or 0) * TILE_SIZE_PX, "width": TILE_SIZE_PX, "height": TILE_SIZE_PX,
					   "cluster_id": row["cluster_id"], "has_change_candidate": row["vector_id"] in changed} for row in rows]}


def _changed_vectors() -> set[int]:
	with db.get_conn() as conn:
		return {row["vector_id_after"] for row in conn.execute("SELECT vector_id_after FROM change_candidates WHERE suppressed=0")}


@app.get("/tiles/{tile_id}", response_model=TileDetail)
def tile(tile_id: str, request: Request):
	with db.get_conn() as conn:
		row = conn.execute("SELECT * FROM tiles WHERE tile_id=? ORDER BY acquisition_date DESC LIMIT 1", (tile_id,)).fetchone()
	if row is None:
		raise HTTPException(404, "Tile not found")
	return tile_public(row, request)


@app.get("/tiles/{tile_id}/similar", response_model=list[SearchResult])
def similar(tile_id: str, request: Request, k: int = Query(12, ge=1, le=100)):
	with db.get_conn() as conn:
		row = conn.execute("SELECT * FROM tiles WHERE tile_id=? ORDER BY acquisition_date DESC LIMIT 1", (tile_id,)).fetchone()
	if row is None:
		raise HTTPException(404, "Tile not found")
	return [search_public(item, request) for item in index_search.image_search_by_tile(row["tile_path"], top_k=k)]


@app.post("/search/text", response_model=list[SearchResult])
def text_search(payload: TextSearchRequest, request: Request):
	date_from = payload.date_from or payload.date
	date_to = payload.date_to or payload.date
	aoi_id = payload.aoi_id
	sensor = None
	if aoi_id:
		aoi_row(aoi_id)
	search_limit = max(payload.k, _index_count())
	results = index_search.text_search(payload.query, top_k=search_limit, date_from=date_from, date_to=date_to, sensor=sensor)
	if aoi_id:
		aoi = aoi_row(aoi_id)
		results = [item for item in results if (db.get_tile(item.vector_id) or {"aoi_id": None})["aoi_id"] == aoi["aoi_id"]]
	return [search_public(item, request) for item in results[:payload.k]]


@app.post("/search/image", response_model=list[SearchResult])
async def image_search(request: Request, file: Annotated[UploadFile, File(...)], aoi_id: Annotated[str | None, Form()] = None, k: Annotated[int, Form(ge=1, le=100)] = 12):
	try:
		image = Image.open(io.BytesIO(await file.read())).convert("RGB")
	except (OSError, ValueError) as error:
		raise HTTPException(400, "Uploaded file is not a readable image") from error
	results = index_search.image_search_by_upload(image, top_k=max(k, _index_count()))
	if aoi_id:
		aoi = aoi_row(aoi_id)
		results = [item for item in results if (db.get_tile(item.vector_id) or {"aoi_id": None})["aoi_id"] == aoi["aoi_id"]]
	return [search_public(item, request) for item in results[:k]]


@app.get("/changes/candidates", response_model=list[ChangeCandidate])
def candidates(request: Request, status: str | None = None, aoi_id: str | None = None):
	decisions = latest_decisions()
	with db.get_conn() as conn:
		rows = conn.execute("SELECT * FROM change_candidates WHERE COALESCE(suppression_reason, '') NOT LIKE '%source_imagery_unavailable%' ORDER BY combined_score DESC").fetchall()
	if aoi_id:
		aoi = aoi_row(aoi_id)
		rows = [row for row in rows if (db.get_tile(row["vector_id_after"]) or {"aoi_id": None})["aoi_id"] == aoi["aoi_id"]]
	return [item for row in rows if not status or candidate_status(row, decisions) == status.upper() for item in [candidate_public(row, request, decisions)]]


@app.get("/changes/candidates/data-quality", response_model=ReviewQuality)
def candidate_review_quality():
	with db.get_conn() as conn:
		excluded = conn.execute("SELECT COUNT(*) FROM change_candidates WHERE suppression_reason LIKE '%source_imagery_unavailable%'").fetchone()[0]
		displayable = conn.execute("SELECT COUNT(*) FROM change_candidates WHERE COALESCE(suppression_reason, '') NOT LIKE '%source_imagery_unavailable%'").fetchone()[0]
	return {"excluded_source_unavailable": excluded, "displayable_candidate_count": displayable}


@app.get("/changes/{vector_id}", response_model=ChangeDetail)
def change(vector_id: int, request: Request):
	with db.get_conn() as conn:
		row = conn.execute("SELECT * FROM change_candidates WHERE vector_id_after=? LIMIT 1", (vector_id,)).fetchone()
	if row is None:
		raise HTTPException(404, "Change not found")
	decisions = latest_decisions()
	result = candidate_public(row, request, decisions)
	before = db.get_tile(row["vector_id_before"])
	after = db.get_tile(row["vector_id_after"])
	history = db.get_tile_history(row["tile_id"])
	difference_url = None
	change_region = None
	changed_fraction = 0.0
	if before and after and Path(before["tile_path"]).exists() and Path(after["tile_path"]).exists() and result["before_thumbnail_url"] and result["after_thumbnail_url"]:
		difference_path, changed_fraction, change_region = difference_image(
			before["tile_path"], after["tile_path"], GENERATED_DIR / "differences", f"{before['vector_id']}-{after['vector_id']}"
		)
		difference_url = public_url(request, difference_path)
	ndvi_change = None
	if before["ndvi_mean"] is not None and after["ndvi_mean"] is not None:
		ndvi_change = after["ndvi_mean"] - before["ndvi_mean"]
	quality_notes = _quality_notes(before, after)
	if ndvi_change is None:
		visual_summary = "Significant spectral/visual change detected, but change type is uncertain."
	else:
		visual_summary = f"NDVI changed from {before['ndvi_mean']:.2f} to {after['ndvi_mean']:.2f}; spectral/visual difference covers {changed_fraction:.1%} of valid pixels."
	interpretation = "Significant spectral/visual change detected, but change type is uncertain."
	if row["change_type"]:
		confidence = row["change_type_confidence"]
		interpretation = f"Candidate interpretation: {row['change_type']}" + (f" - confidence {confidence:.0%}." if confidence is not None else ".")
	else:
		confidence = None
	result.update({"before_image_url": result["before_thumbnail_url"], "after_image_url": result["after_thumbnail_url"],
				   "lat": (after["minlat"] + after["maxlat"]) / 2, "lon": (after["minlon"] + after["maxlon"]) / 2,
				   "bbox": tile_bbox(after), "ndvi_series": [{"date": item["acquisition_date"], "ndvi_mean": item["ndvi_mean"], "ndwi_mean": item["ndwi_mean"], "cloud_fraction": item["cloud_fraction"]} for item in history],
																		 "quality_notes": quality_notes,
				   "acquisition_date_source": scene_source(after["scene_path"]), "processing_version": after["processing_version"]})
	result["evidence"] = {"before_date": row["date_before"], "after_date": row["date_after"], "change_region": change_region,
		"visual_difference_summary": visual_summary, "before_ndvi": before["ndvi_mean"], "after_ndvi": after["ndvi_mean"],
		"ndvi_change": ndvi_change, "spectral_change": row["spectral_delta"], "semantic_change": row["embedding_drift"],
		"quality": "sufficient" if changed_fraction > 0 and before["valid_pixel_fraction"] and after["valid_pixel_fraction"] else "insufficient",
		"confound_information": quality_notes, "candidate_interpretation": interpretation, "confidence": confidence,
		"difference_image_url": difference_url}
	return result


def _quality_notes(before, after) -> list[str]:
	def percent(row, field, label):
		value = row[field]
		return f"{label}: {value * 100:.0f}%" if value is not None else f"{label} unavailable"

	return [
		percent(before, "cloud_fraction", "Before-date cloud fraction"),
		percent(after, "cloud_fraction", "After-date cloud fraction"),
		percent(before, "valid_pixel_fraction", "Before-date valid pixels"),
		percent(after, "valid_pixel_fraction", "After-date valid pixels"),
		percent(before, "snow_fraction", "Before-date snow fraction"),
		percent(after, "snow_fraction", "After-date snow fraction"),
	]


@app.post("/review/{candidate_id}/decision", response_model=ReviewResponse)
def decision(candidate_id: str, payload: ReviewDecision):
	if payload.decision not in ("CONFIRM", "REJECT"):
		raise HTTPException(422, "decision must be CONFIRM or REJECT")
	review_queue.submit_decision(int(candidate_id), payload.decision.lower(), payload.reason)
	return {"ok": True}


@app.get("/review/audit-log", response_model=list[AuditLogEntry])
def audit_log():
	with db.get_conn() as conn:
		rows = conn.execute("SELECT al.*, cc.tile_id FROM audit_log al LEFT JOIN change_candidates cc ON cc.candidate_id=al.candidate_id ORDER BY al.decided_at DESC").fetchall()
	return [{"log_id": str(row["log_id"]), "candidate_id": str(row["candidate_id"]), "tile_id": row["tile_id"], "decision": row["analyst_decision"], "reason": row["reason"], "created_at": row["decided_at"]} for row in rows]


@app.get("/clusters", response_model=list[Cluster])
def clusters(request: Request):
	with db.get_conn() as conn:
		rows = conn.execute("SELECT cluster_id, COUNT(*) member_count, MIN(acquisition_date) start_date, MAX(acquisition_date) end_date FROM tiles WHERE cluster_id IS NOT NULL AND cluster_id != -1 GROUP BY cluster_id ORDER BY cluster_id").fetchall()
	output = []
	for row in rows:
		with db.get_conn() as conn:
			aois = conn.execute("SELECT DISTINCT a.name FROM tiles t JOIN aois a ON a.aoi_id=t.aoi_id WHERE t.cluster_id=? ORDER BY a.name", (row["cluster_id"],)).fetchall()
		members = clustering.get_tiles_in_cluster(row["cluster_id"])
		index = VectorIndex()
		vectors = [(member, index.get_vector(member["vector_id"])) for member in members]
		centroid = np.mean([vector for _, vector in vectors], axis=0)
		centroid /= np.linalg.norm(centroid) + 1e-8
		representative = max(vectors, key=lambda item: float(np.dot(item[1], centroid)))[0] if vectors else None
		url = public_url(request, tile_thumbnail(representative["tile_path"], GENERATED_DIR / "thumbnails", representative["vector_id"])) if representative and Path(representative["tile_path"]).exists() and has_valid_multispectral_data(representative["tile_path"]) else None
		output.append({"cluster_id": row["cluster_id"], "member_count": row["member_count"], "aoi_ids": [item[0] for item in aois], "representative_thumbnail_url": url, "label": None, "start_date": row["start_date"], "end_date": row["end_date"]})
	return output


@app.get("/clusters/{cluster_id}/members", response_model=list[ClusterMember])
def cluster_members(cluster_id: int, request: Request):
	output = []
	for row in clustering.get_tiles_in_cluster(cluster_id):
		aoi = db.get_aoi(row["aoi_id"])
		thumbnail = public_url(request, tile_thumbnail(row["tile_path"], GENERATED_DIR / "thumbnails", row["vector_id"])) if Path(row["tile_path"]).exists() and has_valid_multispectral_data(row["tile_path"]) else None
		output.append({"tile_id": row["tile_id"], "vector_id": row["vector_id"], "aoi_id": aoi["name"] if aoi else None,
					   "date": row["acquisition_date"], "thumbnail_url": thumbnail})
	return output


def update_job(job_id: str, **values):
	with JOB_LOCK:
		JOBS[job_id].update(values)


def run_onboarding(job_id: str, name: str, source_folder: str, discovered_count: int):
	update_job(job_id, status="running")
	try:
		report = onboarding.onboard_aoi(name, source_folder, on_scene_done=lambda _outcome, completed, total: update_job(job_id, progress=int(completed / max(total, 1) * 100)))
		update_job(job_id, status="done", progress=100, message=None, aoi_id=name, scenes_found=discovered_count, scenes_ingested=report.n_ingested,
				   scenes_failed=report.n_failed, tiles_added=report.total_tiles_added, warnings=report.validation.warnings,
				   scenes=[{"scene_id": scene_id(name, item.acquisition_date), "date": item.acquisition_date, "status": item.status, "message": item.error} for item in report.scene_outcomes])
	except Exception as error:
		update_job(job_id, status="failed", message=str(error))


@app.post("/aois/onboard", response_model=OnboardJob)
def start_onboard(payload: OnboardRequest, background_tasks: BackgroundTasks):
	job_id = str(uuid.uuid4())
	source = Path(payload.source_folder)
	if not source.is_dir():
		raise HTTPException(400, f"Source folder does not exist on the backend host: {payload.source_folder}")
	discovered_count = onboarding.count_input_files(source)
	if discovered_count == 0:
		raise HTTPException(400, "Source folder contains no complete prepared scenes")
	with JOB_LOCK:
		JOBS[job_id] = {"job_id": job_id, "status": "queued", "progress": 0, "message": f"Queued {discovered_count} scene(s)", "aoi_id": payload.name, "scenes_found": discovered_count, "scenes_ingested": None, "scenes_failed": None, "tiles_added": None, "warnings": [], "scenes": []}
	background_tasks.add_task(run_onboarding, job_id, payload.name, payload.source_folder, discovered_count)
	return JOBS[job_id]


@app.get("/aois/onboard/{job_id}", response_model=OnboardJob)
def onboard_job(job_id: str):
	with JOB_LOCK:
		job = JOBS.get(job_id)
	if job is None:
		raise HTTPException(404, "Onboarding job not found")
	return job


if FRONTEND_DIST.exists():
	app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
