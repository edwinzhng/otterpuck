import { expect, test } from "bun:test";
import { CHARACTER_SPECIES } from "../src/characters";
import {
  createNetworkMatch,
  createRoomSimulation,
} from "../src/multiplayer/match";
import {
  clientMessageSchema,
  PROTOCOL,
  type RoomView,
  type ServerMessage,
  serverMessageSchema,
} from "../src/multiplayer/protocol";
import { packSnapshot, parseSnapshot } from "../src/multiplayer/snapshot";
import { createRooms } from "./rooms";

const peer = () => {
  const messages: ServerMessage[] = [];
  return {
    messages,
    send: (message: ServerMessage): void => {
      messages.push(
        serverMessageSchema.parse(JSON.parse(JSON.stringify(message))),
      );
    },
    close: (): void => {},
  };
};
const session = (player: ReturnType<typeof peer>) => {
  const message = player.messages.find((message) => message.type === "session");
  if (message?.type !== "session") throw new Error("Missing session");
  return message;
};
const room = (player: ReturnType<typeof peer>): RoomView => {
  const message = player.messages
    .filter((message) => message.type === "room")
    .at(-1);
  if (message?.type !== "room") throw new Error("Missing room");
  return message.room;
};

test("all team characters apply to humans and bots through snapshots and disconnects", (): void => {
  for (const species of CHARACTER_SPECIES)
    for (const playerId of [0, 6]) {
      const teamSpecies: RoomView["teamSpecies"] = ["otter", "beaver"];
      teamSpecies[playerId === 0 ? 0 : 1] = species;
      const match = createNetworkMatch(
        createRoomSimulation({
          teamSize: 6,
          swimTurn: 1,
          difficulty: "medium",
          teamSpecies,
        }),
      );
      const member = {
        id: crypto.randomUUID(),
        name: "Player",
        playerId,
        species,
        connected: true,
      };
      match.roster([member], teamSpecies);
      const player = match.state.players.find(
        (player) => player.id === playerId,
      );
      expect(player?.species).toBe(species);
      expect(player?.team).toBe(playerId === 0 ? 0 : 1);
      for (const teammate of match.state.players)
        expect(teammate.species).toBe(teamSpecies[teammate.team]);
      const restored = parseSnapshot(
        JSON.parse(JSON.stringify(packSnapshot(match.state))),
      );
      expect(restored).toBeDefined();
      for (const teammate of restored?.players ?? [])
        expect(teammate.species).toBe(teamSpecies[teammate.team]);
      match.roster([{ ...member, connected: false }], teamSpecies);
      expect(player?.species).toBe(species);
      expect(player?.human).toBe(false);
    }
});

test("host team choices sync on online and LAN rooms, seat changes and reconnects", (): void => {
  for (const mode of ["online", "lan"] as const) {
    const rooms = createRooms("test");
    const host = peer();
    const guest = peer();
    rooms.message(host, {
      type: "create",
      protocol: PROTOCOL,
      mode,
      team: 0,
    });
    const credentials = session(host);
    rooms.message(guest, {
      type: "join",
      protocol: PROTOCOL,
      code: credentials.room.code,
      team: 1,
    });
    rooms.message(host, {
      type: "settings",
      teamSpecies: ["dolphin", "puffin"],
    });
    expect(room(guest).teamSpecies).toEqual(["dolphin", "puffin"]);
    expect(room(host).teamSpecies).toEqual(room(guest).teamSpecies);
    rooms.message(guest, {
      type: "settings",
      teamSpecies: ["raccoon", "walrus"],
    });
    expect(guest.messages.at(-1)?.type).toBe("error");
    expect(room(host).teamSpecies).toEqual(["dolphin", "puffin"]);
    rooms.message(host, { type: "profile", playerId: 7 });
    expect(
      room(guest).members.find((member) => member.id === credentials.id),
    ).toMatchObject({ species: "puffin", playerId: 7 });
    expect(
      room(guest).members.find((member) => member.id !== credentials.id)
        ?.species,
    ).toBe("puffin");
    rooms.disconnect(host);
    const resumed = peer();
    rooms.message(resumed, {
      type: "resume",
      protocol: PROTOCOL,
      code: credentials.room.code,
      token: credentials.token,
    });
    expect(
      session(resumed).room.members.find(
        (member) => member.id === credentials.id,
      ),
    ).toMatchObject({ species: "puffin", playerId: 7 });
    rooms.message(resumed, { type: "start" });
    for (const player of [resumed, guest])
      rooms.message(player, {
        type: "loaded",
        loadId: room(player).loadId,
        ok: true,
      });
    rooms.message(resumed, {
      type: "settings",
      teamSpecies: ["raccoon", "walrus"],
    });
    expect(room(resumed).teamSpecies).toEqual(["dolphin", "puffin"]);
    expect(
      room(guest).members.find((member) => member.id === credentials.id)
        ?.species,
    ).toBe("puffin");
    if (mode === "online") {
      rooms.tick(1 / 60);
      const snapshot = resumed.messages
        .filter((message) => message.type === "snapshot")
        .at(-1);
      expect(snapshot?.type).toBe("snapshot");
      if (snapshot?.type === "snapshot") {
        const state = parseSnapshot(snapshot.state);
        expect(state).toBeDefined();
        for (const player of state?.players ?? [])
          expect(player.species).toBe(player.team === 0 ? "dolphin" : "puffin");
      }
    }
  }
});

test("network boundary rejects unknown cosmetics and old clients", (): void => {
  expect(
    clientMessageSchema.safeParse({
      type: "settings",
      teamSpecies: ["otter", "dragon"],
    }).success,
  ).toBe(false);
  expect(
    clientMessageSchema.safeParse({ type: "settings", teamSpecies: ["otter"] })
      .success,
  ).toBe(false);
  expect(
    clientMessageSchema.parse({ type: "profile", species: "dolphin" }),
  ).toEqual({ type: "profile" });
  expect(
    clientMessageSchema.safeParse({
      type: "create",
      mode: "online",
      protocol: PROTOCOL - 1,
      species: "otter",
    }).success,
  ).toBe(false);
});
