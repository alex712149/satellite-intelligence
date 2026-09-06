/**
 * DEVELOPMENT FIXTURES ONLY — synthetic, deterministic, obviously not imagery.
 * These SVG data URLs are never presented as real satellite observations; they
 * are watermarked and only reachable when VITE_USE_FIXTURES=true.
 */

function seeded(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function fixturePanel(key: string, width = 640, height = 640, label = "FIXTURE — NOT SATELLITE DATA"): string {
  const rand = seeded(hash(key));
  const cells = 8;
  const cw = width / cells;
  const ch = height / cells;
  const rects: string[] = [];
  for (let y = 0; y < cells; y += 1) {
    for (let x = 0; x < cells; x += 1) {
      const v = rand();
      const hue = 150 + Math.round(v * 80);
      const light = 8 + Math.round(v * 26);
      rects.push(
        `<rect x="${(x * cw).toFixed(1)}" y="${(y * ch).toFixed(1)}" width="${cw.toFixed(1)}" height="${ch.toFixed(1)}" fill="hsl(${hue} 30% ${light}%)"/>`,
      );
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="${width}" height="${height}" fill="#05080b"/>
${rects.join("")}
<g fill="none" stroke="rgba(120,220,255,0.10)">
${Array.from({ length: cells }, (_, i) => `<line x1="0" y1="${i * ch}" x2="${width}" y2="${i * ch}"/><line x1="${i * cw}" y1="0" x2="${i * cw}" y2="${height}"/>`).join("")}
</g>
<text x="${width / 2}" y="${height - 16}" font-family="monospace" font-size="${Math.max(10, width / 40)}" fill="rgba(160,220,255,0.55)" text-anchor="middle">${label}</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
