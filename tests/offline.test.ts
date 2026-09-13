import { expect, test } from "bun:test";
import { runInNewContext } from "node:vm";

const assets = [
  { url: "/", integrity: "sha256-shell" },
  { url: "/models/arenas/city.glb", integrity: "sha256-city" },
];
const build = await Bun.build({
  entrypoints: ["src/offline-worker.ts"],
  target: "browser",
  format: "iife",
  define: { OFFLINE_VERSION: '"new"', OFFLINE_ASSETS: JSON.stringify(assets) },
});
const script = await build.outputs.at(0)?.text();
if (!build.success || !script) throw new Error("Worker compilation failed");

type WorkerEvent = {
  request: Request;
  waitUntil: (work: Promise<void>) => void;
  respondWith: (response: Promise<Response>) => void;
};
const createWorker = (failInstall = false) => {
  const handlers = new Map<string, (event: WorkerEvent) => void>();
  const stores = new Map<string, Map<string, string>>([
    ["otterpuck-offline-old", new Map([["/", "old-shell"]])],
    ["unrelated-cache", new Map()],
  ]);
  const requests: Request[] = [];
  const requestOptions: RequestInit[] = [];
  const network: string[] = [];
  class WorkerRequest extends Request {
    constructor(url: string, init?: RequestInit) {
      super(new URL(url, "https://game.test"), init);
      requestOptions.push(init ?? {});
    }
  }
  runInNewContext(script, {
    URL,
    Request: WorkerRequest,
    self: {
      location: { origin: "https://game.test" },
      addEventListener: (
        name: string,
        handler: (event: WorkerEvent) => void,
      ): void => {
        handlers.set(name, handler);
      },
    },
    caches: {
      keys: async (): Promise<string[]> => [...stores.keys()],
      delete: async (name: string): Promise<boolean> => stores.delete(name),
      open: async (name: string) => {
        const store = stores.get(name) ?? new Map<string, string>();
        stores.set(name, store);
        return {
          addAll: async (incoming: Request[]): Promise<void> => {
            requests.push(...incoming);
            if (failInstall) throw new Error("Interrupted download");
            for (const request of incoming)
              store.set(
                new URL(request.url).pathname,
                `cached:${new URL(request.url).pathname}`,
              );
          },
          match: async (path: string): Promise<Response | undefined> =>
            store.has(path) ? new Response(store.get(path)) : undefined,
        };
      },
    },
    fetch: async (request: Request): Promise<Response> => {
      network.push(request.url);
      return new Response("network");
    },
  });
  const dispatch = async (
    name: string,
    url = "https://game.test/",
    method = "GET",
  ): Promise<Response | undefined> => {
    let work: Promise<void> | undefined;
    let response: Promise<Response> | undefined;
    handlers.get(name)?.({
      request: new Request(url, { method }),
      waitUntil: (promise): void => {
        work = promise;
      },
      respondWith: (promise): void => {
        response = promise;
      },
    });
    await work;
    return response;
  };
  return { stores, requests, requestOptions, network, dispatch };
};

test("offline installation validates content and leaves the active version intact until activation", async (): Promise<void> => {
  const worker = createWorker();
  await worker.dispatch("install");
  expect(worker.stores.has("otterpuck-offline-old")).toBe(true);
  expect(worker.requestOptions.map((options) => options.integrity)).toEqual(
    assets.map((asset): string => asset.integrity),
  );
  expect(
    worker.requestOptions.every(
      (options): boolean => options.cache === "reload",
    ),
  ).toBe(true);
  await worker.dispatch("activate");
  expect(worker.stores.has("otterpuck-offline-old")).toBe(false);
  expect(worker.stores.has("unrelated-cache")).toBe(true);
});

test("an interrupted install discards only the incomplete new cache", async (): Promise<void> => {
  const worker = createWorker(true);
  await expect(worker.dispatch("install")).rejects.toThrow(
    "Interrupted download",
  );
  expect(worker.stores.has("otterpuck-offline-new")).toBe(false);
  expect(worker.stores.get("otterpuck-offline-old")?.get("/")).toBe(
    "old-shell",
  );
});

test("offline navigation and version-query assets use the current cache without network access", async (): Promise<void> => {
  const worker = createWorker();
  await worker.dispatch("install");
  expect(
    await (
      await worker.dispatch("fetch", "https://game.test/?installed=true")
    )?.text(),
  ).toBe("cached:/");
  expect(
    await (
      await worker.dispatch("fetch", "https://game.test/index.html")
    )?.text(),
  ).toBe("cached:/");
  expect(
    await (
      await worker.dispatch(
        "fetch",
        "https://game.test/models/arenas/city.glb?v=20260908-soft",
      )
    )?.text(),
  ).toBe("cached:/models/arenas/city.glb");
  expect(worker.network).toEqual([]);
  expect(await worker.dispatch("fetch", "https://other.test/")).toBeUndefined();
  expect(
    await worker.dispatch("fetch", "https://game.test/", "POST"),
  ).toBeUndefined();
  expect(
    await worker.dispatch("fetch", "https://game.test/sw.js"),
  ).toBeUndefined();
});
