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
  // A message carries the yaw a client accumulated over its own send interval,
  // which is longer than one room tick: the online sender runs at 30Hz against
  // a 60Hz room. Spending that in the tick that happens to receive it would
  // compress the turn into a fraction of the time it was made over, and the
  // per-step cap in the simulation then discards the remainder. Hold it as a
  // rate instead and pay it out across the interval it belongs to.
  const turning = new Map<number, { yaw: number; seconds: number }>();
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
          turning.delete(player.id);
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
      // Clients report the interval they accumulated over; fall back to the gap
      // since their last message. Time left unspent from the previous message
      // carries, so messages arriving faster than the room ticks still pay out
      // in full, and the backlog is capped so neither jitter nor a hostile
      // value can leave a player turning through stale input.
      const pending = turning.get(id);
      const window = Math.max(
        duration ?? (previous ? initial.time - previous.time : STEP),
        STEP,
      );
      turning.set(id, {
        yaw: Math.max(-4, Math.min(4, (pending?.yaw ?? 0) + controls.yawDelta)),
        seconds: Math.min((pending?.seconds ?? 0) + window, 0.25),
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
            turning.delete(id);
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
