import { Link } from "@tanstack/react-router";

import { coord, num } from "@/lib/format";
import type { SearchResult } from "@/lib/types";

export function ResultGrid({ results }: { results: SearchResult[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {results.map((result) => (
        <li key={`${result.tile_id}-${result.date}`} className="panel overflow-hidden">
          {result.thumbnail_url ? (
            <img
              src={result.thumbnail_url}
              alt={`Backend thumbnail for tile ${result.tile_id}`}
              loading="lazy"
              className="aspect-square w-full object-cover"
            />
          ) : (
            <div className="tele flex aspect-square items-center justify-center text-[10px] text-muted-foreground">
              No thumbnail
            </div>
          )}
          <div className="space-y-1 p-3">
            <p className="tele truncate text-[11px] text-foreground" title={result.tile_id}>
              {result.tile_id}
            </p>
            <p className="tele text-[10px] text-muted-foreground">{result.aoi_name ?? result.aoi_id}</p>
            <div className="tele flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{result.date}</span>
              <span className="text-telemetry">sim {num(result.similarity)}</span>
            </div>
            <p className="tele text-[10px] text-muted-foreground">{coord(result.lat, result.lon)}</p>
            {result.vector_id !== null && (
              <Link
                to="/change/$vectorId"
                params={{ vectorId: String(result.vector_id) }}
                className="tele inline-block rounded border border-border px-2 py-0.5 text-[10px] uppercase tracking-widest hover:text-telemetry"
              >
                Change analysis
              </Link>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
