/**
 * Frontend runtime configuration.
 *
 * The frontend performs NO analysis of its own. Every analytical value shown in
 * the UI originates from the local FastAPI backend (or, in development, from the
 * clearly-labelled synthetic fixtures under `src/lib/fixtures/`).
 */

const rawFixtures = import.meta.env["VITE_USE_FIXTURES"] as string | undefined;

/** `VITE_USE_FIXTURES=false` switches to the real local FastAPI backend. */
export const useFixtures = String(rawFixtures ?? "false").toLowerCase() === "true";

const rawBase =
  (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "http://127.0.0.1:8000";

export const apiBaseUrl = rawBase.replace(/\/+$/, "");

export const PROVENANCE_NOTE =
  "Sentinel-2 imagery downloaded from Copernicus Data Space and staged locally for offline processing and analysis.";
