import { expect, test } from "bun:test";
import { runInNewContext } from "node:vm";

const assets = [{ url: "/", integrity: "sha256-shell", version: "shell" }];
const runtimeAssets = [
  {
    url: "/models/arenas/city.glb",
    integrity: "sha256-city",
    version: "city",
  },
];
const build = await Bun.build({
  entrypoints: ["src/offline-worker.ts"],
  target: "browser",
  format: "iife",
  define: {
    OFFLINE_VERSION: '"new"',
    OFFLINE_ASSETS: JSON.stringify(assets),
    OFFLINE_RUNTIME_ASSETS: JSON.stringify(runtimeAssets),
  },
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
    ["otterpuck-shell-old", new Map([["/", "old-shell"]])],
    ["otterpuck-offline-legacy", new Map([["/", "legacy-shell"]])],
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
          keys: async (): Promise<Request[]> =>
            [...store.keys()].map(
              (path): Request =>
                new Request(new URL(path, "https://game.test")),
            ),
          delete: async (request: Request): Promise<boolean> =>
            store.delete(
              new URL(request.url).pathname + new URL(request.url).search,
            ),
          match: async (
            key: string | Request,
          ): Promise<Response | undefined> => {
            const path =
              typeof key === "string"
                ? key
                : new URL(key.url).pathname + new URL(key.url).search;
            return store.has(path) ? new Response(store.get(path)) : undefined;
          },
          put: async (request: Request, response: Response): Promise<void> => {
            const url = new URL(request.url);
            store.set(`${url.pathname}${url.search}`, await response.text());
          },
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
  expect(worker.stores.has("otterpuck-shell-old")).toBe(true);
  expect(worker.requestOptions.map((options) => options.integrity)).toEqual(
    assets.map((asset): string => asset.integrity),
  );
  expect(
    worker.requestOptions.every(
      (options): boolean => options.cache === "reload",
    ),
  ).toBe(true);
  await worker.dispatch("activate");
  expect(worker.stores.has("otterpuck-shell-old")).toBe(false);
  expect(worker.stores.has("otterpuck-offline-legacy")).toBe(false);
  expect(worker.stores.has("unrelated-cache")).toBe(true);
});

test("an interrupted install discards only the incomplete new cache", async (): Promise<void> => {
  const worker = createWorker(true);
  await expect(worker.dispatch("install")).rejects.toThrow(
    "Interrupted download",
  );
  expect(worker.stores.has("otterpuck-shell-new")).toBe(false);
  expect(worker.stores.get("otterpuck-shell-old")?.get("/")).toBe("old-shell");
});

test("offline navigation is precached and large assets cache only after use", async (): Promise<void> => {
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
  const city = "https://game.test/models/arenas/city.glb?v=city";
  expect(await (await worker.dispatch("fetch", city))?.text()).toBe("network");
  expect(await (await worker.dispatch("fetch", city))?.text()).toBe("network");
  expect(worker.network).toEqual([city]);
  expect(await worker.dispatch("fetch", "https://other.test/")).toBeUndefined();
  expect(
    await worker.dispatch("fetch", "https://game.test/", "POST"),
  ).toBeUndefined();
  expect(
    await worker.dispatch("fetch", "https://game.test/sw.js"),
  ).toBeUndefined();
});
