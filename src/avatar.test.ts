import { expect, test } from "bun:test";
import { Box3, Scene, SkinnedMesh, Vector3 } from "three";
import { createAvatar, poseAvatar } from "./avatar";
import { createSimulation, stepSimulation } from "./simulation";
import { STICK_GRIP } from "./stick";
import {
  loadCharacterModel,
  loadFirstPersonModel,
} from "./test-support/assets";
import { freshControls, STEP } from "./types";
import { createSwimmerView, poseSwimmer } from "./world";

test("both authored species grip the physical stick with continuous shoulders and clear the tiles", async (): Promise<void> => {
  const proxy = await loadFirstPersonModel();
  for (const species of ["otter", "beaver"] as const) {
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
