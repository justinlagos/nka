import "server-only";
import { serverEnv } from "@/lib/env";

export function imagesEnabled(): boolean {
  return Boolean(serverEnv().openaiKey);
}

export type ImageSize = "1024x1024" | "1536x1024" | "1024x1536";

// One image from the image model, as PNG bytes. Null when there's no key or it fails.
export async function generateImage(prompt: string, size: ImageSize = "1024x1024"): Promise<Uint8Array | null> {
  const { openaiKey, imageModel } = serverEnv();
  if (!openaiKey) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { authorization: `Bearer ${openaiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model: imageModel, prompt: prompt.slice(0, 3900), size, n: 1 }),
      signal: AbortSignal.timeout(150_000),
    });
    if (!res.ok) {
      console.error("Image generation failed", res.status, (await res.text()).slice(0, 300));
      return null;
    }
    const data = (await res.json()) as { data?: { b64_json?: string; url?: string }[] };
    const item = data.data?.[0];
    if (item?.b64_json) return Uint8Array.from(Buffer.from(item.b64_json, "base64"));
    if (item?.url) {
      const img = await fetch(item.url, { signal: AbortSignal.timeout(30_000) });
      return img.ok ? new Uint8Array(await img.arrayBuffer()) : null;
    }
    return null;
  } catch (err) {
    console.error("Image generation error", err);
    return null;
  }
}
