import { expect, test } from "bun:test";
import { PerspectiveCamera } from "three";
import { createSimulation } from "./simulation";
import { swimmerInView } from "./world";

test("offscreen swimmers skip posing but keep generous reach bounds at the view edge", () => {
  const player = createSimulation().players[0];
  if (!player) throw new Error("Missing player");
  const camera = new PerspectiveCamera(77, 1.5, 0.045, 800);
  camera.updateMatrixWorld();
  player.position.set(0, 0, -5);
  player.previous.copy(player.position);
  expect(swimmerInView(camera, player, 1)).toBe(true);
  player.position.set(0, 0, 5);
  player.previous.copy(player.position);
  expect(swimmerInView(camera, player, 1)).toBe(false);
  player.position.set(7, 0, -5);
  player.previous.copy(player.position);
  expect(swimmerInView(camera, player, 1)).toBe(true);
  player.position.set(20, 0, -5);
  player.previous.copy(player.position);
  expect(swimmerInView(camera, player, 1)).toBe(false);
  camera.rotation.y = -Math.PI / 2;
  camera.updateMatrixWorld();
  expect(swimmerInView(camera, player, 1)).toBe(true);
  player.previous.set(-20, 0, -5);
  expect(swimmerInView(camera, player, 0)).toBe(false);
});
