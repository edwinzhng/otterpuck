import {
  Color,
  FogExp2,
  NoToneMapping,
  PCFShadowMap,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";
import { type ArenaId, isArenaId } from "./arena-catalog";
import { disposeArena, loadArena } from "./arenas";
import { previewCacheKey, readPreview, savePreview } from "./preview-cache";
import { revealPreview } from "./preview-reveal";
import { captureWater, createWater } from "./water";

let previews: Promise<void> | undefined;
const pending = new Set<ArenaId>();
const observed = new WeakSet<Element>();
const visible = new WeakSet<Element>();
const images: Partial<Record<ArenaId, string>> = {};
const cacheKeys = new Map<ArenaId, string | undefined>();

const needsPreview = (id: ArenaId): boolean =>
  [
    ...document.querySelectorAll<HTMLImageElement>("img[data-arena-preview]"),
  ].some(
    (image) =>
      image.dataset.arenaPreview === id &&
      Boolean(image.parentElement?.checkVisibility()),
  );

const applyPreviews = (): void => {
  for (const image of document.querySelectorAll<HTMLImageElement>(
    "img[data-arena-preview]",
  )) {
    const id = image.dataset.arenaPreview;
    const source = isArenaId(id) ? images[id] : undefined;
    if (source) revealPreview(image, source);
  }
};

const renderPreviews = async (): Promise<void> => {
  await Promise.all(
    [...pending].map(async (id): Promise<void> => {
      const sources = [
        `/models/arenas/${id}.glb`,
        `/art/arenas/${id}-panorama-painted.webp`,
      ];
      if (id === "tropical")
        sources.push("/art/arenas/island-rock-painted.webp");
      const key = await previewCacheKey(`arena-v1-${id}`, sources);
      cacheKeys.set(id, key);
      const source = await readPreview(key);
      if (source) {
        images[id] = source;
        pending.delete(id);
      }
    }),
  );
  applyPreviews();
  if (!pending.size) return;
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(1);
  const width = Math.min(
    1600,
    renderer.capabilities.maxTextureSize,
    Math.ceil(Math.max(800, (window.innerWidth * window.devicePixelRatio) / 2)),
  );
  renderer.setSize(width, Math.round(width / 1.6), false);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const camera = new PerspectiveCamera(48, 1.6, 0.1, 800);
  camera.position.set(19, 16, 28);
  camera.lookAt(0, 3, -5);
  try {
    for (const id of pending) {
      pending.delete(id);
      if (images[id] || !needsPreview(id)) continue;
      try {
        const arena = await loadArena(id);
        try {
          if (!needsPreview(id)) continue;
          const water = createWater();
          try {
            const scene = new Scene();
            scene.background = arena.sky;
            scene.backgroundIntensity = id === "city" ? 0.85 : 1;
            scene.environment = arena.sky;
            scene.add(arena.root, water.mesh);
            const tint = water.mesh.material.uniforms.uTint;
            if (tint)
              tint.value = new Color(id === "city" ? 0x187f9e : 0x45c3ce);
            water.mesh.visible = false;
            await renderer.compileAsync(scene, camera);
            water.mesh.visible = true;
            scene.fog = new FogExp2(arena.air, id === "city" ? 0.005 : 0.0018);
            await renderer.compileAsync(scene, camera);
            renderer.shadowMap.needsUpdate = true;
            captureWater(water, renderer, scene);
            renderer.render(scene, camera);
            images[id] = await savePreview(
              cacheKeys.get(id),
              renderer.domElement,
            );
            applyPreviews();
          } finally {
            water.mesh.geometry.dispose();
            water.mesh.material.dispose();
            water.reflection.dispose();
          }
        } finally {
          disposeArena(arena);
        }
      } catch (error: unknown) {
        console.warn(`Map preview could not load for ${id}`, error);
      }
      await new Promise<void>((resolve): void => {
        setTimeout(resolve, 0);
      });
    }
  } finally {
    renderer.dispose();
    renderer.forceContextLoss();
  }
};

export const showArenaPreviews = async (): Promise<void> => {
  applyPreviews();
  for (const image of document.querySelectorAll<HTMLImageElement>(
    "img[data-arena-preview]",
  )) {
    const container = image.parentElement;
    if (!container) continue;
    if (!observed.has(container)) {
      observed.add(container);
      observer.observe(container);
    }
    if (!visible.has(container) || !container.checkVisibility()) continue;
    const id = image.dataset.arenaPreview;
    if (isArenaId(id) && !images[id]) pending.add(id);
  }
  if (pending.size && !previews)
    previews = renderPreviews().finally((): void => {
      previews = undefined;
    });
  await previews;
  applyPreviews();
};

const observer = new IntersectionObserver((entries): void => {
  for (const entry of entries) {
    if (entry.isIntersecting) visible.add(entry.target);
    else visible.delete(entry.target);
  }
  if (entries.some((entry): boolean => entry.isIntersecting))
    void showArenaPreviews().catch(console.warn);
});
