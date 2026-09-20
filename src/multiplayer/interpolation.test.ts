import { expect, test } from "bun:test";
import { createSimulation } from "../simulation";
import { createSnapshotInterpolation } from "./interpolation";

const snapshot = (time: number): ReturnType<typeof createSimulation> => {
  const state = createSimulation();
  state.faceoff = undefined;
  state.time = time;
  for (const player of state.players) {
    player.position.x = time;
    player.stick.x = time + 0.3;
    player.bodyPitch = time * 0.1;
  }
  state.puck.position.x = time;
  return state;
};

test("jittered arrivals keep remote motion monotonic and bounded by playback speed", () => {
  const buffer = createSnapshotInterpolation();
  let state = snapshot(1);
  buffer.push(state, 0);
  let previous = 1;
  let packet = 1;
  for (let now = 0; now < 1800; now += 10) {
    const arrival = packet * 50 + (packet % 2 ? -15 : 15);
    if (now >= arrival) {
      state = snapshot(1 + packet * 0.05);
      buffer.push(state, now);
      packet++;
    }
    buffer.render(state, 0, now);
    const remote = state.players.at(1);
    if (!remote) throw new Error("Missing player");
    expect(remote.position.x).toBeGreaterThanOrEqual(previous - 1e-8);
    expect(remote.position.x - previous).toBeLessThanOrEqual(0.012001);
    expect(remote.stick.x - remote.position.x).toBeCloseTo(0.3);
    expect(state.players.at(0)?.position.x).toBe(state.time);
    previous = remote.position.x;
  }
});

test("local carry bypasses the remote buffer and faceoff resets do not blend across the pool", () => {
  const buffer = createSnapshotInterpolation();
  const first = snapshot(1);
  buffer.push(first, 0);
  const next = snapshot(1.05);
  buffer.push(next, 50);
  next.puck.controlOwner = 0;
  next.puck.position.x = 7;
  buffer.render(next, 0, 60);
  expect(next.puck.position.x).toBe(7);
  const reset = snapshot(1.1);
  reset.faceoff = { phase: "ready", remaining: 3 };
  for (const player of reset.players) player.position.x = -5;
  buffer.push(reset, 100);
  buffer.render(reset, 0, 100);
  expect(reset.players.at(1)?.position.x).toBe(-5);
});
