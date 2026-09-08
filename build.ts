import { cp, mkdir } from "node:fs/promises";

const build = await Bun.build({
  entrypoints: ["./index.html"],
  outdir: "./dist",
  minify: true,
  target: "browser",
});
if (!build.success) throw new Error(build.logs.map(String).join("\n"));
await mkdir("dist/models", { recursive: true });
await cp("public", "dist", { recursive: true });
console.info("Production build ready in dist/");
