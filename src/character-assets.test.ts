import { expect, test } from "bun:test";
import {
  type Material,
  Mesh,
  MeshStandardMaterial,
  MeshToonMaterial,
  type Object3D,
} from "three";
import {
  CHARACTER_EQUIPMENT,
  createCharacterModel,
  disposeCharacterMaterials,
} from "./character-assets";
import { CHARACTER_SPECIES } from "./characters";
import { loadCharacterModel } from "./test-support/assets";

const materialsOf = (model: Object3D): Map<string, Material> => {
  const materials = new Map<string, Material>();
  model.traverse((object): void => {
    if (!(object instanceof Mesh)) return;
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material])
      materials.set(material.name, material);
  });
  return materials;
};

test.each([...CHARACTER_SPECIES])(
  "%s can wear either team's equipment without changing its body or source",
  async (species): Promise<void> => {
    const asset = await loadCharacterModel(species);
    const source = materialsOf(asset.scene);
    const originalColors = new Map(
      [...source].flatMap(([name, material]): [string, number][] =>
        material instanceof MeshStandardMaterial
          ? [[name, material.color.getHex()]]
          : [],
      ),
    );
    const black = createCharacterModel(asset.scene, species, 0);
    const white = createCharacterModel(asset.scene, species, 1);
    const blackMaterials = materialsOf(black);
    const whiteMaterials = materialsOf(white);
    for (const [name, original] of originalColors) {
      const b = blackMaterials.get(name),
        w = whiteMaterials.get(name);
      expect(b).not.toBe(w);
      const sourceMaterial = source.get(name);
      if (sourceMaterial instanceof MeshStandardMaterial)
        expect(sourceMaterial.color.getHex()).toBe(original);
      if (
        !(b instanceof MeshStandardMaterial || b instanceof MeshToonMaterial) ||
        !(w instanceof MeshStandardMaterial || w instanceof MeshToonMaterial)
      )
        continue;
      if (name === "Cap") {
        expect(b.color.getHex()).toBe(0x24313b);
        expect(w.color.getHex()).toBe(0xecf0ed);
      } else if (["Team", "Mitten"].includes(name)) {
        expect(b.color.getHex()).toBe(CHARACTER_EQUIPMENT[species]);
        expect(w.color.getHex()).toBe(CHARACTER_EQUIPMENT[species]);
      } else if (name !== "Team seam") {
        expect(b.color.getHex()).toBe(original);
        expect(w.color.getHex()).toBe(original);
      }
    }
    disposeCharacterMaterials(black);
    disposeCharacterMaterials(white);
  },
);
