import { cp, mkdir, rm } from "node:fs/promises";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

import { buildOfflineWorker } from "./src/offline-build";

await rm("dist", { recursive: true, force: true });

const build = await Bun.build({
  entrypoints: ["./index.html"],
  outdir: "./dist",
  minify: true,
  target: "browser",
  define: { OFFLINE_ENABLED: "true" },
});
if (!build.success) throw new Error(build.logs.map(String).join("\n"));
await mkdir("dist/models", { recursive: true });
await cp("public", "dist", { recursive: true });
await buildOfflineWorker(build.outputs.map((output): string => output.path));
for await (const path of new Bun.Glob("**/*.{html,js,css,glb,json,svg}").scan(
  "dist",
)) {
  const file = Bun.file(`dist/${path}`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length < 1024) continue;
  for (const [suffix, compressed] of [
    [
      "br",
      brotliCompressSync(bytes, {
        params: { [constants.BROTLI_PARAM_QUALITY]: 6 },
      }),
    ],
    ["gz", gzipSync(bytes, { level: 6 })],
  ] as const) {
    if (compressed.length < bytes.length * 0.95)
      await Bun.write(`dist/${path}.${suffix}`, compressed);
  }
}
console.info("Production build ready in dist/");
