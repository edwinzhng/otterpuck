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

// Snapshots carry the correction that reconciliation applies, so their rate
// sets how coarsely a turn is nudged: at 20Hz the nudge landed on every third
// frame and read as a rocking turn. The room advances at 60Hz, so this is one
// snapshot per advance. They deflate to about a ninth of their size, which is
// what makes the rate affordable.
const SNAPSHOT_HZ = 60;
export const createRoomSimulation = (teamSize: TeamSize): Simulation => {
  const formation = defaultFormation(teamSize);
  return createSimulation(formation, formation);
};
// Spending a message's yaw over the interval it covers is what the room does;
// spending all of it in the tick that receives it is what it did before, kept
// as a switch so a heavy-feeling turn can be compared against both without
// rebuilding the server.
export type YawPayout = "queued" | "instant";
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
  payout: (mode: YawPayout) => void;
  mode: () => YawPayout;
} => {
  const inputs = new Map<number, Controls>();
  const received = new Map<number, { sequence: number; time: number }>();
  // A message carries the yaw a client accumulated over its own send interval,
  // which is longer than one room tick: the online sender runs at 30Hz against
  // a 60Hz room. Spending that in the tick that happens to receive it would
  // compress the turn into a fraction of the time it was made over, and the
  // per-step cap in the simulation then discards the remainder. Hold it as a
  // rate instead and pay it out across the interval it belongs to.
  const turning = new Map<
    number,
    { sequence: number; yaw: number; seconds: number }
  >();
  let accumulator = 0;
  let sinceSnapshot = 0;
  let payout: YawPayout = "queued";
  const acknowledged: Record<string, number> = {};
  // Acknowledging an input the moment it lands would be a lie while its yaw is
  // still being paid out: the client drops acknowledged inputs from the queue
  // it replays over each snapshot, so the turn would vanish from its prediction
  // and reappear a snapshot later, rocking the view back and forth. A sequence
  // is only settled once the room has actually spent it.
  const settle = (id: number): void => {
    const pending = turning.get(id);
    if (pending) acknowledged[id] = pending.sequence;
    turning.delete(id);
  };
  const match = {
    state: initial,
    acknowledged,
    alpha: (): number => accumulator / STEP,
    mode: (): YawPayout => payout,
    payout: (mode: YawPayout): void => {
      payout = mode;
    },
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
      // Clients report the interval they accumulated over; fall back to the gap
      // since their last message. Time left unspent from the previous message
      // carries, so messages arriving faster than the room steps still pay out
      // in full, and the backlog is capped so neither jitter nor a hostile
      // value can leave a player turning through stale input. Carrying forward
      // settles the previous message, whose own window has by now elapsed.
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
          const spent =
            payout === "instant"
              ? pending.seconds
              : Math.min(STEP, pending.seconds);
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
