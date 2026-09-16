import {
  predictOwnedPuck,
  predictPlayerMovement,
  updateStick,
} from "../simulation";
import { type Controls, type Simulation, STEP } from "../types";

type Pending = { sequence: number; controls: Controls; seconds: number };
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
  ) => void;
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
      input.yawDelta = 0;
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
      pending.push({ sequence, controls: { ...controls }, seconds: duration });
      if (pending.reduce((sum, input) => sum + input.seconds, 0) > 0.5) {
        pending = [];
        enabled = false;
        return;
      }
      move(state, controls, duration);
    },
    reconcile: (
      state: Simulation,
      acknowledged: number | undefined,
      previous?: Simulation,
    ): void => {
      enabled = acknowledged !== undefined;
      if (!enabled) {
        pending = [];
        return;
      }
      pending = pending.filter(
        (input) => input.sequence > (acknowledged ?? -1),
      );
      for (const input of pending) move(state, input.controls, input.seconds);
      const player = state.players.at(0);
      const old = previous?.players.at(0);
      const beforeCorrection = player?.position.clone();
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
        if (Math.abs(difference) < 0.5) player.yaw += difference * 0.8;
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
    },
  };
};
