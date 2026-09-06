"""
Central configuration for the Satellite Intelligence pipeline.
Every other module imports paths and constants from here so nothing
is hard-coded twice.
"""
from pathlib import Path

# ---- Filesystem layout -----------------------------------------------
ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
RAW_DIR = DATA_DIR / "raw"          # original GeoTIFF / COG scenes land here
TILES_DIR = DATA_DIR / "tiles"      # cropped, per-tile GeoTIFFs
INDEX_DIR = DATA_DIR / "index"      # FAISS index files
DB_PATH = DATA_DIR / "catalog.sqlite"

for d in (RAW_DIR, TILES_DIR, INDEX_DIR):
    d.mkdir(parents=True, exist_ok=True)

# ---- Tiling ------------------------------------------------------------
TILE_SIZE_PX = 224          # matches CLIP's native input size, no resize needed
TILE_GRID_ZONE_METERS = 2240  # 224 px * 10 m Sentinel-2 resolution -> tile footprint

# ---- Embedding model -----------------------------------------------------
# open_clip model registry name + pretrained-weights tag.
# Swap to a remote-sensing-specific checkpoint (e.g. RemoteCLIP) by changing
# these two values once the weight file is staged locally -- nothing else
# in the pipeline needs to change because everything talks to the
# CLIPEmbedder interface in app/embeddings/clip_embedder.py.
CLIP_MODEL_NAME = "ViT-B-32"
CLIP_PRETRAINED = "openai"
EMBEDDING_DIM = 512  # ViT-B-32 output dimension; update if you swap models

# ---- Change detection ----------------------------------------------------
# Fallback global threshold, used only until per-cluster calibration
# (Stage 12 / app/change/calibration.py) has run at least once.
DEFAULT_CHANGE_THRESHOLD = 0.22

# Quality gates -- a tile pair below these is suppressed regardless of
# embedding drift (Stage 13 false-alarm suppression).
MAX_CLOUD_FRACTION = 0.15
MIN_VALID_PIXEL_FRACTION = 0.80
