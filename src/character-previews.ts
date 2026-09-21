import {
  Bone,
  Box3,
  Color,
  DirectionalLight,
  HemisphereLight,
  NoToneMapping,
  type Object3D,
  OrthographicCamera,
  Quaternion,
  Scene,
  type Skeleton,
  SkinnedMesh,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import {
  createCharacterModel,
  disposeCharacterMaterials,
  loadCharacter,
} from "./character-assets";
import { configureCharacterEquipment } from "./character-style";
import {
  applyCharacterVisorReflection,
  createCharacterVisorReflection,
} from "./character-visor";
import { type CharacterSpecies, isCharacterSpecies } from "./characters";
import { previewCacheKey, readPreview, savePreview } from "./preview-cache";
import { revealPreview } from "./preview-reveal";

const images = new Map<CharacterSpecies, string>();
const cacheKeys = new Map<CharacterSpecies, string | undefined>();
const pending = new Set<CharacterSpecies>();
const observed = new WeakSet<Element>();
const visible = new WeakSet<Element>();
let rendering: Promise<void> | undefined;

const posePortraitArms = (model: Object3D): void => {
  const bones = new Map<string, Bone>();
  model.traverse((object): void => {
    if (object instanceof Bone)
      bones.set(object.name.replaceAll(".", ""), object);
  });
  const aim = (bone: Bone, direction: Vector3): void => {
    if (!bone.parent) return;
    const local = direction
      .clone()
      .transformDirection(bone.parent.matrixWorld.clone().invert());
    const axis = new Vector3(0, 1, 0).applyQuaternion(bone.quaternion);
    bone.quaternion.premultiply(
      new Quaternion().setFromUnitVectors(axis.normalize(), local.normalize()),
    );
    bone.updateMatrixWorld(true);
  };
  for (const [side, suffix] of [
    [-1, "L"],
    [1, "R"],
  ] as const) {
    const upper = bones.get(`arm${suffix}`),
      lower = bones.get(`forearm${suffix}`),
      paw = bones.get(`paw${suffix}`);
    if (!upper || !lower || !paw) continue;
    const start = upper.getWorldPosition(new Vector3());
    const middle = lower.getWorldPosition(new Vector3());
    const end = paw.getWorldPosition(new Vector3());
    const a = start.distanceTo(middle),
      b = middle.distanceTo(end);
    const distance = (a + b) * 0.98;
    const direction = new Vector3(side * 0.22, -0.98, -0.08).normalize();
    const pole = new Vector3(side, 0, 0).projectOnPlane(direction).normalize();
    const along = (a * a - b * b + distance * distance) / (2 * distance);
    const elbow = start
      .clone()
      .addScaledVector(direction, along)
      .addScaledVector(pole, Math.sqrt(Math.max(0, a * a - along * along)));
    const target = start.clone().addScaledVector(direction, distance);
    aim(upper, elbow.clone().sub(start));
    aim(lower, target.clone().sub(elbow));
    if (paw.parent) paw.position.copy(paw.parent.worldToLocal(target.clone()));
    aim(paw, direction);
  }
  model.updateMatrixWorld(true);
};

const renderPortraits = async (): Promise<void> => {
  await Promise.all(
    [...pending].map(async (species): Promise<void> => {
      const cacheKey = await previewCacheKey(`portrait-v2-${species}`, [
        `/models/characters/${species}.glb`,
      ]);
      cacheKeys.set(species, cacheKey);
      const source = await readPreview(cacheKey);
      if (source) {
        images.set(species, source);
        pending.delete(species);
      }
    }),
  );
  applyPortraits();
  if (!pending.size) return;
  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(384, 384, false);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NoToneMapping;
  renderer.setClearColor(new Color(0xe9f5f8), 0);
  const reflection = createCharacterVisorReflection(renderer);
  try {
    for (const species of pending) {
      pending.delete(species);
      if (
        ![
          ...document.querySelectorAll<HTMLImageElement>(
            "img[data-character-preview]",
          ),
        ].some(
          (image): boolean =>
            image.dataset.characterPreview === species &&
            Boolean(image.parentElement?.checkVisibility()),
        )
      )
        continue;
      try {
        const next = pending.values().next().value;
        if (next) void loadCharacter(next).catch((): void => {});
        const asset = await loadCharacter(species);
        const model = createCharacterModel(asset.scene, species);
        try {
          configureCharacterEquipment(model);
          applyCharacterVisorReflection(model, reflection.texture);
          model.rotation.x = Math.PI / 2;
          model.traverse((object): void => {
            if (object instanceof Bone && object.name === "head")
              object.quaternion.setFromAxisAngle(
                new Vector3(1, 0, 0),
                -Math.PI / 2,
              );
          });
          model.updateMatrixWorld(true);
          posePortraitArms(model);
          const bounds = new Box3().setFromObject(model, true);
          const center = bounds.getCenter(new Vector3());
          model.traverse((object): void => {
            if (object instanceof Bone && object.name === "head")
              object.getWorldPosition(center);
          });
          center.y += species === "walrus" ? -0.025 : 0.015;
          const height = species === "walrus" ? 0.45 : 0.36;
          const camera = new OrthographicCamera(
            -height / 2,
            height / 2,
            height / 2,
            -height / 2,
            0.01,
            20,
          );
          camera.position.copy(center).add(new Vector3(1.4, 0.25, -2.4));
          camera.lookAt(center);
          const scene = new Scene();
          scene.add(model, new HemisphereLight(0xe9f8ff, 0x657781, 2.0));
          const keyLight = new DirectionalLight(0xffedd7, 2.5);
          keyLight.position.set(-2, 3, -4);
          const rim = new DirectionalLight(0xb1e7ff, 1.8);
          rim.position.set(2, 1, 2);
          scene.add(keyLight, rim);
          await renderer.compileAsync(scene, camera);
          renderer.render(scene, camera);
          images.set(
            species,
            await savePreview(cacheKeys.get(species), renderer.domElement),
          );
          applyPortraits();
        } finally {
          const skeletons = new Set<Skeleton>();
          model.traverse((object): void => {
            if (object instanceof SkinnedMesh) skeletons.add(object.skeleton);
          });
          for (const skeleton of skeletons) skeleton.dispose();
          disposeCharacterMaterials(model);
        }
      } catch (error: unknown) {
        console.warn(`Character preview could not load for ${species}`, error);
      }
      await new Promise<void>((resolve): void => {
        setTimeout(resolve, 0);
      });
    }
  } finally {
    reflection.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }
};

const applyPortraits = (): void => {
  for (const image of document.querySelectorAll<HTMLImageElement>(
    "img[data-character-preview]",
  )) {
    const species = image.dataset.characterPreview;
    const source = isCharacterSpecies(species)
      ? images.get(species)
      : undefined;
    if (source) revealPreview(image, source);
  }
};

export const showCharacterPreviews = async (): Promise<void> => {
  applyPortraits();
  for (const image of document.querySelectorAll<HTMLImageElement>(
    "img[data-character-preview]",
  )) {
    const container = image.parentElement;
    if (!container) continue;
    if (!observed.has(container)) {
      observed.add(container);
      observer.observe(container);
    }
    if (!visible.has(container) || !container.checkVisibility()) continue;
    const species = image.dataset.characterPreview;
    if (!isCharacterSpecies(species)) continue;
    if (!images.has(species)) pending.add(species);
  }
  if (pending.size && !rendering)
    rendering = renderPortraits().finally((): void => {
      rendering = undefined;
    });
  await rendering;
  applyPortraits();
};

const observer = new IntersectionObserver((entries): void => {
  for (const entry of entries) {
    if (entry.isIntersecting) visible.add(entry.target);
    else visible.delete(entry.target);
  }
  if (entries.some((entry): boolean => entry.isIntersecting))
    void showCharacterPreviews().catch(console.warn);
});
