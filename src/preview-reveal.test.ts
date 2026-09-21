import { afterEach, expect, mock, test } from "bun:test";
import { revealPreview } from "./preview-reveal";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
afterEach((): void => {
  if (originalWindow)
    Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});
const fixture = (reduced = false) => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      matchMedia: () => ({ matches: reduced }),
    },
  });
  const decodes: { resolve: () => void; reject: () => void }[] = [];
  const animate = mock(() => undefined);
  const element = {
    src: "",
    hidden: true,
    animate,
    getAttribute: (): string => element.src,
    removeAttribute: (): void => {
      element.src = "";
    },
    decode: (): Promise<void> =>
      new Promise((resolve, reject) =>
        decodes.push({ resolve, reject: () => reject(new Error("decode")) }),
      ),
  };
  return {
    element,
    image: element as unknown as HTMLImageElement,
    decodes,
    animate,
  };
};

test("preview waits for decoding, fades once, and ignores repeated application", async (): Promise<void> => {
  const f = fixture();
  revealPreview(f.image, "blob:first");
  expect(f.element.hidden).toBe(true);
  f.decodes[0]?.resolve();
  await Promise.resolve();
  expect(f.element.hidden).toBe(false);
  expect(f.animate).toHaveBeenCalledTimes(1);
  revealPreview(f.image, "blob:first");
  expect(f.decodes).toHaveLength(1);
  expect(f.animate).toHaveBeenCalledTimes(1);
});

test("stale decodes cannot reveal a replacement before it is ready", async (): Promise<void> => {
  const f = fixture();
  revealPreview(f.image, "blob:first");
  revealPreview(f.image, "blob:second");
  f.decodes[0]?.resolve();
  await Promise.resolve();
  expect(f.element.hidden).toBe(true);
  f.decodes[1]?.resolve();
  await Promise.resolve();
  expect(f.element.hidden).toBe(false);
  expect(f.animate).toHaveBeenCalledTimes(1);
});

test("reduced motion reveals without fading and failed decoding can retry", async (): Promise<void> => {
  const f = fixture(true);
  revealPreview(f.image, "blob:first");
  f.decodes[0]?.reject();
  await Promise.resolve();
  await Promise.resolve();
  expect(f.element.hidden).toBe(true);
  expect(f.element.src).toBe("");
  revealPreview(f.image, "blob:first");
  f.decodes[1]?.resolve();
  await Promise.resolve();
  expect(f.element.hidden).toBe(false);
  expect(f.animate).not.toHaveBeenCalled();
});
