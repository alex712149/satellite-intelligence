import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { EmptyState, ErrorState, LoadingState, Panel } from "@/components/common/states";
import { TilePanel } from "@/components/explorer/TilePanel";
import { TimelineStrip } from "@/components/explorer/TimelineStrip";
import { AppShell } from "@/components/layout/AppShell";
import { MosaicViewer } from "@/components/viewer/MosaicViewer";
import { aoisQuery, mosaicQuery, timelineQuery } from "@/lib/queries";

export const Route = createFileRoute("/explorer")({
  validateSearch: (search: Record<string, unknown>) => ({
    aoi_id: typeof search["aoi_id"] === "string" ? search["aoi_id"] : undefined,
    date: typeof search["date"] === "string" ? search["date"] : undefined,
    tile: typeof search["tile"] === "string" ? search["tile"] : undefined,
    clusters: search["clusters"] === "1" ? "1" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "AOI Explorer — Sentinel Intelligence" },
      {
        name: "description",
        content: "Browse local Sentinel-2 mosaics per AOI and inspect backend tile metrics on an offline canvas viewer.",
      },
      { property: "og:title", content: "AOI Explorer — Sentinel Intelligence" },
      { property: "og:description", content: "Offline mosaic viewer over locally staged Sentinel-2 observations." },
    ],
  }),
  component: ExplorerPage,
});

function ExplorerPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const aois = useQuery(aoisQuery());

  const aoiId = search.aoi_id ?? aois.data?.[0]?.aoi_id ?? "";
  const timeline = useQuery(timelineQuery(aoiId));
  const date = search.date ?? timeline.data?.[timeline.data.length - 1]?.date ?? "";
  const mosaic = useQuery(mosaicQuery(aoiId, date));

  useEffect(() => {
    if (!search.aoi_id && aoiId) {
      void navigate({ to: ".", search: (prev) => ({ ...prev, aoi_id: aoiId }), replace: true });
    }
  }, [aoiId, search.aoi_id, navigate]);

  const showClusters = search.clusters === "1";

  return (
    <AppShell
      title="AOI Explorer"
      subtitle="Every mosaic, date and tile metric below is served by the local backend from locally staged Sentinel-2 scenes."
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Area of interest"
            value={aoiId}
            onChange={(e) =>
              void navigate({
                to: ".",
                search: (prev) => ({ ...prev, aoi_id: e.target.value, date: undefined, tile: undefined }),
              })
            }
            className="tele rounded border border-border bg-background px-2 py-1.5 text-xs"
          >
            {(aois.data ?? []).map((aoi) => (
              <option key={aoi.aoi_id} value={aoi.aoi_id}>
                {aoi.name}
              </option>
            ))}
          </select>
          <label className="tele flex items-center gap-2 rounded border border-border px-2 py-1.5 text-[11px] uppercase tracking-widest text-muted-foreground">
            <input
              type="checkbox"
              checked={showClusters}
              onChange={(e) =>
                void navigate({ to: ".", search: (prev) => ({ ...prev, clusters: e.target.checked ? "1" : undefined }) })
              }
            />
            Cluster tint
          </label>
        </div>
      }
    >
      {aois.isPending ? (
        <LoadingState label="Loading AOIs" />
      ) : aois.isError ? (
        <ErrorState error={aois.error} onRetry={() => void aois.refetch()} />
      ) : (aois.data ?? []).length === 0 ? (
        <EmptyState label="No AOIs onboarded yet" hint="Use AOI Onboarding to ingest a locally staged scene folder." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            {timeline.isPending ? (
              <LoadingState label="Loading timeline" />
            ) : timeline.isError ? (
              <ErrorState error={timeline.error} onRetry={() => void timeline.refetch()} />
            ) : (timeline.data ?? []).length === 0 ? (
              <EmptyState label="Backend returned no observations for this AOI" />
            ) : (
              <TimelineStrip
                entries={timeline.data ?? []}
                activeDate={date}
                onSelect={(next) => void navigate({ to: ".", search: (prev) => ({ ...prev, date: next }) })}
              />
            )}

            {mosaic.isPending ? (
              <LoadingState label="Loading mosaic" />
            ) : mosaic.isError ? (
              <ErrorState error={mosaic.error} onRetry={() => void mosaic.refetch()} />
            ) : mosaic.data ? (
              <MosaicViewer
                mosaic={mosaic.data}
                selectedTileId={search.tile ?? null}
                onSelectTile={(tile) =>
                  void navigate({ to: ".", search: (prev) => ({ ...prev, tile: tile.tile_id }) })
                }
                showClusters={showClusters}
                showCandidates
              />
            ) : null}
          </div>

          <div>
            {search.tile ? (
              <TilePanel tileId={search.tile} />
            ) : (
              <Panel title="Tile detail">
                <EmptyState label="Select a tile in the viewer" hint="Tile provenance and indices load from the backend." />
              </Panel>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
