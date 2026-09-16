import { afterAll, expect, test } from "bun:test";
import { mkdtemp, rm, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  brotliCompressSync,
  brotliDecompressSync,
  gunzipSync,
  gzipSync,
} from "node:zlib";
import { serveAsset } from "../src/static-assets";

const root = await mkdtemp(join(tmpdir(), "otterpuck-assets-"));
const source = 'console.log("Otterpuck");'.repeat(200);
await Bun.write(join(root, "game.js"), source);
await Bun.write(join(root, "game.js.br"), brotliCompressSync(source));
await Bun.write(join(root, "game.js.gz"), gzipSync(source));
afterAll(async (): Promise<void> => rm(root, { recursive: true, force: true }));

const request = (headers: HeadersInit = {}, method = "GET"): Request =>
  new Request("http://localhost/game.js", { headers, method });

test("compressed assets preserve their exact bytes and content type with quality-aware negotiation", async (): Promise<void> => {
  for (const [accepted, expected] of [
    ["gzip, br", "br"],
    ["br;q=0.2, gzip;q=0.8", "gzip"],
    ["br;q=0, gzip;q=0", ""],
    ["", ""],
    ["*;q=0.5", "br"],
  ]) {
    const response = await serveAsset(
      root,
      request({ "Accept-Encoding": accepted ?? "" }),
    );
    expect(response.headers.get("Content-Encoding") ?? "").toBe(expected);
    expect(response.headers.get("Content-Type")).toContain("javascript");
    expect(response.headers.get("Vary")).toBe("Accept-Encoding");
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(response.headers.get("Content-Length")).toBe(String(bytes.length));
    expect(
      (expected === "br"
        ? brotliDecompressSync(bytes)
        : expected === "gzip"
          ? gunzipSync(bytes)
          : bytes
      ).toString(),
    ).toBe(source);
  }
});

test("unchanged files revalidate without downloading and HEAD has no body", async (): Promise<void> => {
  const first = await serveAsset(root, request());
  const etag = first.headers.get("ETag");
  if (!etag) throw new Error("Validator missing");
  const cached = await serveAsset(
    root,
    request({ "If-None-Match": etag, "Accept-Encoding": "br" }),
  );
  expect(cached.status).toBe(304);
  expect(await cached.text()).toBe("");
  const head = await serveAsset(
    root,
    request({ "Accept-Encoding": "br" }, "HEAD"),
  );
  expect(head.status).toBe(200);
  expect(head.headers.get("Content-Encoding")).toBe("br");
  expect(await head.text()).toBe("");
  expect(
    (await serveAsset(root, new Request("http://localhost/missing.js"))).status,
  ).toBe(404);
});

test("content-versioned assets stay in the browser cache", async (): Promise<void> => {
  const response = await serveAsset(
    root,
    new Request("http://localhost/game.js?v=content-hash"),
  );
  expect(response.headers.get("Cache-Control")).toBe(
    "public, max-age=31536000, immutable",
  );
});

test("a changed original never serves an outdated compressed asset or validator", async (): Promise<void> => {
  const path = join(root, "changed.js");
  await Bun.write(path, "new version");
  await Bun.write(`${path}.br`, brotliCompressSync("old version"));
  await utimes(`${path}.br`, new Date(0), new Date(0));
  const response = await serveAsset(
    root,
    new Request("http://localhost/changed.js", {
      headers: { "Accept-Encoding": "br" },
    }),
  );
  expect(response.headers.get("Content-Encoding")).toBeNull();
  expect(await response.text()).toBe("new version");
});

test("a client can forbid identity encoding without receiving an uncompressed response", async (): Promise<void> => {
  const response = await serveAsset(
    root,
    request({ "Accept-Encoding": "br;q=0, gzip;q=0, identity;q=0" }),
  );
  expect(response.status).toBe(406);
});
