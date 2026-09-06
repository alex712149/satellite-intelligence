import { Crosshair, Maximize, Maximize2, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { Mosaic, MosaicTile } from "@/lib/types";

/**
 * Offline canvas mosaic viewer. Draws the backend-provided mosaic image plus
 * overlays (tile grid, cluster tint, change-candidate markers, selection).
 * No Leaflet / Mapbox / external tile providers.
 */
export function MosaicViewer({
  mosaic,
  selectedTileId,
  onSelectTile,
  showClusters,
  showCandidates,
}: {
  mosaic: Mosaic;
  selectedTileId: string | null;
  onSelectTile: (tile: MosaicTile) => void;
  showClusters: boolean;
  showCandidates: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [hoverTileId, setHoverTileId] = useState<string | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setSize({ width: el.clientWidth, height: Math.max(360, Math.round(el.clientWidth * 0.7)) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fit = useCallback(() => {
    const scale = Math.min(size.width / mosaic.width, size.height / mosaic.height);
    setView({
      scale,
      x: (size.width - mosaic.width * scale) / 2,
      y: (size.height - mosaic.height * scale) / 2,
    });
  }, [mosaic.width, mosaic.height, size.width, size.height]);

  useEffect(() => {
    setStatus("loading");
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setStatus("ready");
      fit();
    };
    img.onerror = () => setStatus("error");
    img.src = mosaic.image_url;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [mosaic.image_url, fit]);

  useEffect(() => {
    if (status === "ready") fit();
  }, [fit, status]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
    canvas.width = size.width * dpr;
    canvas.height = size.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);
    ctx.fillStyle = "#05080b";
    ctx.fillRect(0, 0, size.width, size.height);

    const img = imageRef.current;
    if (!img || status !== "ready") return;

    ctx.save();
    ctx.translate(view.x, view.y);
    ctx.scale(view.scale, view.scale);
    ctx.imageSmoothingEnabled = view.scale < 2;
    ctx.drawImage(img, 0, 0, mosaic.width, mosaic.height);

    ctx.lineWidth = 1 / view.scale;
    for (const tile of mosaic.tiles) {
      if (showClusters && tile.cluster_id !== null) {
        const hue = (tile.cluster_id * 47) % 360;
        ctx.fillStyle = `hsla(${hue}, 80%, 60%, 0.14)`;
        ctx.fillRect(tile.x, tile.y, tile.width, tile.height);
      }
      ctx.strokeStyle = "rgba(140, 220, 255, 0.18)";
      ctx.strokeRect(tile.x, tile.y, tile.width, tile.height);

      if (showCandidates && tile.has_change_candidate) {
        ctx.strokeStyle = "rgba(255, 90, 70, 0.9)";
        ctx.lineWidth = 2 / view.scale;
        ctx.strokeRect(tile.x + 1, tile.y + 1, tile.width - 2, tile.height - 2);
        ctx.lineWidth = 1 / view.scale;
      }
      if (tile.tile_id === hoverTileId) {
        ctx.fillStyle = "rgba(140, 220, 255, 0.12)";
        ctx.fillRect(tile.x, tile.y, tile.width, tile.height);
      }
      if (tile.tile_id === selectedTileId) {
        ctx.strokeStyle = "rgba(120, 240, 255, 1)";
        ctx.lineWidth = 2.5 / view.scale;
        ctx.strokeRect(tile.x, tile.y, tile.width, tile.height);
        ctx.lineWidth = 1 / view.scale;
      }
    }
    ctx.restore();
  }, [mosaic, view, size, status, selectedTileId, hoverTileId, showClusters, showCandidates]);

  const toImage = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: (clientX - rect.left - view.x) / view.scale,
      y: (clientY - rect.top - view.y) / view.scale,
    };
  };

  const tileAt = (x: number, y: number): MosaicTile | undefined =>
    mosaic.tiles.find((t) => x >= t.x && x < t.x + t.width && y >= t.y && y < t.y + t.height);

  const zoomAt = (factor: number) => {
    setView((prev) => {
      const scale = Math.min(12, Math.max(0.1, prev.scale * factor));
      return {
        scale,
        x: (size.width - mosaic.width * scale) / 2,
        y: (size.height - mosaic.height * scale) / 2,
      };
    });
  };

  return (
    <div ref={wrapRef} className="panel relative overflow-hidden">
      <canvas
        ref={canvasRef}
        role="application"
        aria-label="AOI mosaic viewer"
        tabIndex={0}
        style={{ width: size.width, height: size.height, touchAction: "none", cursor: "crosshair" }}
        onPointerMove={(e) => {
          const pt = toImage(e.clientX, e.clientY);
          setHoverTileId(pt ? (tileAt(pt.x, pt.y)?.tile_id ?? null) : null);
        }}
        onClick={(e) => {
          const pt = toImage(e.clientX, e.clientY);
          const tile = pt ? tileAt(pt.x, pt.y) : undefined;
          if (tile) onSelectTile(tile);
        }}
        onPointerLeave={() => setHoverTileId(null)}
      />

      {status === "loading" && (
        <p className="tele absolute left-3 top-3 rounded border border-border bg-background/80 px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground">
          Loading mosaic…
        </p>
      )}
      {status === "error" && (
        <p className="tele absolute left-3 top-3 rounded border border-alert/50 bg-background/90 px-2 py-1 text-[10px] uppercase tracking-widest text-alert">
          Mosaic image unavailable from backend
        </p>
      )}

      <div className="absolute right-3 top-3 flex flex-col gap-1">
        <ViewerButton label="Zoom in" onClick={() => zoomAt(1.2)}>
          <Plus className="h-3.5 w-3.5" />
        </ViewerButton>
        <ViewerButton label="Zoom out" onClick={() => zoomAt(1 / 1.2)}>
          <Minus className="h-3.5 w-3.5" />
        </ViewerButton>
        <ViewerButton label="Fit to view" onClick={fit}>
          <Maximize className="h-3.5 w-3.5" />
        </ViewerButton>
        <ViewerButton label="Reset view" onClick={fit}>
          <Crosshair className="h-3.5 w-3.5" />
        </ViewerButton>
        <ViewerButton
          label="Fullscreen viewer"
          onClick={() => void wrapRef.current?.requestFullscreen?.()}
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </ViewerButton>
      </div>

      <p className="tele absolute bottom-3 left-3 rounded border border-border bg-background/80 px-2 py-1 text-[10px] text-muted-foreground">
        {mosaic.date} · {mosaic.tiles.length} tiles · zoom {view.scale.toFixed(2)}×
      </p>
    </div>
  );
}

function ViewerButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="rounded border border-border bg-background/80 p-1.5 text-muted-foreground transition-colors hover:text-telemetry"
    >
      {children}
    </button>
  );
}
