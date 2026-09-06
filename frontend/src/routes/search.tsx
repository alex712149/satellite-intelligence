import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState, LoadingState, Panel } from "@/components/common/states";
import { AppShell } from "@/components/layout/AppShell";
import { ResultGrid } from "@/components/search/ResultGrid";
import * as api from "@/lib/api";
import { aoisQuery, similarQuery, textSearchQuery } from "@/lib/queries";
import type { SearchResult } from "@/lib/types";

const IMAGE_RESULTS_CACHE_KEY = "sentinel:last-image-search-results";

function cachedImageResults(): SearchResult[] | null {
  if (typeof window === "undefined") return null;
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(IMAGE_RESULTS_CACHE_KEY) ?? "null");
    return Array.isArray(value) ? (value as SearchResult[]).slice(0, 100) : null;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search["q"] === "string" ? search["q"] : undefined,
    aoi_id: typeof search["aoi_id"] === "string" ? search["aoi_id"] : undefined,
    similar_to: typeof search["similar_to"] === "string" ? search["similar_to"] : undefined,
    date_from: typeof search["date_from"] === "string" ? search["date_from"] : undefined,
    date_to: typeof search["date_to"] === "string" ? search["date_to"] : undefined,
    k:
      typeof search["k"] === "number"
        ? search["k"]
        : typeof search["k"] === "string"
          ? Number(search["k"])
          : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Semantic Search — Sentinel Intelligence" },
      {
        name: "description",
        content:
          "Query locally indexed Sentinel-2 tiles by text or reference image using the local backend index.",
      },
      { property: "og:title", content: "Semantic Search — Sentinel Intelligence" },
      {
        property: "og:description",
        content: "Text and image tile search served by the local FastAPI backend.",
      },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const aois = useQuery(aoisQuery());

  const similar = useQuery({
    ...similarQuery(search.similar_to ?? ""),
    enabled: Boolean(search.similar_to),
  });
  const textSearch = useQuery(
    textSearchQuery({
      query: search.q ?? "",
      aoiId: search.aoi_id ?? "",
      dateFrom: search.date_from ?? "",
      dateTo: search.date_to ?? "",
      k: search.k ?? 12,
    }),
  );

  const [text, setText] = useState(search.q ?? "");
  const [results, setResults] = useState<SearchResult[] | null>(cachedImageResults);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [queryImage, setQueryImage] = useState<string | null>(null);

  const runText = async () => {
    if (!text.trim()) {
      toast.error("Enter a search phrase first");
      return;
    }
    setQueryImage(null);
    await navigate({
      to: ".",
      search: (prev) => ({ ...prev, q: text.trim(), similar_to: undefined }),
    });
  };

  const runImage = async (file: File) => {
    setBusy(true);
    setError(null);
    setQueryImage(URL.createObjectURL(file));
    try {
      const imageResults = await api.searchImage(file, {
        aoi_id: search.aoi_id ?? null,
        k: search.k ?? 12,
      });
      setResults(imageResults);
      sessionStorage.setItem(IMAGE_RESULTS_CACHE_KEY, JSON.stringify(imageResults.slice(0, 100)));
    } catch (err) {
      setError(err);
      setResults(null);
    } finally {
      setBusy(false);
    }
  };

  const shown = search.similar_to
    ? (similar.data ?? null)
    : search.q
      ? (textSearch.data ?? null)
      : results;

  return (
    <AppShell
      title="Semantic Search"
      subtitle="Ranked matches and similarity scores are computed by the local backend index; this UI only renders them."
    >
      <div className="space-y-4">
        <Panel title="Query">
          <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
            <label className="block">
              <span className="tele mb-1 block text-[10px] uppercase tracking-widest text-muted-foreground">
                Query
              </span>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void runText();
                }}
                placeholder="e.g. new road construction near farmland"
                aria-label="Text query"
                className="tele w-full rounded border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="tele mb-1 block text-[10px] uppercase tracking-widest text-muted-foreground">
                AOI
              </span>
              <select
                value={search.aoi_id ?? ""}
                onChange={(e) =>
                  void navigate({
                    to: ".",
                    search: (prev) => ({ ...prev, aoi_id: e.target.value || undefined }),
                  })
                }
                className="tele rounded border border-border bg-background px-2 py-2 text-xs"
              >
                <option value="">All AOIs</option>
                {(aois.data ?? []).map((aoi) => (
                  <option key={aoi.aoi_id} value={aoi.aoi_id}>
                    {aoi.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="tele mb-1 block text-[10px] uppercase tracking-widest text-muted-foreground">
                From
              </span>
              <input
                type="date"
                value={search.date_from ?? ""}
                onChange={(e) =>
                  void navigate({
                    to: ".",
                    search: (prev) => ({ ...prev, date_from: e.target.value || undefined }),
                  })
                }
                className="tele w-full rounded border border-border bg-background px-2 py-2 text-xs"
              />
            </label>
            <label className="block">
              <span className="tele mb-1 block text-[10px] uppercase tracking-widest text-muted-foreground">
                To
              </span>
              <input
                type="date"
                value={search.date_to ?? ""}
                onChange={(e) =>
                  void navigate({
                    to: ".",
                    search: (prev) => ({ ...prev, date_to: e.target.value || undefined }),
                  })
                }
                className="tele w-full rounded border border-border bg-background px-2 py-2 text-xs"
              />
            </label>
            <label className="block">
              <span className="tele mb-1 block text-[10px] uppercase tracking-widest text-muted-foreground">
                Results
              </span>
              <input
                type="number"
                min={1}
                max={100}
                aria-label="Top K"
                value={search.k ?? 12}
                onChange={(e) =>
                  void navigate({
                    to: ".",
                    search: (prev) => ({
                      ...prev,
                      k: Math.max(1, Math.min(100, Number(e.target.value) || 12)),
                    }),
                  })
                }
                className="tele w-full rounded border border-border bg-background px-2 py-2 text-xs"
              />
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void runText()}
              className="tele rounded border border-telemetry/60 bg-telemetry/10 px-3 py-1.5 text-[11px] uppercase tracking-widest text-telemetry"
            >
              Run text search
            </button>
            <label className="tele cursor-pointer rounded border border-border px-3 py-1.5 text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground">
              Search by image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void runImage(file);
                }}
              />
            </label>
            {search.similar_to && (
              <span className="tele text-[11px] text-muted-foreground">
                Showing tiles similar to {search.similar_to}
              </span>
            )}
          </div>
        </Panel>

        {queryImage && (
          <Panel title="Query image">
            <img
              src={queryImage}
              alt="Uploaded query image"
              className="max-h-48 rounded border border-border"
            />
          </Panel>
        )}

        {busy ||
        (search.similar_to && similar.isPending) ||
        (!search.similar_to && Boolean(search.q) && textSearch.isPending) ? (
          <LoadingState label="Searching backend index" />
        ) : error || textSearch.isError ? (
          <ErrorState error={error ?? textSearch.error} />
        ) : search.similar_to && similar.isError ? (
          <ErrorState error={similar.error} onRetry={() => void similar.refetch()} />
        ) : shown === null ? (
          <EmptyState
            label="No query run yet"
            hint="Enter a text query or upload a reference image."
          />
        ) : shown.length === 0 ? (
          <EmptyState label="Backend returned no matches" />
        ) : (
          <ResultGrid results={shown} />
        )}
      </div>
    </AppShell>
  );
}
