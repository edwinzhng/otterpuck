import { beforeAll, expect, test } from "bun:test";
import { Box3, Mesh, type Object3D, Scene, SkinnedMesh, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  createSimulation,
  requestShot,
  setPlayerHandedness,
  stepSimulation,
} from "../src/simulation";
import { bladePoint, HOOK_ROOT, STICK_GRIP } from "../src/stick";
import { type Controls, freshControls, STEP, STICK_EDGE } from "../src/types";
import { createSwimmerView, poseSwimmer } from "../src/world";

const asset: { template: Object3D | undefined } = { template: undefined };
beforeAll(async (): Promise<void> => {
  const bytes = await Bun.file(
    new URL("../public/models/otter-paws.glb", import.meta.url),
  ).arrayBuffer();
  asset.template = (await new GLTFLoader().parseAsync(bytes, "")).scene;
});
const setup = (): {
  view: ReturnType<typeof createSwimmerView>;
  state: ReturnType<typeof createSimulation>;
} => {
  if (!asset.template) throw new Error("Otter did not load");
  return {
    view: createSwimmerView(asset.template, 0, new Scene()),
    state: createSimulation("2-3-1", "2-3-1", "playground"),
  };
};

test("the Blender otter is compact, rigged, and within its geometry budget", (): void => {
  const { view } = setup();
  for (const name of [
    "head",
    "thighL",
    "shinL",
    "footL",
    "thighR",
    "shinR",
    "footR",
    "pawL",
    "pawR",
  ])
    expect(view.bones.has(name)).toBe(true);
  const budget = { meshes: 0, vertices: 0 };
  view.model.traverse((object: Object3D): void => {
    expect(object.name.startsWith("Glove")).toBe(false);
    expect(object.name).not.toBe("Cube");
    if (!(object instanceof Mesh)) return;
    budget.meshes += 1;
    budget.vertices += object.geometry.getAttribute("position").count;
    expect(object instanceof SkinnedMesh).toBe(true);
    expect(object.geometry.getAttribute("skinWeight").count).toBe(
      object.geometry.getAttribute("position").count,
    );
  });
  expect(budget.meshes).toBeLessThan(18);
  expect(budget.vertices).toBeLessThan(18000);
  const size = new Box3().setFromObject(view.model).getSize(new Vector3());
  expect(size.z).toBeLessThan(1.15);
  expect(size.x).toBeLessThan(0.55);
});

test("first person displays the stick and its holding paw", (): void => {
  const { view, state } = setup();
  const player = state.players.at(0);
  if (!player) throw new Error("Otter missing");
  poseSwimmer(view, player, 0, true);
  view.model.traverse((object: Object3D): void => {
    if (object instanceof Mesh)
      expect(object.visible).toBe(object.name.startsWith("GripPawR"));
  });
  expect(view.stick.visible).toBe(true);
  const paw = view.bones.get("pawR");
  if (!paw) throw new Error("Paw missing");
  const center = paw.getWorldPosition(new Vector3());
  view.model.traverse((object: Object3D): void => {
    if (!(object instanceof SkinnedMesh) || !object.visible) return;
    object.skeleton.update();
    const boneIndex = object.skeleton.bones.indexOf(paw);
    const weights = object.geometry.getAttribute("skinIndex");
    for (const index of Array.from(
      { length: weights.count },
      (_unused, value): number => value,
    )) {
      if (weights.getX(index) !== boneIndex) continue;
      const point = object.localToWorld(
        object.getVertexPosition(index, new Vector3()),
      );
      expect(point.distanceTo(center)).toBeCloseTo(0.036, 5);
    }
  });
});

test("the visible bevel follows its contact geometry throughout a flick", (): void => {
  const { view, state } = setup();
  const player = state.players.at(0);
  if (!player) throw new Error("Otter missing");
  requestShot(player, 1, new Vector3(0, 0, -1));
  const heights: number[] = [];
  for (const unused of Array.from({ length: 40 })) {
    void unused;
    stepSimulation(state, freshControls(), STEP);
    poseSwimmer(view, player, 0, true);
    view.stick.updateMatrixWorld(true);
    for (const [x, z] of STICK_EDGE) {
      const point = new Vector3(x, 0, z);
      expect(
        view.stick
          .localToWorld(point.clone())
          .distanceTo(bladePoint(player, point)),
      ).toBeLessThan(0.000001);
    }
    const tip = view.stick.localToWorld(new Vector3(-0.125, 0, -0.037));
    const hookRoot = view.stick.localToWorld(HOOK_ROOT.clone());
    heights.push(tip.y - hookRoot.y);
  }
  expect(Math.max(...heights)).toBeGreaterThan(0.085);
});

test("little fins kick vertically instead of sweeping sideways", (): void => {
  const { view, state } = setup();
  const player = state.players.at(0);
  if (!player) throw new Error("Otter missing");
  player.kick = 1;
  const path: Vector3[] = [];
  for (const phase of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    player.kickPhase = phase;
    poseSwimmer(view, player, 0, true);
    view.root.updateMatrixWorld(true);
    const foot = view.bones.get("footL");
    if (!foot) throw new Error("Fin rig missing");
    path.push(foot.getWorldPosition(new Vector3()));
  }
  expect(
    Math.max(...path.map((p): number => p.x)) -
      Math.min(...path.map((p): number => p.x)),
  ).toBeLessThan(0.001);
  expect(
    Math.max(...path.map((p): number => p.y)) -
      Math.min(...path.map((p): number => p.y)),
  ).toBeGreaterThan(0.035);
});

test("each rendered paw grips the stick through handling, shots, swimming, and interpolation", (): void => {
  for (const hand of ["right", "left"] as const) {
    const { view, state } = setup();
    const player = state.players.at(0);
    if (!player) throw new Error("Otter missing");
    setPlayerHandedness(state, hand);
    const moves: Controls[] = [
      freshControls(),
      { ...freshControls(), curl: 1 },
      { ...freshControls(), curl: -1 },
      { ...freshControls(), dummy: -1 },
      { ...freshControls(), dummy: 1 },
      { ...freshControls(), pushPull: true },
      { ...freshControls(), charging: true, charge: 1 },
      { ...freshControls(), shot: 1 },
      { ...freshControls(), vertical: 1 },
    ];
    for (const controls of moves) {
      for (const unused of Array.from({ length: 40 })) {
        void unused;
        stepSimulation(state, controls, STEP);
        for (const alpha of [0, 0.5, 1]) {
          poseSwimmer(view, player, 0, true, alpha);
          const name = hand === "right" ? "pawR" : "pawL";
          const paw = view.bones.get(name);
          const socket = view.pawSockets.get(name);
          if (!paw || !socket) throw new Error("Holding paw missing");
          const arm = view.bones.get(hand === "right" ? "armR" : "armL");
          if (!arm) throw new Error("Arm missing");
          expect(
            arm
              .getWorldPosition(new Vector3())
              .distanceTo(paw.getWorldPosition(new Vector3())),
          ).toBeLessThanOrEqual(0.130001);
          expect(
            paw
              .localToWorld(socket.clone())
              .distanceTo(view.stick.localToWorld(STICK_GRIP.clone())),
          ).toBeLessThan(0.00001);
        }
      }
    }
    poseSwimmer(view, player, 0, true, 1, false);
    const grip = view.stick.localToWorld(STICK_GRIP.clone());
    const meshDistance = { minimum: Infinity };
    view.model.traverse((object: Object3D): void => {
      if (!(object instanceof SkinnedMesh) || !object.visible) return;
      object.skeleton.update();
      for (const index of Array.from(
        { length: object.geometry.getAttribute("position").count },
        (_unused, value): number => value,
      )) {
        const vertex = object.getVertexPosition(index, new Vector3());
        meshDistance.minimum = Math.min(
          meshDistance.minimum,
          object.localToWorld(vertex).distanceTo(grip),
        );
      }
    });
    expect(meshDistance.minimum).toBeLessThan(0.06);
  }
});

test("only the first-person stick and paw hide above playing depth and return on the bottom", (): void => {
  const { view, state } = setup();
  const player = state.players.at(0);
  if (!player) throw new Error("Otter missing");
  for (const hand of ["right", "left"] as const) {
    setPlayerHandedness(state, hand);
    for (const height of [0.36, 0.8, 1.5, 2.17, 0.36]) {
      player.position.y = height;
      player.bodyPitch = 0;
      player.mode = "playing";
      poseSwimmer(view, player, 0, true);
      expect(view.stick.visible).toBe(height === 0.36);
      const visible = { count: 0 };
      view.model.traverse((object: Object3D): void => {
        if (object instanceof Mesh && object.visible) visible.count += 1;
      });
      if (height === 0.36) expect(visible.count).toBeGreaterThan(0);
      else expect(visible.count).toBe(0);
      poseSwimmer(view, player, 0, true, 1, false);
      expect(view.stick.visible).toBe(true);
      player.human = false;
      poseSwimmer(view, player, 0, true);
      expect(view.stick.visible).toBe(true);
      player.human = true;
    }
  }
});
