import { useEffect, useRef, useState } from "react";

export function CompareSlider({
  beforeUrl,
  afterUrl,
  differenceUrl,
  beforeLabel,
  afterLabel,
}: {
  beforeUrl: string | null;
  afterUrl: string | null;
  differenceUrl?: string | null;
  beforeLabel: string;
  afterLabel: string;
}) {
  const [position, setPosition] = useState(50);
  const [displayMode, setDisplayMode] = useState<"true-color" | "difference">("true-color");
  const [overlayEnabled, setOverlayEnabled] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<number | null>(null);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (draggingRef.current !== event.pointerId) return;
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition(Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100)));
    };
    const stopDragging = (event: PointerEvent) => {
      if (draggingRef.current === event.pointerId) draggingRef.current = null;
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
    };
  }, []);

  const move = (clientX: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)));
  };

  const moveFromPointer = (event: React.PointerEvent<HTMLElement>) => {
    if (draggingRef.current !== event.pointerId) return;
    move(event.clientX);
  };

  return (
    <div className="space-y-2">
      <div
        ref={wrapRef}
        className="relative mx-auto aspect-video max-h-[min(62vh,38rem)] w-full select-none overflow-hidden rounded border border-border bg-black/30"
        onPointerDown={(e) => {
          draggingRef.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          move(e.clientX);
        }}
        onPointerMove={moveFromPointer}
        onPointerUp={(e) => {
          draggingRef.current = null;
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          draggingRef.current = null;
        }}
      >
        {!beforeUrl || !afterUrl ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            Source imagery unavailable
          </div>
        ) : displayMode === "difference" && differenceUrl ? (
          <img src={differenceUrl} alt="Backend-generated visual difference evidence" className="absolute inset-0 h-full w-full object-contain" />
        ) : (
          <>
            <img src={afterUrl} alt={`After observation ${afterLabel}`} className="pointer-events-none absolute inset-0 h-full w-full object-contain" />
            <div className="pointer-events-none absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${position}%` }}>
              <img
                src={beforeUrl}
                alt={`Before observation ${beforeLabel}`}
                className="absolute inset-0 h-full w-full max-w-none object-contain"
                style={{ width: wrapRef.current?.clientWidth ?? "100%" }}
              />
            </div>
            {overlayEnabled && differenceUrl && (
              <img src={differenceUrl} alt="Backend-generated visual difference evidence" className="pointer-events-none absolute inset-0 h-full w-full object-contain opacity-65" />
            )}
          </>
        )}
        {displayMode === "true-color" && (
          <>
            <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-telemetry" style={{ left: `${position}%` }} />
            <button
              type="button"
              aria-label="Drag before and after divider"
              className="absolute inset-y-0 z-10 w-5 -translate-x-1/2 cursor-ew-resize border-0 bg-transparent"
              style={{ left: `${position}%` }}
              onPointerDown={(e) => {
                e.stopPropagation();
                draggingRef.current = e.pointerId;
                e.currentTarget.setPointerCapture(e.pointerId);
                move(e.clientX);
              }}
              onPointerMove={moveFromPointer}
              onPointerUp={(e) => {
                draggingRef.current = null;
                e.currentTarget.releasePointerCapture(e.pointerId);
              }}
              onPointerCancel={() => {
                draggingRef.current = null;
              }}
            />
            <span className="tele pointer-events-none absolute left-2 top-2 rounded bg-background/80 px-2 py-0.5 text-[10px] text-muted-foreground">Before · {beforeLabel}</span>
            <span className="tele pointer-events-none absolute right-2 top-2 rounded bg-background/80 px-2 py-0.5 text-[10px] text-muted-foreground">After · {afterLabel}</span>
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:border-telemetry hover:text-foreground" onClick={() => setPosition(50)}>
          50/50 reset
        </button>
        <button type="button" className="rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:border-telemetry hover:text-foreground" onClick={() => setPosition(50)}>
          Fit comparison
        </button>
        <button type="button" className={`rounded border px-2 py-1 text-xs ${displayMode === "true-color" ? "border-telemetry text-telemetry" : "border-border text-muted-foreground"}`} onClick={() => setDisplayMode("true-color")}>
          TRUE COLOR
        </button>
        {differenceUrl && (
          <>
            <button type="button" className={`rounded border px-2 py-1 text-xs ${displayMode === "difference" ? "border-warning text-warning" : "border-border text-muted-foreground"}`} onClick={() => setDisplayMode("difference")}>
              DIFFERENCE HEATMAP
            </button>
            <button type="button" className={`rounded border px-2 py-1 text-xs ${overlayEnabled ? "border-warning text-warning" : "border-border text-muted-foreground"}`} onClick={() => setOverlayEnabled((enabled) => !enabled)} disabled={displayMode === "difference"}>
              HEATMAP OVERLAY {overlayEnabled ? "ON" : "OFF"}
            </button>
          </>
        )}
        <button type="button" className="rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:border-telemetry hover:text-foreground" onClick={() => void wrapRef.current?.requestFullscreen?.()}>
          Fullscreen comparison
        </button>
      </div>
      {differenceUrl && (
        <p className="tele flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-sm bg-alert" aria-hidden="true" />
          Backend difference mask
        </p>
      )}
      <input
        type="range"
        min={0}
        max={100}
        value={position}
        aria-label="Before/after comparison position"
        onChange={(e) => setPosition(Number(e.target.value))}
        className="w-full accent-telemetry"
      />
    </div>
  );
}
