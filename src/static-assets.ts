import { join } from "node:path";

const encodings = (header: string): string[] => {
  const qualities = new Map(
    header
      .toLowerCase()
      .split(",")
      .map((part): [string, number] => {
        const [name, ...parameters] = part.trim().split(";");
        const value = parameters.find((parameter): boolean =>
          parameter.trim().startsWith("q="),
        );
        const quality = value ? Number(value.trim().slice(2)) : 1;
        return [
          name ?? "",
          Number.isFinite(quality) && quality >= 0 && quality <= 1
            ? quality
            : 0,
        ];
      }),
  );
  const compressed = ["br", "gzip"]
    .map((name) => ({
      name,
      quality: qualities.get(name) ?? qualities.get("*") ?? 0,
    }))
    .filter(({ quality }): boolean => quality > 0)
    .sort((a, b): number => b.quality - a.quality)
    .map(({ name }): string => name);
  const identityAllowed =
    (qualities.get("identity") ?? (qualities.get("*") === 0 ? 0 : 1)) > 0;
  return identityAllowed ? [...compressed, "identity"] : compressed;
};

export const serveAsset = async (
  root: string,
  request: Request,
): Promise<Response> => {
  const pathname = new URL(request.url).pathname;
  const safePath = pathname === "/" ? "index.html" : pathname.slice(1);
  if (safePath.includes(".."))
    return new Response("Not found", { status: 404 });
  if (request.method !== "GET" && request.method !== "HEAD")
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD" },
    });
  const path = join(root, safePath);
  const file = Bun.file(path);
  if (!(await file.exists())) return new Response("Not found", { status: 404 });
  const etag = `W/"${file.size.toString(16)}-${file.lastModified.toString(16)}"`;
  const headers = new Headers({
    "Cache-Control": "no-cache",
    "Content-Type": file.type,
    Vary: "Accept-Encoding",
    ETag: etag,
  });
  const matches = request.headers
    .get("If-None-Match")
    ?.split(",")
    .map((value): string => value.trim());
  if (matches?.includes(etag) || matches?.includes("*"))
    return new Response(undefined, { status: 304, headers });
  for (const encoding of encodings(
    request.headers.get("Accept-Encoding") ?? "",
  )) {
    if (encoding === "identity") {
      headers.set("Content-Length", String(file.size));
      return new Response(request.method === "HEAD" ? undefined : file, {
        headers,
      });
    }
    const compressed = Bun.file(`${path}.${encoding === "gzip" ? "gz" : "br"}`);
    if (
      !(await compressed.exists()) ||
      compressed.lastModified < file.lastModified
    )
      continue;
    headers.set("Content-Encoding", encoding);
    headers.set("Content-Length", String(compressed.size));
    return new Response(request.method === "HEAD" ? undefined : compressed, {
      headers,
    });
  }
  return new Response("No acceptable encoding", {
    status: 406,
    headers: { Vary: "Accept-Encoding" },
  });
};
