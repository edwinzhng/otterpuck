import {
  BackSide,
  Color,
  DataTexture,
  DirectionalLight,
  DoubleSide,
  EquirectangularReflectionMapping,
  Group,
  HemisphereLight,
  LinearFilter,
  type Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  MeshToonMaterial,
  RepeatWrapping,
  RGBAFormat,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
  UVMapping,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { ArenaId } from "./arena-catalog";
import { createCascadeMaterial, finishArenaMaterial } from "./arena-materials";
import { createPoolSurface } from "./arena-surfaces";
import { assetUrl } from "./asset-url";
import { sampleCharacterRamp } from "./character-look";
import { createOceanSurface } from "./ocean";

export { ARENA_IDS, type ArenaId } from "./arena-catalog";

export type ArenaView = {
  id: ArenaId;
  root: Group;
  sky: Texture;
  ramp: DataTexture;
  shaders: ShaderMaterial[];
  time: { value: number };
  fog: Color;
  air: Color;
  rockTexture: Texture | undefined;
};

const atmosphere: Record<
  ArenaId,
  { sun: number; ground: number; air: number; fog: number }
> = {
  tropical: { sun: 0xffffff, ground: 0xb7c9d4, air: 0xb7e5ea, fog: 0x43b5c7 },
  city: { sun: 0xffd0a5, ground: 0x425672, air: 0x465578, fog: 0x327d9c },
  alpine: { sun: 0xffefdc, ground: 0xbacfe8, air: 0xc3daed, fog: 0x4bafc6 },
  forest: { sun: 0xffdeb3, ground: 0x779282, air: 0xc1d2c2, fog: 0x3faeae },
  ruins: { sun: 0xfff3d6, ground: 0x7c9e87, air: 0xaad6cf, fog: 0x3aafba },
  desert: { sun: 0xffd1a1, ground: 0xd2ad91, air: 0xeac5b2, fog: 0x43b5c7 },
  glacier: { sun: 0xc0dcff, ground: 0x738fb7, air: 0x284b76, fog: 0x319fbc },
  terminal: { sun: 0xffd0a5, ground: 0x707c93, air: 0xccadc1, fog: 0x339fac },
};

export const loadArena = async (id: ArenaId): Promise<ArenaView> => {
  const [gltf, sky, rockTexture] = await Promise.all([
    new GLTFLoader().loadAsync(assetUrl(`/models/arenas/${id}.glb`)),
    new TextureLoader().loadAsync(
      assetUrl(`/art/arenas/${id}-panorama-painted.webp`),
    ),
    id === "tropical"
      ? new TextureLoader().loadAsync(
          assetUrl("/art/arenas/island-rock-painted.webp"),
        )
      : Promise.resolve(undefined),
  ]);
  if (rockTexture) {
    rockTexture.colorSpace = SRGBColorSpace;
    rockTexture.wrapS = RepeatWrapping;
    rockTexture.wrapT = RepeatWrapping;
    rockTexture.anisotropy = 4;
  }
  const city = id === "city";
  const palette = atmosphere[id];
  sky.colorSpace = SRGBColorSpace;
  sky.mapping = EquirectangularReflectionMapping;
  const ramp = new DataTexture(
    Uint8Array.from(
      Array.from({ length: 128 }, (_, index): number[] => [
        ...sampleCharacterRamp(index / 127).map((value): number =>
          Math.round(value * 255),
        ),
        255,
      ]).flat(),
    ),
    128,
    1,
    RGBAFormat,
  );
  ramp.minFilter = LinearFilter;
  ramp.magFilter = LinearFilter;
  ramp.needsUpdate = true;
  const time = { value: 0 };
  const shaders: ShaderMaterial[] = [];
  const converted = new Map<string, Material>();
  const originals = new Set<Material>();
  gltf.scene.traverse((object): void => {
    if (!(object instanceof Mesh)) return;
    object.castShadow = !/Pool|Ocean|Marking|Circle|Goal|Semicircle|Dot/.test(
      object.name,
    );
    object.receiveShadow = true;
    const wind =
      object.parent?.name === "Wind" || object.name.startsWith("Wind");
    const convert = (source: Material): Material => {
      const key = `${source.uuid}:${wind}`;
      const existing = converted.get(key);
      if (existing) return existing;
      originals.add(source);
      const result =
        source instanceof MeshStandardMaterial &&
        /^(Mountain waterfall|Waterfall white ribbons|Waterfall turquoise|Waterfall foam)( painted)?$/.test(
          source.name,
        )
          ? createCascadeMaterial(source, time)
          : source.name.startsWith("Distant ocean")
            ? createOceanSurface()
            : source.name === "Warm lamp"
              ? new MeshBasicMaterial({
                  color: 0xffd477,
                  fog: false,
                  toneMapped: false,
                })
              : source.name === "Pool floor" || source.name === "Pool wall"
                ? createPoolSurface(city, source.name === "Pool wall")
                : source instanceof MeshStandardMaterial &&
                    source.metalness < 0.1
                  ? new MeshToonMaterial({
                      color: source.color,
                      map: source.map,
                      vertexColors: source.vertexColors,
                      gradientMap: ramp,
                      side: DoubleSide,
                      emissive: source.emissive,
                      emissiveIntensity: source.emissiveIntensity,
                    })
                  : source.clone();
      result.name = source.name;
      if (result instanceof ShaderMaterial) shaders.push(result);
      if (result instanceof MeshStandardMaterial) {
        result.envMapIntensity = 0.55;
        result.side = DoubleSide;
      }
      if (result instanceof MeshToonMaterial)
        finishArenaMaterial(result, wind, time, rockTexture);
      converted.set(key, result);
      return result;
    };
    object.material = Array.isArray(object.material)
      ? object.material.map(convert)
      : convert(object.material);
  });
  for (const material of originals) material.dispose();
  const root = new Group();
  root.name = `Arena ${id}`;
  root.add(gltf.scene);
  const backdrop = sky.clone();
  backdrop.mapping = UVMapping;
  backdrop.wrapS = RepeatWrapping;
  backdrop.repeat.x = city ? 2 : 1;
  backdrop.repeat.y = city ? 2 : 1;
  backdrop.offset.y = city ? -0.61 : 0;
  const horizon = new Mesh(
    new SphereGeometry(600, 64, 32),
    new MeshBasicMaterial({
      map: backdrop,
      side: BackSide,
      fog: false,
      depthWrite: false,
      toneMapped: false,
      color: city ? 0xe7edff : 0xffffff,
    }),
  );
  horizon.name = "Distant panorama";
  horizon.renderOrder = -100;
  root.add(horizon);
  root.add(
    new HemisphereLight(
      city ? 0xb9dafa : 0xffffff,
      palette.ground,
      city ? 0.42 : 0.26,
    ),
  );
  const sun = new DirectionalLight(palette.sun, city ? 2.3 : Math.PI * 0.9);
  sun.position.set(-12, 22, -8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -25,
    right: 25,
    top: 26,
    bottom: -26,
    near: 1,
    far: 80,
  });
  sun.shadow.normalBias = 0.035;
  sun.shadow.bias = -0.00025;
  sun.shadow.radius = 3;
  sun.shadow.intensity = city ? 0.4 : 0.52;
  root.add(sun);
  const fill = new DirectionalLight(
    city ? 0xec7bbb : 0xaeeaff,
    city ? 0.28 : 0.12,
  );
  fill.position.set(12, 8, 10);
  root.add(fill);
  return {
    id,
    root,
    sky,
    ramp,
    time,
    shaders,
    fog: new Color(palette.fog),
    air: new Color(palette.air),
    rockTexture,
  };
};

export const disposeArena = (arena: ArenaView): void => {
  const materials = new Set<Material>();
  arena.root.traverse((object): void => {
    if (object instanceof DirectionalLight) object.shadow.dispose();
    if (!(object instanceof Mesh)) return;
    if (
      object.name === "Distant panorama" &&
      object.material instanceof MeshBasicMaterial
    )
      object.material.map?.dispose();
    object.geometry.dispose();
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material])
      materials.add(material);
  });
  for (const material of materials) material.dispose();
  arena.ramp.dispose();
  arena.sky.dispose();
  arena.rockTexture?.dispose();
};
