import { assetUrl } from "./asset-url";

const CACHE = "otterpuck-previews-v1";

export const previewCacheKey = async (
  name: string,
  sources: string[],
): Promise<string | undefined> => {
  try {
    const versions = await Promise.all(
      sources.map(async (source): Promise<string | undefined> => {
        const url = assetUrl(source);
        if (url !== source) return url;
        const response = await fetch(url, {
          method: "HEAD",
          cache: "no-cache",
        });
        if (!response.ok) return undefined;
        const version =
          response.headers.get("etag") ?? response.headers.get("last-modified");
        return version
          ? `${url}:${version}:${response.headers.get("content-length")}`
          : undefined;
      }),
    );
    if (versions.some((version): boolean => !version)) return undefined;
    return `/__previews/${name}?sources=${encodeURIComponent(versions.join("|"))}`;
  } catch {
    return undefined;
  }
};

export const readPreview = async (
  key: string | undefined,
): Promise<string | undefined> => {
  if (!key) return undefined;
  try {
    const response = await (await caches.open(CACHE)).match(key);
    return response ? URL.createObjectURL(await response.blob()) : undefined;
  } catch {
    return undefined;
  }
};

export const savePreview = async (
  key: string | undefined,
  canvas: HTMLCanvasElement,
): Promise<string> => {
  const blob = await new Promise<Blob>((resolve, reject): void => {
    canvas.toBlob(
      (image): void =>
        image ? resolve(image) : reject(new Error("Preview encoding failed")),
      "image/webp",
      0.9,
    );
  });
  if (key) {
    try {
      const cache = await caches.open(CACHE);
      const path = new URL(key, location.origin).pathname;
      for (const old of await cache.keys())
        if (
          new URL(old.url).pathname === path &&
          old.url !== new URL(key, location.origin).href
        )
          await cache.delete(old);
      await cache.put(
        key,
        new Response(blob, { headers: { "Content-Type": "image/webp" } }),
      );
    } catch {
      // Private browsing or a full cache must not prevent selection.
    }
  }
  return URL.createObjectURL(blob);
};
