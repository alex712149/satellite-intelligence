import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { EmptyState, ErrorState, LoadingState, Panel } from "@/components/common/states";
import { AppShell } from "@/components/layout/AppShell";
import { dateText, int } from "@/lib/format";
import { clusterMembersQuery, clustersQuery } from "@/lib/queries";

export const Route = createFileRoute("/clusters")({
  validateSearch: (search: Record<string, unknown>) => ({
    cluster: typeof search["cluster"] === "string" ? search["cluster"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Discovery Clusters — Sentinel Intelligence" },
      {
        name: "description",
        content:
          "Explore backend-computed tile clusters, member counts and representative tiles across AOIs.",
      },
      { property: "og:title", content: "Discovery Clusters — Sentinel Intelligence" },
      {
        property: "og:description",
        content: "Cluster groupings computed by the local offline pipeline.",
      },
    ],
  }),
  component: ClustersPage,
});

function ClustersPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const clusters = useQuery(clustersQuery());
  const activeId = search.cluster ? Number(search.cluster) : null;
  const members = useQuery(clusterMembersQuery(activeId));

  return (
    <AppShell
      title="Discovery"
      subtitle="Clusters and members are produced by the backend clustering stage; the interface only renders them."
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <p className="text-sm leading-6 text-muted-foreground lg:col-span-2">
          Clusters group visually and semantically similar satellite tiles, helping analysts
          discover related locations across AOIs and dates without manually searching each tile.
        </p>
        <Panel title="Clusters">
          {clusters.isPending ? (
            <LoadingState label="Loading clusters" />
          ) : clusters.isError ? (
            <ErrorState error={clusters.error} onRetry={() => void clusters.refetch()} />
          ) : (clusters.data ?? []).length === 0 ? (
            <EmptyState label="Backend reported no clusters" />
          ) : (
            <ul className="space-y-2">
              {(clusters.data ?? []).map((cluster) => (
                <li key={cluster.cluster_id}>
                  <button
                    type="button"
                    onClick={() =>
                      void navigate({
                        to: ".",
                        search: () => ({ cluster: String(cluster.cluster_id) }),
                      })
                    }
                    className={`flex w-full items-center gap-3 rounded border p-2 text-left transition-colors ${
                      activeId === cluster.cluster_id
                        ? "border-telemetry"
                        : "border-border hover:border-telemetry/50"
                    }`}
                  >
                    {cluster.representative_thumbnail_url ? (
                      <img
                        src={cluster.representative_thumbnail_url}
                        alt={`Representative tile for cluster ${cluster.cluster_id}`}
                        loading="lazy"
                        className="h-14 w-14 rounded border border-border object-cover"
                      />
                    ) : (
                      <span className="tele flex h-14 w-14 items-center justify-center rounded border border-border text-[9px] text-muted-foreground">
                        n/a
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="tele block text-sm text-foreground">
                        Cluster {cluster.cluster_id}
                      </span>
                      <span className="tele block text-[11px] text-muted-foreground">
                        {int(cluster.member_count)} members · {cluster.aoi_ids.length} AOIs
                      </span>
                      <span className="tele block text-[10px] text-muted-foreground">
                        {dateText(cluster.start_date)} to {dateText(cluster.end_date)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={activeId === null ? "Members" : `Cluster ${activeId} members`}>
          {activeId === null ? (
            <EmptyState label="Select a cluster" />
          ) : members.isPending ? (
            <LoadingState label="Loading cluster members" />
          ) : members.isError ? (
            <ErrorState error={members.error} onRetry={() => void members.refetch()} />
          ) : (members.data ?? []).length === 0 ? (
            <EmptyState label="No members returned by backend" />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {(members.data ?? []).map((member) => (
                <li
                  key={`${member.tile_id}-${member.date}-${member.vector_id ?? "no-vector"}`}
                  className="panel overflow-hidden"
                >
                  {member.thumbnail_url && (
                    <img
                      src={member.thumbnail_url}
                      alt={`Backend thumbnail for tile ${member.tile_id}`}
                      loading="lazy"
                      className="aspect-square w-full object-cover"
                    />
                  )}
                  <div className="space-y-1 p-2">
                    <p className="tele truncate text-[11px]" title={member.tile_id}>
                      {member.tile_id}
                    </p>
                    <p className="tele text-[10px] text-muted-foreground">
                      {member.aoi_id} · {member.date}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      <Link
                        to="/explorer"
                        search={{
                          aoi_id: member.aoi_id,
                          date: member.date,
                          tile: member.tile_id,
                          clusters: "1",
                        }}
                        className="tele rounded border border-border px-1.5 py-0.5 text-[10px] uppercase hover:text-telemetry"
                      >
                        Tile
                      </Link>
                      <Link
                        to="/search"
                        search={{ q: undefined, aoi_id: undefined, similar_to: member.tile_id }}
                        className="tele rounded border border-border px-1.5 py-0.5 text-[10px] uppercase hover:text-telemetry"
                      >
                        Similar
                      </Link>
                      {member.vector_id !== null && (
                        <Link
                          to="/change/$vectorId"
                          params={{ vectorId: String(member.vector_id) }}
                          className="tele rounded border border-border px-1.5 py-0.5 text-[10px] uppercase hover:text-telemetry"
                        >
                          Change
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
