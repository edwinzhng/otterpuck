import { expect, test } from "bun:test";
import { Scene, SkinnedMesh, Vector3 } from "three";
import { createAvatar } from "./avatar";
import { CHARACTER_SPECIES } from "./characters";
import { keepFinsAboveFloor } from "./fin-clearance";
import { createSimulation, stepSimulation } from "./simulation";
import {
  loadCharacterModel,
  loadFirstPersonModel,
} from "./test-support/assets";
import { freshControls, STEP } from "./types";
import { createSwimmerView, poseSwimmer } from "./world";

test.each([...CHARACTER_SPECIES])(
  "%s deformed fins and body stay above the tiles throughout kicks, turns, braking and landing",
  async (species): Promise<void> => {
    const proxy = await loadFirstPersonModel();
    const asset = await loadCharacterModel(species);
    for (const mode of [
      "idle",
      "swim",
      "sprint",
      "left",
      "right",
      "brake",
      "land",
    ]) {
      const view = createSwimmerView(proxy.scene, 0, new Scene());
      const avatar = createAvatar(asset.scene, asset.animations);
      view.avatar = avatar;
      const state = createSimulation("2-3-1", "2-3-1", "playground");
      const player = state.players.at(0);
      if (!player) throw new Error("Player missing");
      if (mode === "land") player.position.y = 0.85;
      player.previous.copy(player.position);
      const surfaces: { mesh: SkinnedMesh; indices: number[] }[] = [];
      avatar.model.traverse((mesh): void => {
        if (mesh instanceof SkinnedMesh && !mesh.name.startsWith("FirstPerson"))
          surfaces.push({
            mesh,
            indices: Array.from(
              { length: mesh.geometry.getAttribute("position").count },
              (_, index): number => index,
            ),
          });
      });
      const point = new Vector3();
      const localTip = new Vector3();
      const previousTip = new Vector3();
      const heights: number[] = [];
      const tip = avatar.bones.get("finTipL");
      if (!tip) throw new Error("Fin missing");
      for (const frame of Array.from(
        { length: 420 },
        (_, index): number => index,
      )) {
        stepSimulation(
          state,
          {
            ...freshControls(),
            forward:
              mode === "idle" ? 0 : mode === "brake" && frame > 160 ? -1 : 1,
            sprint: mode === "sprint" || (mode === "brake" && frame <= 160),
            yawDelta:
              mode === "left" ? STEP * 2 : mode === "right" ? -STEP * 2 : 0,
            vertical: mode === "land" ? -1 : 0,
          },
          STEP,
        );
        const position = player.position.clone();
        poseSwimmer(view, player, state.time, true, 0.5, false);
        avatar.root.updateMatrixWorld(true);
        expect(player.position.equals(position)).toBe(true);
        tip.getWorldPosition(localTip);
        heights.push(localTip.y);
        avatar.root.worldToLocal(localTip);
        if (frame > 0)
          expect(
            localTip.distanceTo(previousTip),
            `${species} ${mode} frame ${frame}`,
          ).toBeLessThan(0.025);
        previousTip.copy(localTip);
        if (frame % 8 !== 0) continue;
        for (const { mesh, indices } of surfaces) {
          if (!mesh.visible) continue;
          const minimum = indices.reduce((minimum, index): number => {
            mesh.getVertexPosition(index, point).applyMatrix4(mesh.matrixWorld);
            return Math.min(minimum, point.y);
          }, Infinity);
          expect(
            minimum,
            `${species} ${mode} ${mesh.name} at ${state.time}`,
          ).toBeGreaterThan(0);
        }
      }
      if (mode === "swim" || mode === "sprint")
        expect(
          Math.max(...heights.slice(120)) - Math.min(...heights.slice(120)),
        ).toBeGreaterThan(0.04);
    }
  },
  10_000,
);

test("floor avoidance leaves open-water leg animations unchanged", async (): Promise<void> => {
  const asset = await loadCharacterModel("otter");
  const avatar = createAvatar(asset.scene, asset.animations);
  expect(avatar.finClearance.length).toBe(2);
  for (const leg of avatar.finClearance) expect(leg.bounds.length).toBe(4);
  for (const action of avatar.motion.actions.values()) {
    for (const other of avatar.motion.actions.values())
      other.setEffectiveWeight(other === action ? 1 : 0);
    for (const phase of [0, 0.2, 0.4, 0.6, 0.8]) {
      action.time = action.getClip().duration * phase;
      avatar.motion.mixer.update(0);
      avatar.root.position.y = 1.3;
      avatar.root.updateMatrixWorld(true);
      const before = avatar.finClearance.map(({ thigh }): number[] =>
        thigh.quaternion.toArray(),
      );
      keepFinsAboveFloor(avatar.finClearance, 0);
      expect(
        avatar.finClearance.map(({ thigh }): number[] =>
          thigh.quaternion.toArray(),
        ),
      ).toEqual(before);
    }
  }
});
