import { ChevronLeft, ChevronRight } from "lucide-react";

import { qualityPct } from "@/lib/format";
import type { TimelineEntry } from "@/lib/types";

export function TimelineStrip({
  entries,
  activeDate,
  onSelect,
}: {
  entries: TimelineEntry[];
  activeDate: string | null;
  onSelect: (date: string) => void;
}) {
  const index = entries.findIndex((e) => e.date === activeDate);
  const step = (delta: number) => {
    const next = entries[Math.min(entries.length - 1, Math.max(0, index + delta))];
    if (next) onSelect(next.date);
  };

  return (
    <div className="panel p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="tele text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Backend timeline · {entries.length} observations
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Previous observation"
            onClick={() => step(-1)}
            className="rounded border border-border p-1 hover:text-telemetry"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Next observation"
            onClick={() => step(1)}
            className="rounded border border-border p-1 hover:text-telemetry"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={Math.max(0, entries.length - 1)}
        step={1}
        value={index < 0 ? 0 : index}
        aria-label="Observation date"
        onChange={(e) => {
          const entry = entries[Number(e.target.value)];
          if (entry) onSelect(entry.date);
        }}
        className="w-full accent-telemetry"
      />

      <ul className="mt-3 flex flex-wrap gap-2">
        {entries.map((entry) => (
          <li key={entry.date}>
            <button
              type="button"
              onClick={() => onSelect(entry.date)}
              className={`tele rounded border px-2 py-1 text-[11px] transition-colors ${
                entry.date === activeDate
                  ? "border-telemetry text-telemetry"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {entry.date}
              <span className="ml-1 text-[10px] opacity-70">
                cloud {qualityPct(entry.cloud_fraction)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
