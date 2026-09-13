/// <reference lib="webworker" />
export {};

declare const self: ServiceWorkerGlobalScope;
declare const OFFLINE_VERSION: string;
declare const OFFLINE_ASSETS: readonly { url: string; integrity: string }[];

const prefix = "otterpuck-offline-";
const cacheName = `${prefix}${OFFLINE_VERSION}`;
const paths = new Set(OFFLINE_ASSETS.map((asset): string => asset.url));

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
    })(),
  );
});

self.addEventListener("activate", (event: ExtendableEvent): void => {
  event.waitUntil(
    (async (): Promise<void> => {
      for (const name of await caches.keys())
        if (name.startsWith(prefix) && name !== cacheName)
          await caches.delete(name);
    })(),
  );
});

self.addEventListener("fetch", (event: FetchEvent): void => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  const path = url.pathname === "/index.html" ? "/" : url.pathname;
  if (!paths.has(path)) return;
  event.respondWith(
    (async (): Promise<Response> => {
      const cache = await caches.open(cacheName);
      return (await cache.match(path)) ?? fetch(request);
    })(),
  );
});
