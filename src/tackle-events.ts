import { Vector3 } from "three";
import { puckProtection, sandwichPartners } from "./shielding";
import type { Player, Simulation, Team } from "./types";

const SETTLED = 0.2;
const REPEAT = 0.5;
const KEPT = 6;

export type TackleEvent = {
  label: string;
  detail: string;
  carrierId: number;
  takerId: number;
  sandwichIds: readonly number[];
  takerTeam: Team;
  time: number;
};

export type TackleTracker = {
  reset: (state: Simulation) => void;
  sample: (state: Simulation) => void;
  events: () => readonly TackleEvent[];
};

const possessorOf = (state: Simulation): number | undefined =>
  state.puck.controlOwner ?? state.puck.lastTouch;

const sideLabel = (carrier: Vector3, yaw: number, taker: Player): string => {
  const local = taker.position
    .clone()
    .sub(carrier)
    .applyAxisAngle(new Vector3(0, 1, 0), -yaw);
  const bearing = Math.abs((Math.atan2(local.x, -local.z) * 180) / Math.PI);
  if (bearing < 45) return "FRONT TACKLE";
  if (bearing > 135) return "BACK TACKLE";
  return local.x > 0 ? "RIGHT TACKLE" : "LEFT TACKLE";
};

const carryLabel = (curl: number): string =>
  curl < 0 ? "reverse curl" : curl > 0 ? "regular curl" : "carrying";

// Record cover for each challenger. Use the value for the player who takes the puck.
const recordCover = (
  state: Simulation,
  carrier: Player,
  covers: Map<number, number>,
): void => {
  covers.clear();
  for (const other of state.players)
    if (other.team !== carrier.team)
      covers.set(other.id, puckProtection(state, carrier, other));
};

export const createTackleTracker = (): TackleTracker => {
  const log: TackleEvent[] = [];
  const held = {
    id: undefined as number | undefined,
    team: 0,
    since: 0,
    position: new Vector3(),
    yaw: 0,
    curl: 0,
    sandwiched: false,
    sandwichIds: [] as number[],
    covers: new Map<number, number>(),
  };
  const forget = (state: Simulation): void => {
    held.id = possessorOf(state);
    held.since = state.time;
  };
  return {
    reset: (state: Simulation): void => {
      log.length = 0;
      forget(state);
    },
    events: (): readonly TackleEvent[] => log,
    sample: (state: Simulation): void => {
      if (state.time < held.since) {
        log.length = 0;
        forget(state);
        return;
      }
      const current = possessorOf(state);
      const carrier = state.players.find(
        (player: Player): boolean => player.id === held.id,
      );
      if (current === held.id) {
        if (carrier) {
          held.team = carrier.team;
          held.position.copy(carrier.position);
          held.yaw = carrier.yaw;
          held.curl = carrier.curl;
          const pincer = sandwichPartners(state, carrier);
          held.sandwiched = pincer.length > 0;
          held.sandwichIds = pincer.map((other: Player): number => other.id);
          recordCover(state, carrier, held.covers);
        }
        return;
      }
      const taker = state.players.find(
        (player: Player): boolean => player.id === current,
      );
      const turnover =
        carrier !== undefined &&
        taker !== undefined &&
        taker.team !== held.team &&
        state.time - held.since > SETTLED;
      if (turnover) {
        const label = held.sandwiched
          ? "SANDWICH"
          : sideLabel(held.position, held.yaw, taker);
        const covered = held.covers.get(taker.id);
        const cover =
          held.curl === 0 || covered === undefined
            ? ""
            : ` · cover ${covered.toFixed(2)}`;
        const last = log.at(0);
        if (!last || last.label !== label || state.time - last.time > REPEAT) {
          log.unshift({
            label,
            detail: `${carryLabel(held.curl)}${cover}`,
            carrierId: carrier.id,
            takerId: taker.id,
            sandwichIds: held.sandwiched ? [...held.sandwichIds] : [],
            takerTeam: taker.team,
            time: state.time,
          });
          log.length = Math.min(log.length, KEPT);
        }
      }
      held.id = current;
      held.since = state.time;
      if (taker) {
        held.team = taker.team;
        held.position.copy(taker.position);
        held.yaw = taker.yaw;
        held.curl = taker.curl;
        held.sandwiched = false;
        held.sandwichIds = [];
        held.covers.clear();
      }
    },
  };
};
