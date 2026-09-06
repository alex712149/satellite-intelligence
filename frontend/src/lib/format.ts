/** Presentation-only formatting helpers. No analysis happens here. */

export const dash = "—";

export function num(value: number | null | undefined, digits = 3): string {
  if (value === null || value === undefined || Number.isNaN(value)) return dash;
  return value.toFixed(digits);
}

export function int(value: number | null | undefined): string {
  if (value === null || value === undefined) return dash;
  return value.toLocaleString("en-US");
}

export function pct(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return dash;
  return `${(value * 100).toFixed(digits)}%`;
}

export function qualityPct(value: number | null | undefined, digits = 0): string {
  return value === null || value === undefined ? "Unknown (SCL unavailable)" : pct(value, digits);
}

export function coord(lat: number | null | undefined, lon: number | null | undefined): string {
  if (lat === null || lat === undefined || lon === null || lon === undefined) return dash;
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

export function bboxText(bbox: [number, number, number, number] | null | undefined): string {
  if (!bbox) return dash;
  return bbox.map((v) => v.toFixed(4)).join(", ");
}

export function dateText(value: string | null | undefined): string {
  if (!value) return dash;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toISOString().slice(0, 10);
}

export function timestampText(value: string | null | undefined): string {
  if (!value) return dash;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)} UTC`;
}

export function humanize(value: string): string {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Candidate-language wording for a backend change_type string. */
export function candidateChangeType(changeType: string | null | undefined): string {
  if (!changeType) return "Candidate change";
  return `Likely ${humanize(changeType).toLowerCase()}`;
}

/**
 * `suppression_reason` is free-form backend diagnostic text — never an enum.
 * We lightly humanize `key=value` fragments and always keep the raw string.
 */
export function suppressionText(raw: string | null | undefined): {
  readable: string;
  raw: string;
} {
  if (!raw) return { readable: "Suppressed by backend", raw: dash };
  const readable = raw
    .split(/[;,]\s*/)
    .map((fragment) => {
      const idx = fragment.indexOf("=");
      if (idx === -1) return humanize(fragment);
      const key = fragment.slice(0, idx);
      const value = fragment.slice(idx + 1);
      return `${humanize(key)}: ${value}`;
    })
    .join(" · ");
  return { readable, raw };
}
