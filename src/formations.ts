import { defendingZone, followingAttack, safeAirReserve } from "./bots";
import {
  formationTarget,
  positionSide,
  rotationPartners,
  strongPositionSide,
} from "./formation-layout";
import { playerPosition, teamSize } from "./positions";
import {
  type AirRotation,
  attackDirection,
  clamp,
  FLOOR_HEIGHT,
  type Formation,
  type Player,
  type Simulation,
  type Team,
} from "./types";

export const formationDescriptions: Record<
  Formation,
  { name: string; description: string }
> = {
  "3-3": {
    name: "The seven",
    description:
      "Three forwards. Strong and center backs cycle; the weak back covers the diagonal.",
  },
  "2-3-1": {
    name: "Connected midfield",
    description: "Two forwards, two wings, a center, and one back.",
  },
  "1-3-2": {
    name: "Cover & release",
    description: "One forward, two wings, a center, and two backs.",
  },
  "2-1": {
    name: "Twin strike",
    description: "Two forwards press together while a lone back sweeps behind.",
  },
  "1-2": {
    name: "Hold & counter",
    description: "One forward hunts the puck while two backs guard the goal.",
  },
  "1-1": {
    name: "Head to head",
    description: "One forward and one back trading the puck end to end.",
  },
};

const groundDistance = (a: Player["position"], b: Player["position"]): number =>
  Math.hypot(a.x - b.x, a.z - b.z);

const readyToCover = (player: Player): boolean =>
  !player.emergency &&
  player.mode !== "ascending" &&
  player.mode !== "recovering" &&
  player.air >= 52;

const finishRotation = (
  state: Simulation,
  team: Team,
  rotation: AirRotation,
): void => {
  for (const player of state.players)
    if (player.id === rotation?.outgoing || player.id === rotation?.incoming)
      player.cycleUntil = state.time + 3;
  state.airRotations[team] = state.airRotations[team].filter(
    (active): boolean => active !== rotation,
  );
};

const applyRotation = (
  state: Simulation,
  team: Team,
  rotation: AirRotation,
): void => {
  const outgoing = state.players.find(
    (player): boolean => player.id === rotation.outgoing,
  );
  const incoming = state.players.find(
    (player): boolean => player.id === rotation.incoming,
  );
  if (
    !outgoing ||
    !incoming ||
    incoming.emergency ||
    incoming.air <= safeAirReserve(state, incoming) + 5 ||
    state.time - rotation.started > 24
  ) {
    finishRotation(state, team, rotation);
    return;
  }
  if (followingAttack(state, outgoing)) {
    finishRotation(state, team, rotation);
    return;
  }
  const station = outgoing.formationTarget;
  incoming.target.copy(station);
  incoming.wantDown = true;
  incoming.duty = outgoing.duty;
  incoming.role = `Covering ${playerPosition(state, outgoing).code}`;
  const covered =
    incoming.mode === "playing" &&
    incoming.position.y < FLOOR_HEIGHT + 0.15 &&
    groundDistance(incoming.position, station) < 0.95;
  if (rotation.phase === "handoff") {
    outgoing.wantDown = true;
    if (
      covered ||
      outgoing.air <= safeAirReserve(state, outgoing) ||
      outgoing.mode === "ascending" ||
      outgoing.mode === "recovering"
    ) {
      rotation.phase = "recover";
      outgoing.mode =
        outgoing.mode === "recovering" ? "recovering" : "ascending";
      outgoing.cycleUntil = state.time + 3;
    }
  }
  if (rotation.phase === "recover") {
    outgoing.duty = "recover";
    outgoing.role = "Cycling for air";
    outgoing.wantDown = true;
    if (outgoing.mode === "diving") rotation.phase = "return";
  }
  if (
    rotation.phase === "return" &&
    outgoing.mode === "playing" &&
    groundDistance(outgoing.position, station) < 1.25
  ) {
    finishRotation(state, team, rotation);
    return;
  }
  if (rotation.phase !== "handoff") {
    const side =
      positionSide(playerPosition(state, outgoing).code) ||
      -strongPositionSide(state, team);
    outgoing.target.copy(station);
    outgoing.target.x = clamp(
      station.x + side * -attackDirection(team) * 0.95,
      -6.8,
      6.8,
    );
    outgoing.target.z = clamp(
      station.z - attackDirection(team) * 0.4,
      -11.5,
      11.5,
    );
  }
};

const planRotation = (
  state: Simulation,
  team: Team,
  players: Player[],
): void => {
  if (state.faceoff) return;
  const committed = (player: Player): boolean =>
    state.airRotations[team].some(
      (active): boolean =>
        active.incoming === player.id || active.outgoing === player.id,
    );
  const concurrentRotations = teamSize(state.formations[team]) < 6 ? 1 : 2;
  if (state.airRotations[team].length < concurrentRotations) {
    const requests = players
      .filter(
        (player): boolean =>
          !player.human &&
          !committed(player) &&
          !followingAttack(state, player) &&
          player.mode === "playing" &&
          player.position.y < 0.65 &&
          state.time >= player.cycleUntil &&
          player.air < 82,
      )
      .sort((a, b): number => a.air - b.air);
    for (const outgoing of requests) {
      if (committed(outgoing)) continue;
      const code = playerPosition(state, outgoing).code;
      const defending = defendingZone(state, outgoing);
      const threshold = defending
        ? safeAirReserve(state, outgoing) + 14
        : code.includes("F")
          ? 62
          : code.includes("B")
            ? 48
            : 56;
      const incoming = rotationPartners(state, outgoing).find(
        (partner): boolean =>
          readyToCover(partner) &&
          !committed(partner) &&
          partner.air >= outgoing.air + 12 &&
          state.time >= partner.cycleUntil &&
          state.puck.controlOwner !== partner.id &&
          (!partner.human ||
            (partner.position.y < 0.51 &&
              groundDistance(partner.position, outgoing.formationTarget) <
                0.95)) &&
          groundDistance(partner.position, outgoing.formationTarget) < 3.3 &&
          (outgoing.air <= threshold ||
            (!defending &&
              partner.position.y < 0.51 &&
              groundDistance(partner.position, outgoing.formationTarget) <
                0.95)),
      );
      if (!incoming) continue;
      state.airRotations[team].push({
        outgoing: outgoing.id,
        incoming: incoming.id,
        phase: "handoff",
        started: state.time,
      });
      if (state.airRotations[team].length >= concurrentRotations) break;
    }
  }
  for (const rotation of state.airRotations[team])
    applyRotation(state, team, rotation);
};

export const planTeam = (state: Simulation, team: Team): void => {
  const players = state.players.filter(
    (player): boolean => player.team === team,
  );
  if (Math.abs(state.puck.position.x) > 0.85)
    state.strongSides[team] = Math.sign(state.puck.position.x);
  const formation = state.formations[team];
  const strongSide = strongPositionSide(state, team);
  for (const player of players) {
    const position = playerPosition(state, player);
    const strong = positionSide(position.code) === strongSide;
    const back = position.code.includes("B");
    player.role = position.name;
    player.duty = back ? "cover" : "support";
    const forward = position.code.includes("F");
    if (
      (formation === "3-3" && back && strong) ||
      (formation !== "3-3" && position.code.includes("W") && strong) ||
      (teamSize(formation) < 6 && forward)
    )
      player.duty = "pressure";
    player.formationTarget.copy(formationTarget(state, player));
    player.target.copy(player.formationTarget);
    player.wantDown = true;
  }
  const strongBack = players.find(
    (player): boolean =>
      playerPosition(state, player).code.includes("B") &&
      positionSide(playerPosition(state, player).code) === strongSide,
  );
  const relief =
    formation === "3-3"
      ? players.find(
          (player): boolean => playerPosition(state, player).code === "CB",
        )
      : players.find(
          (player): boolean =>
            playerPosition(state, player).code.includes("B") &&
            player !== strongBack,
        );
  const lead =
    strongBack &&
    strongBack.air > 36 &&
    strongBack.mode !== "ascending" &&
    strongBack.mode !== "recovering"
      ? strongBack
      : relief;
  if (lead) state.backLeads[team] = lead.id;
  planRotation(state, team, players);
};
