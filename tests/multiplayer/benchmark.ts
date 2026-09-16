import { createNetworkMatch } from "../../src/multiplayer/match";
import {
  packSnapshot,
  stringifySnapshot,
} from "../../src/multiplayer/snapshot";

const measure = (compact: boolean): object => {
  const match = createNetworkMatch();
  let bytes = 0;
  let snapshots = 0;
  const cpu = process.cpuUsage();
  const start = performance.now();
  for (let tick = 0; tick < 3600; tick++) {
    if (!match.advance(1 / 60)) continue;
    snapshots++;
    if (compact) {
      const text = stringifySnapshot({
        type: "snapshot",
        state: packSnapshot(match.state),
        acknowledged: match.acknowledged,
      });
      bytes += Buffer.byteLength(text) * 12;
    } else {
      for (let client = 0; client < 12; client++)
        bytes += Buffer.byteLength(
          JSON.stringify({
            type: "snapshot",
            state: match.state,
            acknowledged: match.acknowledged,
          }),
        );
    }
  }
  const used = process.cpuUsage(cpu);
  return {
    mode: compact ? "compact/shared" : "original/per-recipient",
    simulatedSeconds: 60,
    clients: 12,
    snapshots,
    wallMs: Math.round(performance.now() - start),
    cpuMs: Math.round((used.user + used.system) / 1000),
    bytesPerClientSecond: Math.round(bytes / 12 / 60),
    totalMegabytes: Math.round(bytes / 1e4) / 100,
  };
};
console.log(JSON.stringify([measure(false), measure(true)], null, 2));
