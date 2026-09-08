import { type Object3D, type Skeleton, SkinnedMesh } from "three";

export const shareCharacterSkeleton = (model: Object3D): void => {
  const skeletons: Skeleton[] = [];
  model.traverse((object): void => {
    if (!(object instanceof SkinnedMesh)) return;
    const source = object.skeleton;
    const shared = skeletons.find(
      (candidate): boolean =>
        candidate.bones.length === source.bones.length &&
        candidate.bones.every((bone, index): boolean => {
          const inverse = source.boneInverses.at(index);
          return (
            bone === source.bones.at(index) &&
            inverse !== undefined &&
            candidate.boneInverses.at(index)?.equals(inverse) === true
          );
        }),
    );
    if (shared) object.skeleton = shared;
    else skeletons.push(source);
  });
};
