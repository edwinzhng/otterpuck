import {
  type Material,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
} from "three";
import { type GLTF, GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { assetUrl } from "./asset-url";
import { applyCharacterStyle } from "./character-style";
import type { CharacterSpecies } from "./characters";

const assets = new Map<CharacterSpecies, Promise<GLTF>>();
const ownedMaterials = new WeakSet<Material>();

export const loadCharacter = (species: CharacterSpecies): Promise<GLTF> => {
  let pending = assets.get(species);
  if (!pending) {
    pending = new GLTFLoader()
      .loadAsync(assetUrl(`/models/characters/${species}.glb`))
      .catch((error: unknown): never => {
        assets.delete(species);
        throw error;
      });
    assets.set(species, pending);
  }
  return pending;
};

export const CHARACTER_EQUIPMENT: Record<CharacterSpecies, number> = {
  otter: 0x2789c5,
  beaver: 0xc84c47,
  raccoon: 0x628b82,
  crocodile: 0xc99035,
  penguin: 0x599dbd,
  walrus: 0x5973aa,
  puffin: 0x317bbf,
  dolphin: 0x409fae,
};

export const colorCharacterEquipment = (
  model: Object3D,
  team?: 0 | 1,
  species: CharacterSpecies = "otter",
): void => {
  const converted = new Map<Material, Material>();
  model.traverse((object): void => {
    if (!(object instanceof Mesh)) return;
    const convert = (source: Material): Material => {
      let material = converted.get(source);
      if (material) return material;
      material = source.clone();
      ownedMaterials.add(material);
      const name = source.name.replace(/\.\d{3}$/, "");
      if (material instanceof MeshStandardMaterial) {
        if (/^(Cap|Team|Mitten|Team seam)$/.test(name))
          material.color.set(CHARACTER_EQUIPMENT[species]);
        if (team !== undefined && name === "Cap")
          material.color.set(team === 0 ? 0x24313b : 0xecf0ed);
        if (team !== undefined && name === "Team seam")
          material.color.set(team === 0 ? 0x42525e : 0xc9d4d7);
      }
      converted.set(source, material);
      return material;
    };
    object.material = Array.isArray(object.material)
      ? object.material.map(convert)
      : convert(object.material);
  });
};

export const createCharacterModel = (
  template: Object3D,
  species: CharacterSpecies,
  team?: 0 | 1,
): Object3D => {
  const model = clone(template);
  colorCharacterEquipment(model, team, species);
  const before = new Set<Material>();
  model.traverse((object): void => {
    if (object instanceof Mesh)
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material])
        before.add(material);
  });
  applyCharacterStyle(model, "soft", species);
  model.traverse((object): void => {
    if (object instanceof Mesh)
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material]) {
        before.delete(material);
        ownedMaterials.add(material);
      }
  });
  for (const material of before) material.dispose();
  return model;
};

export const disposeCharacterMaterials = (model: Object3D): void => {
  const materials = new Set<Material>();
  model.traverse((object): void => {
    if (!(object instanceof Mesh)) return;
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material])
      materials.add(material);
  });
  for (const material of materials)
    if (ownedMaterials.has(material)) material.dispose();
};
