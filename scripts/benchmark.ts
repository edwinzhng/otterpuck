import { createSimulation, stepSimulation } from "../src/simulation";
import { freshControls, STEP } from "../src/types";

const state = createSimulation("3-3", "2-3-1", "match", 3600);
const controls = freshControls();
const timings = Array.from({ length: 21600 }, (): number => {
  const start = performance.now();
  stepSimulation(state, controls, STEP);
  return performance.now() - start;
}).sort((a: number, b: number): number => a - b);
const total = timings.reduce(
  (sum: number, value: number): number => sum + value,
  0,
);
console.info(
  JSON.stringify(
    {
      simulatedSeconds: 180,
      totalMilliseconds: Math.round(total),
      meanStepMilliseconds: Number((total / timings.length).toFixed(4)),
      p95StepMilliseconds: Number(
        timings.at(Math.floor(timings.length * 0.95))?.toFixed(4),
      ),
      p99StepMilliseconds: Number(
        timings.at(Math.floor(timings.length * 0.99))?.toFixed(4),
      ),
      score: state.scores,
      contacts: state.contacts,
      shots: state.shots,
      players: state.players.map((player): object => ({
        id: player.id,
        mode: player.mode,
        air: Math.round(player.air),
        position: player.position
          .toArray()
          .map((value: number): number => Number(value.toFixed(2))),
      })),
    },
    undefined,
    2,
  ),
);
