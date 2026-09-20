/// <reference lib="webworker" />
export {};

declare const self: ServiceWorkerGlobalScope;
declare const OFFLINE_VERSION: string;
declare const OFFLINE_ASSETS: readonly {
  url: string;
  integrity: string;
  version: string;
}[];
declare const OFFLINE_RUNTIME_ASSETS: readonly {
  url: string;
  integrity: string;
  version: string;
}[];

const shellPrefix = "otterpuck-shell-";
const cacheName = `${shellPrefix}${OFFLINE_VERSION}`;
const assetCacheName = "otterpuck-assets-v1";
const paths = new Set(OFFLINE_ASSETS.map((asset): string => asset.url));
const runtimeAssets = new Map(
  OFFLINE_RUNTIME_ASSETS.map(
    (asset): [string, { integrity: string; version: string }] => [
      asset.url,
      { integrity: asset.integrity, version: asset.version },
    ],
  ),
);

self.addEventListener("install", (event: ExtendableEvent): void => {
  event.waitUntil(
    (async (): Promise<void> => {
      const cache = await caches.open(cacheName);
      try {
        await cache.addAll(
          OFFLINE_ASSETS.map(
            ({ url, integrity }): Request =>
              new Request(url, { integrity, cache: "reload" }),
          ),
        );
      } catch (error) {
        await caches.delete(cacheName);
        throw error;
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event: ExtendableEvent): void => {
  event.waitUntil(
    (async (): Promise<void> => {
      for (const name of await caches.keys())
        if (
          name.startsWith("otterpuck-offline-") ||
          (name.startsWith(shellPrefix) && name !== cacheName)
        )
          await caches.delete(name);
      const assetCache = await caches.open(assetCacheName);
      const current = new Set(
        [...runtimeAssets].map(
          ([url, asset]): string => `${url}?v=${asset.version}`,
        ),
      );
      for (const request of await assetCache.keys()) {
        const url = new URL(request.url);
        if (!current.has(`${url.pathname}${url.search}`))
          await assetCache.delete(request);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event: FetchEvent): void => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  const path = url.pathname === "/index.html" ? "/" : url.pathname;
  const runtimeAsset = runtimeAssets.get(path);
  if (!paths.has(path) && !runtimeAsset) return;
  event.respondWith(
    (async (): Promise<Response> => {
      const cache = await caches.open(
        runtimeAsset ? assetCacheName : cacheName,
      );
      const key = runtimeAsset ? request : path;
      const cached = await cache.match(key);
      if (cached) return cached;
      const response = await fetch(request);
      if (runtimeAsset && response.ok)
        await cache.put(request, response.clone());
      return response;
    })(),
  );
});
