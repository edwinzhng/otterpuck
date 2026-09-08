import { join } from "node:path";
import homepage from "./index.html";

const production = process.argv.includes("--production");
const root = join(import.meta.dir, production ? "dist" : "public");
const server = Bun.serve({
  hostname: process.env.HOST ?? "127.0.0.1",
  port: Number(process.env.PORT ?? 3200),
  development: false,
  routes: production ? undefined : { "/": homepage },
  fetch: async (request: Request): Promise<Response> => {
    const pathname = new URL(request.url).pathname;
    const safePath = pathname === "/" ? "index.html" : pathname.slice(1);
    if (safePath.includes(".."))
      return new Response("Not found", { status: 404 });
    const file = Bun.file(join(root, safePath));
    if (!(await file.exists()))
      return new Response("Not found", { status: 404 });
    return new Response(file, { headers: { "Cache-Control": "no-cache" } });
  },
});
console.info(`Otter Hockey is ready at ${server.url}`);
