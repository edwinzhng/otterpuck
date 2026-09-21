import { expect, test } from "bun:test";
import { Mesh, PerspectiveCamera, Scene, SkinnedMesh, Vector3 } from "three";
import { createAvatar } from "./avatar";
import { CHARACTER_SPECIES } from "./characters";
import { updateFirstPersonArms } from "./first-person-arms";
import { createSimulation, stepSimulation } from "./simulation";
import { STICK_GRIP } from "./stick";
import {
  loadCharacterModel,
  loadFirstPersonModel,
} from "./test-support/assets";
import { CAMERA_OFFSET, freshControls, STEP, STICK_EDGE } from "./types";
import { createSwimmerView, poseSwimmer } from "./world";

test("the flat playing pose extends a continuous arm forward while keeping the physical stick and camera framing", async (): Promise<void> => {
  const proxy = await loadFirstPersonModel();
  for (const species of ["otter", "beaver"] as const) {
    const asset = await loadCharacterModel(species);
    for (const hand of ["right", "left"] as const) {
      const scene = new Scene();
      const view = createSwimmerView(proxy.scene, 0, scene);
      const avatar = createAvatar(asset.scene, asset.animations);
      view.avatar = avatar;
      scene.add(avatar.root);
      const state = createSimulation("2-3-1", "2-3-1", "playground", 180, hand);
      const player = state.players.at(0);
      const side = hand === "right" ? "R" : "L";
      const arm = avatar.arms.get(side);
      if (!player || !arm) throw new Error("Missing playing rig");
      for (const unused of Array.from({ length: 90 })) {
        void unused;
        stepSimulation(state, freshControls(), STEP);
        poseSwimmer(view, player, state.time, true, 1, false);
      }
      const before = player.position.clone();
      const shoulder = arm.upper.getWorldPosition(new Vector3());
      const paw = arm.paw.getWorldPosition(new Vector3());
      expect(avatar.model.rotation.x).toBeCloseTo(0, 7);
      expect(avatar.root.position.y).toBeLessThan(0.15);
      expect(
        Math.hypot(
          avatar.root.position.x - player.position.x,
          avatar.root.position.z - player.position.z,
        ),
      ).toBeLessThan(0.04);
      expect(shoulder.z - paw.z).toBeGreaterThan(0.3);
      expect(Math.abs(shoulder.y - paw.y)).toBeLessThan(0.07);
      const chest = avatar.bones.get("chest"),
        pelvis = avatar.bones.get("pelvis");
      if (!chest || !pelvis) throw new Error("Missing torso");
      expect(
        Math.abs(
          chest.getWorldPosition(new Vector3()).y -
            pelvis.getWorldPosition(new Vector3()).y,
        ),
      ).toBeLessThan(0.02);

      poseSwimmer(view, player, state.time, true, 1, true);
      expect(view.root.visible).toBe(false);
      expect(
        arm.paw.getWorldPosition(new Vector3()).distanceTo(paw),
      ).toBeLessThan(0.00001);
      const visible: Mesh[] = [];
      avatar.root.traverseVisible((object): void => {
        if (object instanceof Mesh && object !== view.stick)
          visible.push(object);
      });
      expect(visible.length).toBe(2);
      for (const mesh of visible)
        expect([`FirstPersonArm${side}`, `GripPaw${side}Mitten`]).toContain(
          mesh.name,
        );
      const partial = avatar.firstPersonArms.get(side)?.mesh;
      const mitten = visible.find(
        (mesh): boolean => mesh.name === `GripPaw${side}Mitten`,
      );
      if (!partial || !(mitten instanceof SkinnedMesh))
        throw new Error("Missing authored first-person arm");
      const camera = new PerspectiveCamera(77, 1.5, 0.01, 100);
      camera.position.copy(player.position).add(CAMERA_OFFSET);
      camera.rotation.order = "YXZ";
      camera.rotation.set(-0.5, player.yaw, 0);
      camera.updateMatrixWorld(true);
      for (const point of [
        ...STICK_EDGE.map(
          ([x, z]): Vector3 => view.stick.localToWorld(new Vector3(x, 0, z)),
        ),
        state.puck.position.clone(),
        view.stick.localToWorld(STICK_GRIP.clone()),
      ]) {
        point.project(camera);
        expect(Math.abs(point.x)).toBeLessThan(0.9);
        expect(Math.abs(point.y)).toBeLessThan(0.9);
      }
      expect(player.position.distanceTo(before)).toBe(0);
      player.position.y = 0.9;
      poseSwimmer(view, player, state.time, true, 1, true);
      expect(avatar.root.visible).toBe(false);
      expect(view.stick.visible).toBe(false);
      poseSwimmer(view, player, state.time, true, 1, false);
      expect(avatar.root.visible).toBe(true);
      expect(view.stick.visible).toBe(true);
    }
  }
});

test("every species has an off-camera arm root and a round glove at the unchanged grip", async (): Promise<void> => {
  const proxy = await loadFirstPersonModel();
  for (const species of CHARACTER_SPECIES) {
    const asset = await loadCharacterModel(species);
    for (const handedness of ["left", "right"] as const) {
      const scene = new Scene();
      const view = createSwimmerView(proxy.scene, 0, scene);
      const avatar = createAvatar(asset.scene, asset.animations);
      view.avatar = avatar;
      scene.add(avatar.root);
      const state = createSimulation(
        "2-3-1",
        "2-3-1",
        "playground",
        180,
        handedness,
      );
      const player = state.players[0];
      if (!player) throw new Error("Missing player");
      const side = handedness === "right" ? "R" : "L";
      const arm = avatar.firstPersonArms.get(side);
      const mitten = avatar.model.getObjectByName(`GripPaw${side}Mitten`);
      if (!arm || !(mitten instanceof SkinnedMesh))
        throw new Error(`Missing ${species} arm`);
      for (const pitch of [-1.2, -0.5, 0.3]) {
        poseSwimmer(view, player, state.time, true, 1, true);
        const before = arm.paw.getWorldPosition(new Vector3());
        const camera = new PerspectiveCamera(100, 390 / 844, 0.045, 100);
        camera.position.copy(player.position).add(CAMERA_OFFSET);
        camera.rotation.order = "YXZ";
        camera.rotation.set(pitch, player.yaw, 0);
        updateFirstPersonArms(avatar.firstPersonArms, camera);
        expect(arm.paw.getWorldPosition(new Vector3()).distanceTo(before)).toBe(
          0,
        );
        const positions = arm.mesh.geometry.getAttribute("position");
        for (let i = 0; i < 32; i++) {
          const root = arm.mesh.localToWorld(
            new Vector3().fromBufferAttribute(positions, i),
          );
          expect(camera.worldToLocal(root).z).toBeGreaterThan(0.1);
          const wrist = arm.mesh.localToWorld(
            new Vector3().fromBufferAttribute(
              positions,
              positions.count - 32 + i,
            ),
          );
          const center = arm.paw.localToWorld(arm.grip.clone());
          expect(wrist.distanceTo(center)).toBeCloseTo(0.033, 5);
        }
        expect(arm.mesh.geometry.getIndex()?.count).toBeLessThan(2500);
      }
      const vertices = mitten.geometry.getAttribute("position");
      const center = mitten.geometry.boundingBox?.getCenter(new Vector3());
      if (!center) throw new Error("Missing glove bounds");
      for (let i = 0; i < vertices.count; i++)
        expect(
          new Vector3().fromBufferAttribute(vertices, i).distanceTo(center),
        ).toBeCloseTo(0.04, 3);
    }
  }
});
