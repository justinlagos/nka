// Turning SVG into PNG, and bundling files into a zip. Both libraries are loaded only when used.
import type { OutFile } from "./brand.ts";

// Text inside the SVG is drawn only if its typeface is installed on the server, which brand
// typefaces usually aren't. Callers should rasterise shapes, not live text, and say so.
export async function svgToPng(svg: string, width: number, background?: string): Promise<Uint8Array> {
  const { Resvg } = await import("@resvg/resvg-js");
  const r = new Resvg(svg, { fitTo: { mode: "width", value: Math.max(1, Math.min(4096, Math.round(width))) }, ...(background ? { background } : {}) });
  return new Uint8Array(r.render().asPng());
}

export async function zip(files: OutFile[]): Promise<Uint8Array> {
  const mod = await import("jszip");
  const JSZip = (mod as { default?: unknown }).default ?? mod;
  const z = new (JSZip as new () => { file: (name: string, data: string | Uint8Array) => void; generateAsync: (o: { type: "uint8array"; compression: "DEFLATE" }) => Promise<Uint8Array> })();
  for (const f of files) z.file(f.name, f.data);
  return z.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
