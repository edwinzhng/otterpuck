import { defaultFormation } from "../positions";
import {
  createSimulation,
  setPlayerHandedness,
  stepSimulation,
} from "../simulation";
import {
  type BotDifficulty,
  type Controls,
  freshControls,
  type Simulation,
  STEP,
  type TeamSize,
} from "../types";
import type { RoomView } from "./protocol";

type Turn = { sequence: number; yaw: number; seconds: number };

// Send one snapshot for each 60 Hz room step. Lower rates make reconciliation
// corrections visible during turns. Compression keeps this rate practical.
const SNAPSHOT_HZ = 60;
export const createRoomSimulation = (settings: {
  teamSize: TeamSize;
  swimTurn: number;
  difficulty: BotDifficulty;
}): Simulation => {
  const formation = defaultFormation(settings.teamSize);
  return createSimulation(formation, formation, "match", 180, "right", {
    species: "otter",
    position: 0,
    difficulty: settings.difficulty,
    swimTurn: settings.swimTurn,
  });
};
export const createNetworkMatch = (
  initial = createRoomSimulation({
    teamSize: 6,
    swimTurn: 3,
    difficulty: "medium",
  }),
): {
  state: Simulation;
  acknowledged: Record<string, number>;
  roster: (members: RoomView["members"]) => void;
  input: (
    id: number,
    sequence: number,
    controls: Controls,
    duration?: number,
  ) => void;
  advance: (seconds: number) => boolean;
  alpha: () => number;
} => {
  const inputs = new Map<number, Controls>();
  const received = new Map<number, { sequence: number; time: number }>();
  // Apply yaw across its reported interval. Applying all yaw in one room step
  // can exceed the per-step turn limit and discard movement. Each input keeps
  // its own entry so the acknowledgement can name the yaw the room has spent.
  const turning = new Map<number, Turn[]>();
  // A queued backlog is latency: the room is still turning the player after
  // they stopped. Bound it so a stalled client cannot bank a long turn.
  const MAX_BACKLOG = 0.1;
  let accumulator = 0;
  let sinceSnapshot = 0;
  const acknowledged: Record<string, number> = {};
  // Acknowledge an input only once the room has spent all of its yaw. A later
  // acknowledgement makes the client replay yaw the room already applied, and
  // an earlier one drops yaw the room has not applied yet. Either way the view
  // carries the error until the turn ends and then snaps back.
  const settle = (id: number, sequence: number): void => {
    acknowledged[id] = Math.max(acknowledged[id] ?? -1, sequence);
  };
  const discard = (id: number): void => {
    const queue = turning.get(id);
    const last = queue?.at(-1);
    if (last) settle(id, last.sequence);
    turning.delete(id);
  };
  // Spend up to `budget` seconds of queued turning and return the yaw for it.
  const spendTurn = (id: number, budget: number): number => {
    const queue = turning.get(id);
    if (!queue) return 0;
    let remaining = budget;
    let yaw = 0;
    while (queue.length > 0 && remaining > 0) {
      const head = queue[0];
      if (!head) break;
      const spent = Math.min(remaining, head.seconds);
      const share =
        head.seconds > 0 ? (head.yaw * spent) / head.seconds : head.yaw;
      yaw += share;
      head.yaw -= share;
      head.seconds -= spent;
      remaining -= spent;
      if (head.seconds > 1e-9) break;
      settle(id, head.sequence);
      queue.shift();
    }
    if (queue.length === 0) turning.delete(id);
    return yaw;
  };
  const match = {
    state: initial,
    acknowledged,
    alpha: (): number => accumulator / STEP,
    roster: (members: RoomView["members"]): void => {
      for (const player of initial.players) {
        const member = members.find(
          (m) => m.playerId === player.id && m.connected,
        );
        player.human = Boolean(member);
        if (member)
          setPlayerHandedness(initial, member.handedness ?? "right", player.id);
        if (member && !inputs.has(player.id))
          inputs.set(player.id, freshControls());
        if (!member) {
          inputs.delete(player.id);
          received.delete(player.id);
          turning.delete(player.id);
          delete acknowledged[player.id];
        }
      }
    },
    input: (
      id: number,
      sequence: number,
      controls: Controls,
      duration?: number,
    ): void => {
      const current = inputs.get(id);
      if (!current || sequence <= (received.get(id)?.sequence ?? -1)) return;
      const previous = received.get(id);
      // Use the client interval, or the time since its previous input. Queue it
      // behind any yaw still owed so each input keeps its own acknowledgement.
      const window = Math.max(
        duration ?? (previous ? initial.time - previous.time : STEP),
        STEP,
      );
      const queue = turning.get(id) ?? [];
      queue.push({
        sequence,
        yaw: Math.max(-4, Math.min(4, controls.yawDelta)),
        seconds: window,
      });
      // Compress the backlog rather than trimming it, so the queued yaw still
      // reaches the player and the oldest input still settles first.
      const backlog = queue.reduce((sum, turn) => sum + turn.seconds, 0);
      if (backlog > MAX_BACKLOG) {
        const scale = MAX_BACKLOG / backlog;
        for (const turn of queue) turn.seconds *= scale;
      }
      turning.set(id, queue);
      const shot = Math.max(current.shot, controls.shot);
      const dive = current.dive || controls.dive;
      const knockdown = current.knockdown || controls.knockdown;
      Object.assign(current, controls, {
        yawDelta: 0,
        shot,
        dive,
        knockdown,
      });
      received.set(id, { sequence, time: initial.time });
    },
    advance: (seconds: number): boolean => {
      if (initial.finished) return false;
      accumulator += Math.min(Math.max(seconds, 0), 0.1);
      while (accumulator >= STEP) {
        for (const [id, controls] of inputs) {
          if (initial.time - (received.get(id)?.time ?? -1) > 0.5) {
            Object.assign(controls, freshControls());
            discard(id);
            continue;
          }
          controls.yawDelta = spendTurn(id, STEP);
        }
        stepSimulation(initial, inputs, STEP);
        accumulator -= STEP;
        sinceSnapshot += STEP;
        if (initial.finished) {
          accumulator = 0;
          return true;
        }
      }
      if (sinceSnapshot < 1 / SNAPSHOT_HZ) return false;
      sinceSnapshot %= 1 / SNAPSHOT_HZ;
      return true;
    },
  };
  return match;
};
export type NetworkMatch = ReturnType<typeof createNetworkMatch>;
