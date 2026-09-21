import { afterAll, afterEach, expect, spyOn, test } from "bun:test";
import { previewCacheKey, readPreview } from "./preview-cache";

const fetchMock = spyOn(globalThis, "fetch");
afterAll((): void => {
  fetchMock.mockRestore();
});
afterEach((): void => {
  fetchMock.mockReset();
});

test("preview keys change when either the model or its background changes", async (): Promise<void> => {
  const sources = ["/model.glb", "/sky.webp"];
  const response = (tag: string): Response =>
    new Response(null, { headers: { ETag: tag } });
  fetchMock
    .mockResolvedValueOnce(response("model-1"))
    .mockResolvedValueOnce(response("sky-1"));
  const first = await previewCacheKey("arena", sources);
  fetchMock
    .mockResolvedValueOnce(response("model-2"))
    .mockResolvedValueOnce(response("sky-1"));
  expect(await previewCacheKey("arena", sources)).not.toBe(first);
  fetchMock
    .mockResolvedValueOnce(response("model-1"))
    .mockResolvedValueOnce(response("sky-2"));
  expect(await previewCacheKey("arena", sources)).not.toBe(first);
  expect(fetchMock).toHaveBeenCalledWith("/model.glb", {
    method: "HEAD",
    cache: "no-cache",
  });
});

test("unversioned assets and failed requests skip persistent caching", async (): Promise<void> => {
  fetchMock.mockResolvedValueOnce(new Response(null));
  expect(await previewCacheKey("portrait", ["/model.glb"])).toBeUndefined();
  fetchMock.mockRejectedValueOnce(new Error("offline"));
  expect(await previewCacheKey("portrait", ["/model.glb"])).toBeUndefined();
  expect(await readPreview(undefined)).toBeUndefined();
});
