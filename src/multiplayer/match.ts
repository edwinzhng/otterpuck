import { defaultFormation } from "../positions";
import {
  createSimulation,
  setPlayerHandedness,
  stepSimulation,
} from "../simulation";
import {
  type Controls,
  freshControls,
  type Simulation,
  STEP,
  type TeamSize,
} from "../types";
import type { RoomView } from "./protocol";
export const createRoomSimulation = (teamSize: TeamSize): Simulation => {
  const formation = defaultFormation(teamSize);
  return createSimulation(formation, formation);
};
export const createNetworkMatch = (
  initial = createRoomSimulation(6),
): {
  state: Simulation;
  acknowledged: Record<string, number>;
  roster: (members: RoomView["members"]) => void;
  input: (id: number, sequence: number, controls: Controls) => void;
  advance: (seconds: number) => boolean;
  alpha: () => number;
} => {
  const inputs = new Map<number, Controls>();
  const received = new Map<number, { sequence: number; time: number }>();
  let accumulator = 0;
  let sinceSnapshot = 0;
  const acknowledged: Record<string, number> = {};
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
        }
      }
    },
    input: (id: number, sequence: number, controls: Controls): void => {
      const current = inputs.get(id);
      if (!current || sequence <= (received.get(id)?.sequence ?? -1)) return;
      const yaw = current.yawDelta + controls.yawDelta;
      const shot = Math.max(current.shot, controls.shot);
      const dive = current.dive || controls.dive;
      const knockdown = current.knockdown || controls.knockdown;
      Object.assign(current, controls, {
        yawDelta: Math.max(-4, Math.min(4, yaw)),
        shot,
        dive,
        knockdown,
      });
      received.set(id, { sequence, time: initial.time });
    },
    advance: (seconds: number): boolean => {
      if (initial.finished) return false;
      accumulator += Math.min(Math.max(seconds, 0), 0.1);
      const steps = Math.floor(accumulator / STEP);
      const yawShares = new Map(
        [...inputs].map(([id, controls]) => [
          id,
          steps > 0 ? controls.yawDelta / steps : 0,
        ]),
      );
      while (accumulator >= STEP) {
        for (const [id, controls] of inputs) {
          if (initial.time - (received.get(id)?.time ?? -1) > 0.5)
            Object.assign(controls, freshControls());
          else controls.yawDelta = yawShares.get(id) ?? 0;
        }
        stepSimulation(initial, inputs, STEP);
        for (const [id, input] of received) acknowledged[id] = input.sequence;
        accumulator -= STEP;
        sinceSnapshot += STEP;
        if (initial.finished) {
          accumulator = 0;
          return true;
        }
      }
      if (sinceSnapshot < 1 / 20) return false;
      sinceSnapshot %= 1 / 20;
      return true;
    },
  };
  return match;
};
export type NetworkMatch = ReturnType<typeof createNetworkMatch>;
