import { cp, mkdir, rm } from "node:fs/promises";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

import { regionsSchema } from "./src/multiplayer/regions";
import { assetVersions, buildOfflineWorker } from "./src/offline-build";

const versions = await assetVersions();

await rm("dist", { recursive: true, force: true });

const build = await Bun.build({
  entrypoints: ["./index.html"],
  outdir: "./dist",
  minify: true,
  target: "browser",
  define: {
    OFFLINE_ENABLED: "true",
    ASSET_VERSIONS: JSON.stringify(versions),
  },
});
if (!build.success) throw new Error(build.logs.map(String).join("\n"));
await mkdir("dist/models", { recursive: true });
await cp("public", "dist", { recursive: true });
for (const path of [
  "dist/art/arenas/city-panorama.png",
  "dist/art/arenas/city-panorama-painted.png",
  "dist/art/arenas/island-rock-painted.png",
  "dist/art/arenas/tropical-panorama.png",
  "dist/art/arenas/tropical-panorama-painted.png",
  "dist/art/learn/curl-toon-v1.png",
  "dist/art/learn/dummy-toon-v1.png",
  "dist/art/learn/shot-toon-v1.png",
  "dist/art/learn/skills.png",
  "dist/models/otter.glb",
  "dist/models/otterpuck.glb",
  "dist/models/swimmer.glb",
])
  await rm(path, { force: true });
const regions = regionsSchema.parse(
  await Bun.file("public/multiplayer.json").json(),
);
const selfHostedUrl = process.env.PUBLIC_ROOMS_SELF_HOSTED_URL;
if (selfHostedUrl)
  regions.push({
    id: "home",
    label: "🏠 Home server",
    url: selfHostedUrl,
  });
for (const region of regions) {
  const configured =
    process.env[
      `PUBLIC_ROOMS_${region.id.replaceAll("-", "_").toUpperCase()}_URL`
    ];
  if (configured) region.url = configured;
}
await Bun.write(
  "dist/multiplayer.json",
  JSON.stringify(regionsSchema.parse(regions)),
);
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
