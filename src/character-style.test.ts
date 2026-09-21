import { expect, test } from "bun:test";
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  MeshToonMaterial,
} from "three";
import { applyCharacterStyle } from "./character-style";

test("character finish shares materials without changing geometry or source assets", (): void => {
  const source = new MeshStandardMaterial({ vertexColors: true });
  source.name = "Fur";
  source.userData.otterpuck_shading = "soft-toon";
  const geometry = new BoxGeometry();
  const model = new Group();
  const first = new Mesh(geometry, source);
  const second = new Mesh(geometry, source);
  model.add(first, second);
  const materials = applyCharacterStyle(model, "soft", "walrus");
  expect(materials).toHaveLength(1);
  expect(first.material).toBe(second.material);
  expect(first.material).toBeInstanceOf(MeshToonMaterial);
  expect(first.geometry).toBe(geometry);
  expect(first.material).not.toBe(source);
  expect(source.roughness).toBe(1);
  expect(first.material.customProgramCacheKey()).toContain("walrus");
  geometry.dispose();
  source.dispose();
  for (const material of materials) material.dispose();
});

test("glass and eyes retain their reflective standard materials", (): void => {
  const model = new Group();
  const geometry = new BoxGeometry();
  for (const name of ["Lens", "Eyes", "Nose"]) {
    const material = new MeshStandardMaterial({ roughness: 0.2 });
    material.name = name;
    model.add(new Mesh(geometry, material));
  }
  expect(applyCharacterStyle(model)).toHaveLength(0);
  for (const object of model.children) {
    if (!(object instanceof Mesh)) continue;
    expect(object.material).toBeInstanceOf(MeshStandardMaterial);
    object.material.dispose();
  }
  geometry.dispose();
});
