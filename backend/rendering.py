import hashlib
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image

from app.config import TILE_SIZE_PX


RENDER_VERSION = "rgb-v2"


def _rgb(tile_path: str) -> Image.Image:
    with rasterio.open(tile_path) as source:
        masked = source.read([3, 2, 1], masked=True)
    bands = masked.filled(0).astype(np.float32)
    channels = []
    for index in range(3):
        valid = ~np.ma.getmaskarray(masked)[index] & np.isfinite(bands[index]) & (bands[index] != 0)
        if int(valid.sum()) < 16:
            channels.append(np.zeros(bands[index].shape, dtype=np.uint8))
            continue
        low, high = np.percentile(bands[index][valid], (2, 98))
        if float(high - low) < 1e-6:
            channels.append(np.zeros(bands[index].shape, dtype=np.uint8))
            continue
        channels.append((np.clip((bands[index] - low) / float(high - low), 0, 1) * 255).astype(np.uint8))
    return Image.fromarray(np.stack(channels, axis=-1), mode="RGB")


def tile_thumbnail(tile_path: str, output_dir: Path, vector_id: int) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"tile-{vector_id}-{RENDER_VERSION}.png"
    if not output_path.exists():
        _rgb(tile_path).save(output_path, format="PNG")
    return output_path


def mosaic_thumbnail(rows: list, output_dir: Path, cache_key: str) -> tuple[Path, int, int]:
    output_dir.mkdir(parents=True, exist_ok=True)
    cache_id = hashlib.sha256(cache_key.encode("utf-8")).hexdigest()[:16]
    output_path = output_dir / f"mosaic-{cache_id}-{RENDER_VERSION}.png"
    width = (max((int(row["col_idx"] or 0) for row in rows), default=0) + 1) * TILE_SIZE_PX
    height = (max((int(row["row_idx"] or 0) for row in rows), default=0) + 1) * TILE_SIZE_PX
    if not output_path.exists():
        canvas = Image.new("RGB", (width, height))
        for row in rows:
            tile = _rgb(row["tile_path"])
            canvas.paste(tile, (int(row["col_idx"] or 0) * TILE_SIZE_PX, int(row["row_idx"] or 0) * TILE_SIZE_PX))
        canvas.save(output_path, format="PNG")
    return output_path, width, height


def difference_image(before_path: str, after_path: str, output_dir: Path, cache_key: str) -> tuple[Path, float, str | None]:
    output_dir.mkdir(parents=True, exist_ok=True)
    cache_id = hashlib.sha256(f"{RENDER_VERSION}:{cache_key}".encode("utf-8")).hexdigest()[:16]
    output_path = output_dir / f"difference-{cache_id}-{RENDER_VERSION}.png"
    before = np.asarray(_rgb(before_path), dtype=np.float32) / 255.0
    after = np.asarray(_rgb(after_path), dtype=np.float32) / 255.0
    reliable = bool(before.max() > 0 and after.max() > 0)
    delta = np.abs(after - before).mean(axis=2)
    changed = (delta > 0.18) if reliable else np.zeros(delta.shape, dtype=bool)
    if not output_path.exists():
        heatmap = np.zeros((*delta.shape, 4), dtype=np.uint8)
        heatmap[..., 0] = np.where(changed, 255, 0)
        heatmap[..., 1] = np.where(changed, (delta * 120).clip(0, 120), 0).astype(np.uint8)
        heatmap[..., 3] = np.where(changed, 190, 0).astype(np.uint8)
        Image.fromarray(heatmap, mode="RGBA").save(output_path, format="PNG")
    if not changed.any():
        region = None
    else:
        ys, xs = np.where(changed)
        region = f"x={xs.min()}..{xs.max()}, y={ys.min()}..{ys.max()}"
    return output_path, float(changed.mean()), region
