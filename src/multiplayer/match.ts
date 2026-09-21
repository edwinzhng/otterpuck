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
const MAX_TURN_BACKLOG = 0.1;

// Send one snapshot for each 60 Hz room step. Lower rates make reconciliation
// corrections visible during turns. Compression keeps this rate practical.
const SNAPSHOT_HZ = 60;
export const createRoomSimulation = (settings: {
  teamSize: TeamSize;
  swimTurn: number;
  difficulty: BotDifficulty;
  teamSpecies?: RoomView["teamSpecies"];
}): Simulation => {
  const formation = defaultFormation(settings.teamSize);
  const state = createSimulation(formation, formation, "match", 180, "right", {
    species: "otter",
    position: 0,
    difficulty: settings.difficulty,
    swimTurn: settings.swimTurn,
  });
  const species = settings.teamSpecies ?? ["otter", "beaver"];
  for (const player of state.players) player.species = species[player.team];
  return state;
};
export const createNetworkMatch = (
  initial = createRoomSimulation({
    teamSize: 6,
    swimTurn: 1,
    difficulty: "medium",
  }),
): {
  state: Simulation;
  acknowledged: Record<string, number>;
  roster: (
    members: RoomView["members"],
    teamSpecies?: RoomView["teamSpecies"],
  ) => void;
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
  const turns = new Map<number, Turn[]>();
  let accumulator = 0;
  let sinceSnapshot = 0;
  const acknowledged: Record<string, number> = {};
  const acknowledge = (id: number, sequence: number): void => {
    acknowledged[id] = sequence;
  };
  const clearTurns = (id: number): void => {
    const queue = turns.get(id);
    const last = queue?.at(-1);
    if (last) acknowledge(id, last.sequence);
    turns.delete(id);
  };
  const takeTurn = (id: number, seconds: number): number => {
    const queue = turns.get(id);
    if (!queue) return 0;
    let remaining = seconds;
    let yaw = 0;
    while (remaining > 0) {
      const head = queue[0];
      if (!head) break;
      const spent = Math.min(remaining, head.seconds);
      const applied =
        head.seconds > 0 ? (head.yaw * spent) / head.seconds : head.yaw;
      yaw += applied;
      head.yaw -= applied;
      head.seconds -= spent;
      remaining -= spent;
      if (head.seconds > 1e-9) break;
      acknowledge(id, head.sequence);
      queue.shift();
    }
    if (queue.length === 0) turns.delete(id);
    return yaw;
  };
  const match = {
    state: initial,
    acknowledged,
    alpha: (): number => accumulator / STEP,
    roster: (
      members: RoomView["members"],
      teamSpecies?: RoomView["teamSpecies"],
    ): void => {
      for (const player of initial.players) {
        const owner = members.find((m) => m.playerId === player.id);
        const member = owner?.connected ? owner : undefined;
        if (teamSpecies) player.species = teamSpecies[player.team];
        player.human = Boolean(member);
        if (member)
          setPlayerHandedness(initial, member.handedness ?? "right", player.id);
        if (member && !inputs.has(player.id))
          inputs.set(player.id, freshControls());
        if (!member) {
          inputs.delete(player.id);
          received.delete(player.id);
          turns.delete(player.id);
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
      const window = Math.max(
        duration ?? (previous ? initial.time - previous.time : STEP),
        STEP,
      );
      const queue = turns.get(id) ?? [];
      queue.push({
        sequence,
        yaw: Math.max(-4, Math.min(4, controls.yawDelta)),
        seconds: window,
      });
      const backlog = queue.reduce((sum, turn) => sum + turn.seconds, 0);
      if (backlog > MAX_TURN_BACKLOG) {
        const scale = MAX_TURN_BACKLOG / backlog;
        for (const turn of queue) turn.seconds *= scale;
      }
      turns.set(id, queue);
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
            clearTurns(id);
            continue;
          }
          controls.yawDelta = takeTurn(id, STEP);
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
