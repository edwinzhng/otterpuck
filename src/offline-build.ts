import { createHash } from "node:crypto";
import { offlineShell, runtimeContent } from "./offline-assets";

const assetRecord = async (
  url: string,
): Promise<{ url: string; integrity: string; version: string }> => {
  const bytes = await Bun.file(
    url === "/" ? "dist/index.html" : `dist${url}`,
  ).arrayBuffer();
  const hash = createHash("sha256").update(new Uint8Array(bytes));
  return {
    url,
    integrity: `sha256-${hash.copy().digest("base64")}`,
    version: hash.digest("hex").slice(0, 16),
  };
};

export const assetVersions = async (): Promise<Record<string, string>> =>
  Object.fromEntries(
    await Promise.all(
      runtimeContent.map(async (url): Promise<[string, string]> => {
        const bytes = await Bun.file(`public${url}`).arrayBuffer();
        return [
          url,
          createHash("sha256")
            .update(new Uint8Array(bytes))
            .digest("hex")
            .slice(0, 16),
        ];
      }),
    ),
  );

export const buildOfflineWorker = async (
  outputs: readonly string[],
): Promise<void> => {
  const urls = [
    ...new Set([
      "/",
      ...offlineShell,
      ...outputs
        .map((path): string => `/${path.split("/").at(-1)}`)
        .filter((path): boolean => path !== "/index.html"),
    ]),
  ].sort();
  const version = createHash("sha256");
  version.update(await Bun.file("src/offline-worker.ts").text());
  const assets = await Promise.all(urls.map(assetRecord));
  const runtimeAssets = await Promise.all(runtimeContent.map(assetRecord));
  version.update(JSON.stringify(assets));
  const worker = await Bun.build({
    entrypoints: ["src/offline-worker.ts"],
    outdir: "dist",
    naming: "sw.js",
    target: "browser",
    minify: true,
    define: {
      OFFLINE_VERSION: JSON.stringify(version.digest("hex").slice(0, 20)),
      OFFLINE_ASSETS: JSON.stringify(assets),
      OFFLINE_RUNTIME_ASSETS: JSON.stringify(runtimeAssets),
    },
  });
  if (!worker.success) throw new Error(worker.logs.map(String).join("\n"));
  console.info(`Offline cache: ${assets.length} versioned resources`);
};
