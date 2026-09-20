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
  // can exceed the per-step turn limit and discard movement.
  const turning = new Map<
    number,
    { sequence: number; yaw: number; seconds: number }
  >();
  let accumulator = 0;
  let sinceSnapshot = 0;
  const acknowledged: Record<string, number> = {};
  // Acknowledge an input only after the room applies all its yaw. An earlier
  // acknowledgement removes the input from client prediction and rocks the view.
  const settle = (id: number): void => {
    const pending = turning.get(id);
    if (pending) acknowledged[id] = pending.sequence;
    turning.delete(id);
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
      // Use the client interval, or the time since its previous input. Carry
      // unused yaw forward, but limit the backlog to prevent stale turning.
      const pending = turning.get(id);
      const window = Math.max(
        duration ?? (previous ? initial.time - previous.time : STEP),
        STEP,
      );
      const carried = pending ?? { yaw: 0, seconds: 0 };
      settle(id);
      turning.set(id, {
        sequence,
        yaw: Math.max(-4, Math.min(4, carried.yaw + controls.yawDelta)),
        seconds: Math.min(carried.seconds + window, 0.1),
      });
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
            settle(id);
            continue;
          }
          const pending = turning.get(id);
          if (!pending || pending.seconds <= 0) {
            controls.yawDelta = 0;
            continue;
          }
          const spent = Math.min(STEP, pending.seconds);
          const share = (pending.yaw * spent) / pending.seconds;
          controls.yawDelta = share;
          pending.yaw -= share;
          pending.seconds -= spent;
          if (pending.seconds <= 0) settle(id);
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
