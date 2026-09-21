import { expect, test } from "bun:test";
import { Box3, Mesh, Ray, Scene, SkinnedMesh, Triangle, Vector3 } from "three";
import { createAvatar, poseAvatar } from "./avatar";
import { CHARACTER_SPECIES } from "./characters";
import { createSimulation, stepSimulation } from "./simulation";
import { STICK_GRIP } from "./stick";
import {
  loadCharacterModel,
  loadFirstPersonModel,
} from "./test-support/assets";
import { freshControls, STEP } from "./types";
import { createSwimmerView, poseSwimmer } from "./world";

test("character exports retain equipment for either stick hand", async (): Promise<void> => {
  for (const species of CHARACTER_SPECIES) {
    const asset = await loadCharacterModel(species);
    for (const side of ["L", "R"]) {
      for (const part of ["Cuff", "Mitten"]) {
        const equipment = asset.scene.getObjectByName(`GripPaw${side}${part}`);
        expect(equipment).toBeInstanceOf(SkinnedMesh);
      }
    }
  }
});

test("walrus tusks stay outside the working mitten and stick", async (): Promise<void> => {
  const asset = await loadCharacterModel("walrus");
  const proxy = await loadFirstPersonModel();
  for (const hand of ["left", "right"] as const) {
    const avatar = createAvatar(asset.scene, asset.animations);
    const view = createSwimmerView(proxy.scene, 0, new Scene());
    view.avatar = avatar;
    const state = createSimulation("2-3-1", "2-3-1", "playground", 180, hand);
    const player = state.players[0];
    if (!player) throw new Error("Player missing");
    const ivory: SkinnedMesh[] = [];
    avatar.model.traverse((object): void => {
      if (
        object instanceof SkinnedMesh &&
        !Array.isArray(object.material) &&
        object.material.name === "Ivory"
      )
        ivory.push(object);
    });
    expect(ivory.length).toBeGreaterThan(0);
    const mitten = avatar.model.getObjectByName(
      `GripPaw${hand === "right" ? "R" : "L"}Mitten`,
    );
    if (!(mitten instanceof Mesh)) throw new Error("Mitten missing");
    for (const controls of [
      freshControls(),
      { ...freshControls(), forward: 1 },
      { ...freshControls(), forward: 1, vertical: -1 },
      { ...freshControls(), curl: 1 },
      { ...freshControls(), curl: -1 },
    ]) {
      if (controls.vertical < 0) {
        player.position.y = 1.3;
        player.previous.copy(player.position);
      }
      for (let frame = 0; frame < 240; frame++) {
        stepSimulation(state, controls, STEP);
        poseSwimmer(view, player, state.time, true);
        avatar.root.updateMatrixWorld(true);
        for (const obstacle of [mitten, view.stick]) {
          const geometry = obstacle.geometry;
          const count =
            geometry.index?.count ?? geometry.getAttribute("position").count;
          const triangles: Triangle[] = [];
          const bounds = new Box3();
          for (let index = 0; index < count; index += 3) {
            const points = [0, 1, 2].map((corner): Vector3 => {
              const vertex =
                geometry.index?.getX(index + corner) ?? index + corner;
              const point = obstacle
                .getVertexPosition(vertex, new Vector3())
                .applyMatrix4(obstacle.matrixWorld);
              bounds.expandByPoint(point);
              return point;
            });
            triangles.push(new Triangle(points[0], points[1], points[2]));
          }
          const ray = new Ray(
            new Vector3(),
            new Vector3(1, 0.137, 0.319).normalize(),
          );
          const hit = new Vector3();
          for (const mesh of ivory) {
            for (
              let index = 0;
              index < mesh.geometry.getAttribute("position").count;
              index++
            ) {
              mesh
                .getVertexPosition(index, ray.origin)
                .applyMatrix4(mesh.matrixWorld);
              if (!bounds.containsPoint(ray.origin)) continue;
              const crossings = triangles.filter(
                (triangle): boolean =>
                  ray.intersectTriangle(
                    triangle.a,
                    triangle.b,
                    triangle.c,
                    false,
                    hit,
                  ) !== null,
              ).length;
              expect(
                crossings % 2,
                `${hand} ivory vertex ${index} intersects ${obstacle.name || "stick"} at ${state.time}: ${obstacle.worldToLocal(ray.origin.clone()).toArray()}`,
              ).toBe(0);
            }
          }
        }
      }
    }
  }
}, 10_000);

test("head skin cannot be pulled by either arm", async (): Promise<void> => {
  for (const species of CHARACTER_SPECIES) {
    const asset = await loadCharacterModel(species);
    let headVertices = 0;
    asset.scene.traverse((object): void => {
      if (!(object instanceof SkinnedMesh)) return;
      const indices = object.geometry.getAttribute("skinIndex");
      const weights = object.geometry.getAttribute("skinWeight");
      for (let vertex = 0; vertex < indices.count; vertex++) {
        let headWeight = 0;
        let armWeight = 0;
        for (let component = 0; component < 4; component++) {
          const bone =
            object.skeleton.bones[indices.getComponent(vertex, component)];
          const weight = weights.getComponent(vertex, component);
          if (bone?.name === "head") headWeight += weight;
          if (/^(arm|forearm|paw)[._]?[LR]$/.test(bone?.name ?? ""))
            armWeight += weight;
        }
        if (headWeight > 0.01) {
          headVertices++;
          expect(armWeight).toBeLessThan(0.01);
        }
      }
    });
    expect(headVertices).toBeGreaterThan(0);
  }
});

test("the free paw stays forward of its shoulder during swimming", async (): Promise<void> => {
  const proxy = await loadFirstPersonModel();
  for (const species of CHARACTER_SPECIES) {
    const asset = await loadCharacterModel(species);
    for (const hand of ["left", "right"] as const) {
      const avatar = createAvatar(asset.scene, asset.animations);
      const view = createSwimmerView(proxy.scene, 0, new Scene());
      const state = createSimulation("2-3-1", "2-3-1", "playground", 180, hand);
      const player = state.players[0];
      const freeArm = avatar.arms.get(hand === "right" ? "L" : "R");
      if (!player || !freeArm) throw new Error("Missing swimmer arm");
      player.position.y = 1.5;
      player.previous.copy(player.position);
      for (let frame = 0; frame < 120; frame++) {
        stepSimulation(state, { ...freshControls(), forward: 1 }, STEP);
        poseSwimmer(view, player, state.time, true);
        poseAvatar(avatar, player, view.stick, state.time, 1);
        const shoulder = avatar.model.worldToLocal(
          freeArm.upper.getWorldPosition(new Vector3()),
        );
        const paw = avatar.model.worldToLocal(
          freeArm.paw.getWorldPosition(new Vector3()),
        );
        expect(paw.z).toBeLessThan(shoulder.z - 0.03);
        expect(paw.distanceTo(shoulder)).toBeLessThan(0.2);
      }
    }
  }
});

test("characters retain stick grip, shoulder origins and floor clearance", async (): Promise<void> => {
  const proxy = await loadFirstPersonModel();
  for (const species of CHARACTER_SPECIES) {
    const asset = await loadCharacterModel(species);
    for (const hand of ["left", "right"] as const) {
      const avatar = createAvatar(asset.scene, asset.animations);
      const view = createSwimmerView(proxy.scene, 0, new Scene());
      const state = createSimulation("2-3-1", "2-3-1", "playground", 180, hand);
      const player = state.players.at(0);
      if (!player) throw new Error("Player missing");
      const arm = avatar.arms.get(hand === "right" ? "R" : "L");
      if (!arm) throw new Error("Arm missing");
      const shoulder = arm.upper.position.clone();
      for (const controls of [
        freshControls(),
        { ...freshControls(), forward: 1 },
        { ...freshControls(), forward: 1, vertical: 1 },
        { ...freshControls(), forward: 1, vertical: -1 },
        { ...freshControls(), forward: 1, sprint: true },
        { ...freshControls(), curl: 1 },
        { ...freshControls(), curl: -1 },
        { ...freshControls(), dummy: 1 },
      ]) {
        for (const frame of Array.from(
          { length: 60 },
          (_, index): number => index,
        )) {
          stepSimulation(state, controls, STEP);
          poseSwimmer(view, player, state.time, true);
          poseAvatar(avatar, player, view.stick, state.time, 1);
          const target = view.stick
            .localToWorld(STICK_GRIP.clone())
            .add(
              new Vector3(0, 0.03, 0).applyQuaternion(view.stick.quaternion),
            );
          expect(
            arm.paw.getWorldPosition(new Vector3()).distanceTo(target),
          ).toBeLessThan(0.003);
          expect(arm.upper.position.distanceTo(shoulder)).toBeLessThan(0.00001);
          expect(arm.upper.scale.x).toBeCloseTo(1, 5);
          expect(arm.upper.scale.z).toBeCloseTo(1, 5);
          expect(arm.upper.scale.y).toBeGreaterThanOrEqual(1);
          expect(arm.upper.scale.y).toBeLessThan(3.1);
          if (Number.isFinite(avatar.maxArmStretch) && player.position.y > 0.8)
            expect(arm.upper.scale.y).toBeLessThan(avatar.maxArmStretch + 0.01);
          expect(arm.lower.position.distanceTo(arm.lowerPosition)).toBeLessThan(
            0.00001,
          );
          if (frame % 20 === 0)
            avatar.model.traverse((object): void => {
              if (!(object instanceof SkinnedMesh) || !object.visible) return;
              object.skeleton.update();
              expect(
                new Box3().setFromObject(object, true).min.y,
              ).toBeGreaterThan(-0.003);
            });
        }
      }
      const swim = avatar.motion.actions.get("Swim"),
        sprint = avatar.motion.actions.get("Sprint");
      if (!swim || !sprint) throw new Error("Swimming clips missing");
      expect(swim.time / swim.getClip().duration).toBeCloseTo(
        sprint.time / sprint.getClip().duration,
        5,
      );
    }
  }
});

test("skipping the hidden legacy rig preserves the authored swimmer and stick pose", async (): Promise<void> => {
  const proxy = await loadFirstPersonModel();
  const asset = await loadCharacterModel("otter");
  const scene = new Scene();
  const baseline = createSwimmerView(proxy.scene, 0, scene);
  const optimized = createSwimmerView(proxy.scene, 0, scene);
  const referenceAvatar = createAvatar(asset.scene, asset.animations);
  const avatar = createAvatar(asset.scene, asset.animations);
  optimized.avatar = avatar;
  const state = createSimulation("2-3-1", "2-3-1", "playground");
  const player = state.players.at(0);
  if (!player) throw new Error("Player missing");
  const legacyFoot = optimized.bones.get("footL");
  const rest = legacyFoot?.quaternion.clone();
  for (const frame of Array.from({ length: 30 }, (_, index): number => index)) {
    stepSimulation(
      state,
      { ...freshControls(), forward: 1, sprint: frame > 15, yawDelta: 0.015 },
      STEP,
    );
    poseSwimmer(baseline, player, state.time, true, 0.5, false);
    poseAvatar(referenceAvatar, player, baseline.stick, state.time, 0.5);
    poseSwimmer(optimized, player, state.time, true, 0.5, false);
    expect(
      optimized.stick.position.distanceTo(baseline.stick.position),
    ).toBeLessThan(0.000001);
    for (const [name, bone] of avatar.bones) {
      const reference = referenceAvatar.bones.get(name);
      if (!reference) throw new Error("Reference bone missing");
      expect(
        bone
          .getWorldPosition(new Vector3())
          .distanceTo(reference.getWorldPosition(new Vector3())),
      ).toBeLessThan(0.000001);
    }
  }
  expect(optimized.root.visible).toBe(false);
  expect(avatar.root.visible).toBe(true);
  expect(legacyFoot?.quaternion.equals(rest ?? legacyFoot.quaternion)).toBe(
    true,
  );
});
