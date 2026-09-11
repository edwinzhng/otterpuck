import { join } from "node:path";
import homepage from "./index.html";
import { serveAsset } from "./src/static-assets";

const production = process.argv.includes("--production");
const root = join(import.meta.dir, production ? "dist" : "public");
const server = Bun.serve({
  hostname: process.env.HOST ?? "127.0.0.1",
  port: Number(process.env.PORT ?? 3200),
  development: false,
  routes: production ? undefined : { "/": homepage },
  fetch: (request: Request): Promise<Response> => serveAsset(root, request),
});
console.info(`Otter Hockey is ready at ${server.url}`);
