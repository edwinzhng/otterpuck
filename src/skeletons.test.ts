import { expect, test } from "bun:test";
import { AnimationMixer, type Object3D, SkinnedMesh, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { CHARACTER_SPECIES } from "./characters";
import { shareCharacterSkeleton } from "./skeletons";

const skins = (model: Object3D): SkinnedMesh[] => {
  const result: SkinnedMesh[] = [];
  model.traverse((object): void => {
    if (object instanceof SkinnedMesh) result.push(object);
  });
  return result;
};
test("sharing identical skeleton uploads preserves animated vertices and independent swimmers", async (): Promise<void> => {
  for (const species of CHARACTER_SPECIES) {
    const asset = await new GLTFLoader().parseAsync(
      await Bun.file(`public/models/characters/${species}.glb`).arrayBuffer(),
      "",
    );
    const original = clone(asset.scene),
      optimized = clone(asset.scene),
      opponent = clone(asset.scene);
    shareCharacterSkeleton(optimized);
    shareCharacterSkeleton(opponent);
    const originalSkins = skins(original),
      optimizedSkins = skins(optimized),
      opponentSkins = skins(opponent);
    expect(new Set(optimizedSkins.map((mesh) => mesh.skeleton)).size).toBe(1);
    expect(optimizedSkins.at(0)?.skeleton).not.toBe(
      opponentSkins.at(0)?.skeleton,
    );
    const clip = asset.animations.find(
      (candidate) => candidate.name === "Swim",
    );
    if (!clip) throw new Error("Swim clip missing");
    const mixers = [original, optimized].map((model) => {
      const mixer = new AnimationMixer(model);
      mixer.clipAction(clip).play();
      return mixer;
    });
    for (const time of [0, 0.16, 0.37, 0.72]) {
      for (const mixer of mixers) mixer.setTime(time);
      original.updateMatrixWorld(true);
      optimized.updateMatrixWorld(true);
      for (const [index, mesh] of optimizedSkins.entries()) {
        const source = originalSkins.at(index);
        if (!source) throw new Error("Mesh missing");
        mesh.skeleton.update();
        source.skeleton.update();
        for (const vertex of [
          0,
          Math.floor(mesh.geometry.getAttribute("position").count / 2),
        ]) {
          expect(
            mesh
              .getVertexPosition(vertex, new Vector3())
              .distanceTo(source.getVertexPosition(vertex, new Vector3())),
          ).toBeLessThan(0.000001);
        }
      }
    }
    const bone = optimizedSkins.at(0)?.skeleton.bones.at(1),
      other = opponentSkins.at(0)?.skeleton.bones.at(1);
    if (!bone || !other) throw new Error("Skeleton missing");
    const untouched = other.quaternion.clone();
    bone.rotateX(0.4);
    expect(other.quaternion.equals(untouched)).toBe(true);
  }
});
