import { createHash } from "node:crypto";
import { offlineContent } from "./offline-assets";

export const buildOfflineWorker = async (
  outputs: readonly string[],
): Promise<void> => {
  const urls = [
    ...new Set([
      "/",
      ...offlineContent,
      ...outputs
        .map((path): string => `/${path.split("/").at(-1)}`)
        .filter((path): boolean => path !== "/index.html"),
    ]),
  ].sort();
  const version = createHash("sha256");
  version.update(await Bun.file("src/offline-worker.ts").text());
  const assets = await Promise.all(
    urls.map(async (url): Promise<{ url: string; integrity: string }> => {
      const bytes = await Bun.file(
        url === "/" ? "dist/index.html" : `dist${url}`,
      ).arrayBuffer();
      const integrity = `sha256-${createHash("sha256").update(new Uint8Array(bytes)).digest("base64")}`;
      return { url, integrity };
    }),
  );
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
    },
  });
  if (!worker.success) throw new Error(worker.logs.map(String).join("\n"));
  console.info(`Offline cache: ${assets.length} versioned resources`);
};
