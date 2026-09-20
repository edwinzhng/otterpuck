import { expect, test } from "bun:test";
import { createRooms } from "../services/rooms";
import { planTeam } from "../src/formations";
import {
  PROTOCOL,
  type ServerMessage,
  serverMessageSchema,
} from "../src/multiplayer/protocol";
import { parseSnapshot } from "../src/multiplayer/snapshot";
import {
  defaultFormation,
  formationChoices,
  formationPositions,
  sizeFormations,
  sizeLabel,
  TEAM_SIZES,
  teamSize,
} from "../src/positions";
import { createSimulation, stepSimulation } from "../src/simulation";
import { freshControls, STEP, type TeamSize } from "../src/types";
import { uiShell } from "../src/ui-shell";

const peer = (): {
  messages: ServerMessage[];
  send: (message: ServerMessage) => void;
  close: () => void;
} => {
  const messages: ServerMessage[] = [];
  return {
    messages,
    send: (message): void => {
      messages.push(
        serverMessageSchema.parse(JSON.parse(JSON.stringify(message))),
      );
    },
    close: (): void => {},
  };
};

const room = (p: ReturnType<typeof peer>): ServerMessage => {
  const message = p.messages
    .filter(
      (candidate): boolean =>
        candidate.type === "room" || candidate.type === "session",
    )
    .at(-1);
  if (!message) throw new Error("No room");
  return message;
};

const view = (p: ReturnType<typeof peer>): { teamSize: TeamSize } => {
  const message = room(p);
  if (message.type === "session" || message.type === "room")
    return message.room;
  throw new Error("No room");
};

test("every match size offers formations that name one position per swimmer", (): void => {
  for (const size of TEAM_SIZES) {
    const choices = sizeFormations(size);
    expect(choices.length).toBeGreaterThan(0);
    expect(choices).toContain(defaultFormation(size));
    for (const formation of choices) {
      expect(teamSize(formation)).toBe(size);
      const codes = formationPositions[formation];
      expect(codes).toHaveLength(size);
      expect(new Set(codes).size).toBe(size);
      expect(
        codes.some((code): boolean => code.includes("F")) &&
          codes.some((code): boolean => code.includes("B")),
      ).toBe(true);
      expect(formationChoices(formation).at(0)?.slot).toBe(0);
    }
  }
});

test("2v2 and 3v3 matches field the chosen roster and every swimmer keeps a distinct slot", (): void => {
  for (const size of TEAM_SIZES)
    for (const formation of sizeFormations(size))
      for (const species of ["otter", "beaver"] as const)
        for (const position of formationChoices(formation)) {
          const state = createSimulation(
            formation,
            formation,
            "match",
            180,
            "right",
            {
              species,
              position: position.slot,
              difficulty: "hard",
            },
          );
          expect(state.players).toHaveLength(size * 2);
          for (const team of [0, 1] as const) {
            const side = state.players.filter(
              (player): boolean => player.team === team,
            );
            expect(side).toHaveLength(size);
            expect(
              new Set(side.map((player): number => player.slot)).size,
            ).toBe(size);
            expect(side.every((player): boolean => player.slot < size)).toBe(
              true,
            );
          }
          const human = state.players.at(0);
          if (!human) throw new Error("Missing selected swimmer");
          expect(human.human).toBe(true);
          expect(human.slot).toBe(position.slot);
          expect(
            state.players.filter((player): boolean => player.human),
          ).toHaveLength(1);
          state.faceoff = undefined;
          planTeam(state, human.team);
          stepSimulation(state, { ...freshControls(), forward: 1 }, STEP);
          expect(human.velocity.length()).toBeGreaterThan(0);
        }
});

test("a small side never sends its whole team up for air at once", (): void => {
  for (const size of [2, 3] as const) {
    const formation = defaultFormation(size);
    const state = createSimulation(formation, formation);
    state.faceoff = undefined;
    for (const player of state.players) {
      player.human = false;
      player.wallReady = false;
      player.mode = "playing";
      player.position.copy(player.formationTarget);
      player.air = 40;
    }
    planTeam(state, 0);
    expect(state.airRotations[0].length).toBeLessThanOrEqual(1);
  }
});

test("the lobby offers every match size and names the quick match after it", (): void => {
  const markup = uiShell();
  expect(markup).toContain("Quick match");
  for (const size of TEAM_SIZES)
    expect(markup).toContain(
      `data-team-size="${size}"${size === 6 ? "" : `>${sizeLabel(size)}`}`,
    );
  expect(markup).toContain("Play vs AI");
  expect(markup.match(/data-game-mode=/g)).toHaveLength(2);
  expect(markup).toContain(
    'class="lobby-screen setup-screen" data-screen="setup" data-mode="match"',
  );
  expect(markup).toContain('<select id="mp-team-size" hidden>');
});

test("a room starts at 6v6, follows the host's match size and seats guests within it", (): void => {
  const rooms = createRooms("us");
  const host = peer();
  rooms.message(host, { type: "create", protocol: PROTOCOL, mode: "online" });
  expect(view(host).teamSize).toBe(6);
  rooms.message(host, { type: "settings", teamSize: 2 });
  expect(view(host).teamSize).toBe(2);
  const guests = [peer(), peer(), peer(), peer(), peer()];
  const code = (() => {
    const message = host.messages.find((m) => m.type === "session");
    if (message?.type !== "session") throw new Error("No session");
    return message.room.code;
  })();
  for (const guest of guests)
    rooms.message(guest, { type: "join", protocol: PROTOCOL, code });
  const seated = guests.filter((guest) =>
    guest.messages.some((message) => message.type === "session"),
  );
  expect(seated).toHaveLength(3);
  const full = guests.at(-1);
  expect(
    full?.messages.some(
      (message) => message.type === "error" && /full/i.test(message.message),
    ),
  ).toBe(true);
  const occupied = host.messages
    .filter((message) => message.type === "room")
    .at(-1);
  if (occupied?.type !== "room") throw new Error("No room");
  expect(occupied.room.members).toHaveLength(4);
  for (const member of occupied.room.members)
    expect(member.playerId % 6).toBeLessThan(2);
});

test("a guest cannot claim a seat outside the room's match size", (): void => {
  const rooms = createRooms("us");
  const host = peer();
  rooms.message(host, { type: "create", protocol: PROTOCOL, mode: "online" });
  rooms.message(host, { type: "settings", teamSize: 3 });
  rooms.message(host, { type: "profile", playerId: 4 });
  expect(
    host.messages.some(
      (message) =>
        message.type === "error" &&
        /not part of this match size/i.test(message.message),
    ),
  ).toBe(true);
  rooms.message(host, { type: "profile", playerId: 8 });
  const latest = host.messages.filter((m) => m.type === "room").at(-1);
  if (latest?.type !== "room") throw new Error("No room");
  expect(latest.room.members.at(0)?.playerId).toBe(8);
});

test("shrinking a room reseats members who fall outside the new match size", (): void => {
  const rooms = createRooms("us");
  const host = peer();
  rooms.message(host, { type: "create", protocol: PROTOCOL, mode: "online" });
  const code = (() => {
    const message = host.messages.find((m) => m.type === "session");
    if (message?.type !== "session") throw new Error("No session");
    return message.room.code;
  })();
  const guest = peer();
  rooms.message(guest, { type: "join", protocol: PROTOCOL, code });
  rooms.message(guest, { type: "profile", playerId: 5 });
  rooms.message(host, { type: "settings", teamSize: 2 });
  const latest = host.messages.filter((m) => m.type === "room").at(-1);
  if (latest?.type !== "room") throw new Error("No room");
  expect(latest.room.teamSize).toBe(2);
  for (const member of latest.room.members)
    expect(member.playerId % 6).toBeLessThan(2);
  expect(new Set(latest.room.members.map((m) => m.playerId)).size).toBe(2);
});

test("only the host changes room settings and every guest receives them", (): void => {
  const rooms = createRooms("us");
  const host = peer();
  rooms.message(host, { type: "create", protocol: PROTOCOL, mode: "online" });
  const code = (() => {
    const message = host.messages.find((m) => m.type === "session");
    if (message?.type !== "session") throw new Error("No session");
    return message.room.code;
  })();
  const guest = peer();
  rooms.message(guest, { type: "join", protocol: PROTOCOL, code });
  rooms.message(guest, {
    type: "settings",
    teamSize: 2,
    swimTurn: 1.5,
    difficulty: "elite",
  });
  expect(
    guest.messages.some(
      (message) =>
        message.type === "error" &&
        /only the room creator/i.test(message.message),
    ),
  ).toBe(true);
  const unchanged = guest.messages.filter((m) => m.type === "room").at(-1);
  if (unchanged?.type !== "room") throw new Error("No room");
  expect(unchanged.room.teamSize).toBe(6);
  expect(unchanged.room.swimTurn).not.toBe(1.5);
  expect(unchanged.room.difficulty).toBe("medium");
  rooms.message(host, {
    type: "settings",
    teamSize: 3,
    swimTurn: 1.5,
    difficulty: "elite",
  });
  const synchronized = guest.messages.filter((m) => m.type === "room").at(-1);
  if (synchronized?.type !== "room") throw new Error("No room");
  expect(synchronized.room.teamSize).toBe(3);
  expect(synchronized.room.swimTurn).toBe(1.5);
  expect(synchronized.room.difficulty).toBe("elite");
  rooms.message(host, { type: "start" });
  rooms.message(host, {
    type: "settings",
    teamSize: 6,
    swimTurn: 2,
    difficulty: "easy",
  });
  const latest = host.messages.filter((m) => m.type === "room").at(-1);
  if (latest?.type !== "room") throw new Error("No room");
  expect(latest.room.teamSize).toBe(3);
  expect(latest.room.swimTurn).toBe(1.5);
  expect(latest.room.difficulty).toBe("elite");
});

test("an online room plays the match size the host chose", (): void => {
  const rooms = createRooms("us");
  const host = peer();
  rooms.message(host, { type: "create", protocol: PROTOCOL, mode: "online" });
  rooms.message(host, { type: "settings", teamSize: 3 });
  rooms.message(host, { type: "start" });
  for (let step = 0; step < 20; step++) rooms.tick(1 / 20);
  const snapshot = host.messages
    .filter((m): boolean => m.type === "snapshot")
    .at(-1);
  if (snapshot?.type !== "snapshot") throw new Error("No snapshot");
  const state = parseSnapshot(snapshot.state);
  expect(state?.players).toHaveLength(6);
  expect(state?.formations.at(0)).toBe(defaultFormation(3));
});

test("a room's swim turn and bot difficulty settings reach the match simulation", (): void => {
  const rooms = createRooms("us");
  const host = peer();
  rooms.message(host, { type: "create", protocol: PROTOCOL, mode: "online" });
  rooms.message(host, { type: "settings", swimTurn: 1.5, difficulty: "elite" });
  expect(view(host).teamSize).toBe(6);
  const room = host.messages.filter((m) => m.type === "room").at(-1);
  if (room?.type !== "room") throw new Error("No room");
  expect(room.room.swimTurn).toBe(1.5);
  expect(room.room.difficulty).toBe("elite");
  rooms.message(host, { type: "start" });
  for (let step = 0; step < 20; step++) rooms.tick(1 / 20);
  const snapshot = host.messages
    .filter((m): boolean => m.type === "snapshot")
    .at(-1);
  if (snapshot?.type !== "snapshot") throw new Error("No snapshot");
  const state = parseSnapshot(snapshot.state);
  expect(state?.swimTurn).toBe(1.5);
  expect(state?.difficulty).toBe("elite");
});
