import {
  predictOwnedPuck,
  predictPlayerMovement,
  updateStick,
  withoutTurnCap,
} from "../simulation";
import { type Controls, type Simulation, STEP } from "../types";

// `predicted` is the yaw this input left the view at, kept so the next
// snapshot can be compared against what the client believed at the same input.
type Pending = {
  sequence: number;
  controls: Controls;
  seconds: number;
  predicted: number;
};
// `applied` is the smoothing the view was dragged through, which grows with how
// fast the turn is; `missed` is the room and the prediction disagreeing about
// where the same input ended up, which should be near zero however hard you
// turn.
export type Reconciliation = { applied: number; missed: number };
export const createMovementPrediction = (): {
  advance: (
    state: Simulation,
    controls: Controls,
    seconds: number,
    sequence: number,
  ) => void;
  reconcile: (
    state: Simulation,
    acknowledged: number | undefined,
    previous?: Simulation,
  ) => Reconciliation;
  waiting: () => number;
} => {
  let pending: Pending[] = [];
  let enabled = false;
  const move = (
    state: Simulation,
    controls: Controls,
    seconds: number,
  ): void => {
    const player = state.players.at(0);
    if (!player) return;
    const input = { ...controls };
    let remaining = seconds;
    while (remaining > 0.000001) {
      const dt = Math.min(STEP, remaining);
      input.yawDelta = (controls.yawDelta * dt) / seconds;
      player.previous.copy(player.position);
      const puckPrevious = state.puck.previous.clone();
      const orientationPrevious = state.puck.previousOrientation.clone();
      state.puck.previous.copy(state.puck.position);
      predictPlayerMovement(state, player, input, dt);
      if (predictOwnedPuck(state, player, dt)) {
        state.puck.previous.copy(state.puck.position);
        state.puck.previousOrientation.copy(state.puck.orientation);
      } else {
        state.puck.previous.copy(puckPrevious);
        state.puck.previousOrientation.copy(orientationPrevious);
      }
      input.dive = false;
      remaining -= dt;
    }
    player.previous.copy(player.position);
    player.previousYaw = player.yaw;
    player.previousStick.copy(player.stick);
    player.previousStickOrientation.copy(player.stickOrientation);
  };
  return {
    advance: (
      state: Simulation,
      controls: Controls,
      seconds: number,
      sequence: number,
    ): void => {
      if (!enabled || seconds <= 0) return;
      const duration = Math.min(seconds, 0.1);
      const input: Pending = {
        sequence,
        controls: { ...controls },
        seconds: duration,
        predicted: 0,
      };
      pending.push(input);
      if (pending.reduce((sum, input) => sum + input.seconds, 0) > 0.5) {
        pending = [];
        enabled = false;
        return;
      }
      move(state, controls, duration);
      input.predicted = state.players.at(0)?.yaw ?? 0;
    },
    waiting: (): number => pending.length,
    reconcile: (
      state: Simulation,
      acknowledged: number | undefined,
      previous?: Simulation,
    ): Reconciliation => {
      enabled = acknowledged !== undefined;
      if (!enabled) {
        pending = [];
        return { applied: 0, missed: 0 };
      }
      const settled = pending
        .filter((input) => input.sequence <= (acknowledged ?? -1))
        .at(-1);
      const authoritative = state.players.at(0)?.yaw;
      const missed =
        settled && authoritative !== undefined
          ? Math.abs(
              Math.atan2(
                Math.sin(authoritative - settled.predicted),
                Math.cos(authoritative - settled.predicted),
              ),
            )
          : 0;
      pending = pending.filter(
        (input) => input.sequence > (acknowledged ?? -1),
      );
      withoutTurnCap((): void => {
        for (const input of pending) move(state, input.controls, input.seconds);
      });
      const player = state.players.at(0);
      const old = previous?.players.at(0);
      const beforeCorrection = player?.position.clone();
      let applied = 0;
      const carrying =
        player &&
        state.puck.controlOwner === player.id &&
        state.puck.shotOwner === undefined &&
        !player.puckMove &&
        player.shotTime <= 0;
      if (
        player &&
        old &&
        !state.finished &&
        state.restartTime === previous?.restartTime &&
        state.faceoff?.phase === previous.faceoff?.phase &&
        player.position.distanceTo(old.position) < 0.75
      ) {
        player.position.lerp(old.position, 0.8);
        const difference = Math.atan2(
          Math.sin(old.yaw - player.yaw),
          Math.cos(old.yaw - player.yaw),
        );
        if (Math.abs(difference) < 0.5) {
          applied = Math.abs(difference * 0.8);
          player.yaw += difference * 0.8;
        }
      }
      if (player) {
        updateStick(player, 0);
        player.previousStick.copy(player.stick);
        player.previousStickOrientation.copy(player.stickOrientation);
        if (
          carrying &&
          beforeCorrection &&
          !state.finished &&
          state.restartTime === 0
        ) {
          state.puck.position.add(player.position).sub(beforeCorrection);
          if (
            old &&
            previous?.puck.controlOwner === player.id &&
            previous.puck.shotOwner === undefined &&
            state.puck.position.distanceTo(previous.puck.position) < 0.5
          ) {
            const carried = previous.puck.position
              .clone()
              .add(player.position)
              .sub(old.position);
            state.puck.position.lerp(carried, 0.8);
          }
          state.puck.previous.copy(state.puck.position);
          state.puck.previousOrientation.copy(state.puck.orientation);
        }
        player.previous.copy(player.position);
        player.previousYaw = player.yaw;
      }
      return { applied, missed };
    },
  };
};
