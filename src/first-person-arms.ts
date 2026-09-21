import {
  type Bone,
  BufferGeometry,
  Float32BufferAttribute,
  Matrix4,
  Mesh,
  type Object3D,
  type PerspectiveCamera,
  SkinnedMesh,
  Vector3,
} from "three";

const rings = 12;
const sides = 32;
export type FirstPersonArm = {
  mesh: Mesh;
  paw: Bone;
  grip: Vector3;
  side: number;
};

export const createFirstPersonArms = (
  model: Object3D,
): Map<string, FirstPersonArm> => {
  const parts = new Map<string, FirstPersonArm>();
  let skin: SkinnedMesh | undefined;
  model.traverse((object): void => {
    if (
      object instanceof SkinnedMesh &&
      !Array.isArray(object.material) &&
      /^(Paw fur|Fur)$/.test(object.material.name)
    )
      if (!skin || object.material.name === "Paw fur") skin = object;
  });
  if (!skin) return parts;
  for (const side of ["L", "R"]) {
    const mitten = model.getObjectByName(`GripPaw${side}Mitten`);
    const paw = skin.skeleton.bones.find(
      (bone) => bone.name.replaceAll(".", "") === `paw${side}`,
    );
    if (!(mitten instanceof SkinnedMesh) || !paw) continue;
    mitten.geometry.computeBoundingBox();
    const grip =
      mitten.geometry.boundingBox?.getCenter(new Vector3()) ?? new Vector3();
    paw.worldToLocal(mitten.localToWorld(grip));
    const geometry = new BufferGeometry();
    const count = (rings + 1) * sides;
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(new Float32Array(count * 3), 3),
    );
    geometry.setAttribute(
      "normal",
      new Float32BufferAttribute(new Float32Array(count * 3), 3),
    );
    geometry.setAttribute(
      "color",
      new Float32BufferAttribute(new Float32Array(count * 3).fill(1), 3),
    );
    const indices: number[] = [];
    for (let ring = 0; ring < rings; ring++)
      for (let edge = 0; edge < sides; edge++) {
        const a = ring * sides + edge,
          b = ring * sides + ((edge + 1) % sides);
        indices.push(a, b, a + sides, b, b + sides, a + sides);
      }
    geometry.setIndex(indices);
    const mesh = new Mesh(geometry, skin.material);
    mesh.name = `FirstPersonArm${side}`;
    mesh.frustumCulled = false;
    mesh.visible = false;
    model.add(mesh);
    parts.set(side, { mesh, paw, grip, side: side === "R" ? 1 : -1 });
  }
  return parts;
};

const start = new Vector3(),
  end = new Vector3(),
  middle = new Vector3();
const center = new Vector3(),
  tangent = new Vector3(),
  across = new Vector3();
const up = new Vector3(),
  normal = new Vector3(),
  point = new Vector3();
const inverse = new Matrix4();

// The camera-side end stays behind the viewer; the wrist follows the unchanged paw rig.
export const updateFirstPersonArms = (
  parts: Map<string, FirstPersonArm>,
  camera: PerspectiveCamera,
): void => {
  camera.updateMatrixWorld();
  for (const arm of parts.values()) {
    if (!arm.mesh.visible) continue;
    start.set(arm.side * 0.24, -0.27, 0.22).applyMatrix4(camera.matrixWorld);
    end.copy(arm.grip).applyMatrix4(arm.paw.matrixWorld);
    middle.copy(start).lerp(end, 0.55);
    middle.y -= 0.035;
    arm.mesh.updateWorldMatrix(true, false);
    inverse.copy(arm.mesh.matrixWorld).invert();
    const positions = arm.mesh.geometry.getAttribute("position");
    const normals = arm.mesh.geometry.getAttribute("normal");
    for (let ring = 0; ring <= rings; ring++) {
      const t = ring / rings;
      center
        .copy(start)
        .multiplyScalar((1 - t) ** 2)
        .addScaledVector(middle, 2 * t * (1 - t))
        .addScaledVector(end, t * t);
      tangent
        .copy(middle)
        .sub(start)
        .multiplyScalar(1 - t)
        .addScaledVector(point.copy(end).sub(middle), t)
        .normalize();
      across.set(0, 1, 0).cross(tangent).normalize();
      up.crossVectors(tangent, across).normalize();
      const radius = 0.075 * (1 - t) + 0.033 * t;
      for (let edge = 0; edge < sides; edge++) {
        const angle = (edge / sides) * Math.PI * 2;
        normal
          .copy(across)
          .multiplyScalar(Math.cos(angle))
          .addScaledVector(up, Math.sin(angle));
        point
          .copy(center)
          .addScaledVector(normal, radius)
          .applyMatrix4(inverse);
        normal.transformDirection(inverse);
        const index = ring * sides + edge;
        positions.setXYZ(index, point.x, point.y, point.z);
        normals.setXYZ(index, normal.x, normal.y, normal.z);
      }
    }
    positions.needsUpdate = true;
    normals.needsUpdate = true;
  }
};
