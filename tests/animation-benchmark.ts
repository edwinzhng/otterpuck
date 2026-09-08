import { Scene } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createAvatar, poseAvatar } from "../src/avatar";
import { createSimulation, stepSimulation } from "../src/simulation";
import { freshControls, STEP } from "../src/types";
import { createSwimmerView, poseSwimmer } from "../src/world";

const loader = new GLTFLoader();
const proxy = await loader.parseAsync(
  await Bun.file("public/models/otter-paws.glb").arrayBuffer(),
  "",
);
const assets = await Promise.all(
  ["otter", "beaver"].map(async (species) =>
    loader.parseAsync(
      await Bun.file(`public/models/characters/${species}.glb`).arrayBuffer(),
      "",
    ),
  ),
);
const run = (optimized: boolean): number => {
  const state = createSimulation();
  const scene = new Scene();
  const actors = state.players.map((player) => {
    const asset = assets.at(player.team);
    if (!asset) throw new Error("Character asset missing");
    const view = createSwimmerView(proxy.scene, player.id, scene);
    const avatar = createAvatar(asset.scene, asset.animations);
    if (optimized) view.avatar = avatar;
    return { view, avatar, player };
  });
  const samples = Array.from({ length: 660 }, (_, frame): number => {
    stepSimulation(state, freshControls(), STEP);
    const start = performance.now();
    for (const { view, avatar, player } of actors) {
      poseSwimmer(view, player, state.time, true, 1, false);
      if (!optimized) poseAvatar(avatar, player, view.stick, state.time, 1);
    }
    return frame < 60 ? 0 : performance.now() - start;
  }).slice(60);
  return (
    samples.reduce((sum, elapsed): number => sum + elapsed, 0) / samples.length
  );
};
const trials = Array.from({ length: 4 }, (_, index) => {
  const order = index % 2 === 0 ? [false, true] : [true, false];
  return Object.fromEntries(
    order.map((optimized) => [
      optimized ? "optimized" : "baseline",
      run(optimized),
    ]),
  );
});
const average = (key: string): number =>
  trials.reduce((sum, trial): number => sum + (trial[key] ?? 0), 0) /
  trials.length;
const baseline = average("baseline"),
  optimized = average("optimized");
const result = {
  scope:
    "CPU posing of twelve third-person characters; excludes renderer and GPU",
  framesPerTrial: 600,
  trials,
  baselineMs: baseline,
  optimizedMs: optimized,
  reductionPercent: (1 - optimized / baseline) * 100,
};
await Bun.write(
  "art/arenas/animation-performance.json",
  JSON.stringify(result, undefined, 2),
);
console.log(JSON.stringify(result, undefined, 2));
