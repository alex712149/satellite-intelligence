"""
Stage 7 -- AI Embedding Generation

A single class wraps open_clip so every other module (indexing, search,
change detection, clustering, zero-shot classification) talks to ONE
interface. Swapping the pretrained backbone for a remote-sensing model
such as RemoteCLIP later means changing app/config.py only -- nothing
downstream changes, because they only ever call embed_image_tile() /
embed_text().

Refinement 3.2 (OpenCLIP does not directly consume multispectral data):
Sentinel-2 tiles here are 5-band (B02,B03,B04,B08,SCL). CLIP's vision
tower expects a 3-channel RGB-like image, so we explicitly build a
true-color composite from B04/B03/B02 for the embedding step. NDVI/NDWI
(computed separately in features.py) carry the NIR/SWIR information
that would otherwise be discarded -- they are never assumed to be
"seen" by the embedding.
"""
from functools import lru_cache

import numpy as np
import torch
import open_clip
from PIL import Image

from app.config import CLIP_MODEL_NAME, CLIP_PRETRAINED, EMBEDDING_DIM
from app.geospatial.rendering import true_color_image

_DEVICE = "cuda" if torch.cuda.is_available() else "cpu"


@lru_cache(maxsize=1)
def _load_model():
    """Loaded once per process and cached -- embedding thousands of
    tiles must not reload the network each call."""
    model, _, preprocess = open_clip.create_model_and_transforms(
        CLIP_MODEL_NAME, pretrained=CLIP_PRETRAINED, device=_DEVICE
    )
    tokenizer = open_clip.get_tokenizer(CLIP_MODEL_NAME)
    model.eval()
    return model, preprocess, tokenizer


def _tile_to_rgb_image(tile_path: str) -> Image.Image:
    return true_color_image(tile_path)


def embed_image_tile(tile_path: str) -> np.ndarray:
    """Returns an L2-normalized (EMBEDDING_DIM,) float32 vector, ready
    to hand straight to FAISS (inner-product search == cosine
    similarity once vectors are normalized)."""
    model, preprocess, _ = _load_model()
    img = _tile_to_rgb_image(tile_path)
    tensor = preprocess(img).unsqueeze(0).to(_DEVICE)
    with torch.no_grad():
        feat = model.encode_image(tensor)
        feat = feat / feat.norm(dim=-1, keepdim=True)
    return feat.squeeze(0).cpu().numpy().astype(np.float32)


def embed_image_tiles_batch(tile_paths: list[str], batch_size: int = 32) -> np.ndarray:
    """Same as embed_image_tile but batched -- use this for bulk
    ingestion, it is dramatically faster than a Python loop."""
    model, preprocess, _ = _load_model()
    vectors = []
    for i in range(0, len(tile_paths), batch_size):
        batch_paths = tile_paths[i:i + batch_size]
        imgs = torch.stack([preprocess(_tile_to_rgb_image(p)) for p in batch_paths]).to(_DEVICE)
        with torch.no_grad():
            feats = model.encode_image(imgs)
            feats = feats / feats.norm(dim=-1, keepdim=True)
        vectors.append(feats.cpu().numpy().astype(np.float32))
    return np.concatenate(vectors, axis=0) if vectors else np.zeros((0, EMBEDDING_DIM), dtype=np.float32)


def embed_text(query: str) -> np.ndarray:
    """Turns a natural-language query into the same embedding space as
    the tiles -- this is what makes free-text search possible (Stage 9)."""
    model, _, tokenizer = _load_model()
    tokens = tokenizer([query]).to(_DEVICE)
    with torch.no_grad():
        feat = model.encode_text(tokens)
        feat = feat / feat.norm(dim=-1, keepdim=True)
    return feat.squeeze(0).cpu().numpy().astype(np.float32)


def embed_texts_batch(queries: list[str]) -> np.ndarray:
    """Batched text embedding -- used by Stage 14 zero-shot change-type
    classification, which scores several candidate labels at once."""
    model, _, tokenizer = _load_model()
    tokens = tokenizer(queries).to(_DEVICE)
    with torch.no_grad():
        feats = model.encode_text(tokens)
        feats = feats / feats.norm(dim=-1, keepdim=True)
    return feats.cpu().numpy().astype(np.float32)


def embed_uploaded_image(pil_image: Image.Image) -> np.ndarray:
    """For Stage 10 image-to-image search where the analyst uploads an
    arbitrary example image rather than picking an indexed tile."""
    model, preprocess, _ = _load_model()
    tensor = preprocess(pil_image.convert("RGB")).unsqueeze(0).to(_DEVICE)
    with torch.no_grad():
        feat = model.encode_image(tensor)
        feat = feat / feat.norm(dim=-1, keepdim=True)
    return feat.squeeze(0).cpu().numpy().astype(np.float32)
