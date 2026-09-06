import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { ErrorState, Field, LoadingState, Panel } from "@/components/common/states";
import { bboxText, coord, dateText, num, pct, qualityPct } from "@/lib/format";
import { tileQuery } from "@/lib/queries";

export function TilePanel({ tileId }: { tileId: string }) {
  const tile = useQuery(tileQuery(tileId));

  if (tile.isPending) {
    return (
      <Panel title="Tile detail">
        <LoadingState label="Loading tile metadata" />
      </Panel>
    );
  }
  if (tile.isError) {
    return (
      <Panel title="Tile detail">
        <ErrorState error={tile.error} onRetry={() => void tile.refetch()} />
      </Panel>
    );
  }
  const data = tile.data;
  if (!data) return null;

  return (
    <Panel title="Tile detail" className="space-y-3">
      {data.thumbnail_url ? (
        <img
          src={data.thumbnail_url}
          alt={`Backend-provided thumbnail for tile ${data.tile_id}`}
          loading="lazy"
          className="w-full rounded border border-border"
        />
      ) : (
        <p className="tele text-xs text-muted-foreground">No thumbnail provided by backend</p>
      )}

      <div>
        <Field label="Tile ID" value={data.tile_id} />
        <Field label="Vector ID" value={data.vector_id ?? "—"} />
        <Field label="Scene" value={data.scene_id} />
        <Field label="Date" value={dateText(data.date)} />
        <Field label="Date source" value={data.acquisition_date_source ?? "—"} />
        <Field label="Sensor" value={data.sensor ?? "—"} />
        <Field label="Centre" value={coord(data.lat, data.lon)} />
        <Field label="BBox" value={<span className="text-[11px]">{bboxText(data.bbox)}</span>} />
        <Field label="NDVI mean" value={num(data.ndvi_mean)} />
        <Field label="NDWI mean" value={num(data.ndwi_mean)} />
        <Field label="Cloud fraction" value={qualityPct(data.cloud_fraction, 1)} />
        <Field label="Valid pixels" value={pct(data.valid_pixel_fraction, 1)} />
        <Field label="Cluster" value={data.cluster_id ?? "—"} />
        <Field label="Processing version" value={data.processing_version ?? "—"} />
      </div>

      <div className="flex flex-wrap gap-2">
        {data.vector_id !== null && (
          <Link
            to="/change/$vectorId"
            params={{ vectorId: String(data.vector_id) }}
            className="tele rounded border border-border px-2 py-1 text-[11px] uppercase tracking-widest hover:text-telemetry"
          >
            View change history
          </Link>
        )}
        <Link
          to="/search"
          search={{ q: undefined, aoi_id: undefined, similar_to: data.tile_id }}
          className="tele rounded border border-border px-2 py-1 text-[11px] uppercase tracking-widest hover:text-telemetry"
        >
          Find similar
        </Link>
      </div>
    </Panel>
  );
}
