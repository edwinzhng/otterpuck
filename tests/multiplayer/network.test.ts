import { describe, expect, test } from "bun:test";
import { createRooms } from "../../services/rooms";
import { createNetworkMatch } from "../../src/multiplayer/match";
import { customPlayerName } from "../../src/multiplayer/names";
import {
  clientMessageSchema,
  PROTOCOL,
  type ServerMessage,
  serverMessageSchema,
} from "../../src/multiplayer/protocol";
import { localView, parseSnapshot } from "../../src/multiplayer/snapshot";
import { createSimulation, stepSimulation } from "../../src/simulation";
import { freshControls, STEP } from "../../src/types";

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
const session = (
  p: ReturnType<typeof peer>,
): Extract<ServerMessage, { type: "session" }> => {
  const message = p.messages.find((m) => m.type === "session");
  if (message?.type !== "session") throw new Error("No session");
  return message;
};
test("default names follow successful room joins, survive resume and never reuse departed numbers", () => {
  const rooms = createRooms("us");
  const host = peer();
  rooms.message(host, { type: "create", protocol: PROTOCOL, mode: "online" });
  const h = session(host);
  expect(h.room.members.at(0)?.name).toBe("Player 1");
  const guest = peer();
  rooms.message(guest, {
    type: "join",
    protocol: PROTOCOL,
    code: h.room.code,
    name: "Edwin",
  });
  const g = session(guest);
  rooms.message(guest, { type: "profile", name: "" });
  const updated = host.messages
    .filter((message) => message.type === "room")
    .at(-1);
  expect(updated?.room.members.find((member) => member.id === g.id)?.name).toBe(
    "Player 2",
  );
  rooms.disconnect(guest);
  const resumed = peer();
  rooms.message(resumed, {
    type: "resume",
    protocol: PROTOCOL,
    code: h.room.code,
    token: g.token,
  });
  expect(
    session(resumed).room.members.find((member) => member.id === g.id)?.name,
  ).toBe("Player 2");
  rooms.message(resumed, { type: "leave" });
  const next = peer();
  rooms.message(next, {
    type: "join",
    protocol: PROTOCOL,
    code: h.room.code,
    name: "Player 1",
  });
  expect(session(next).room.members.at(-1)?.name).toBe("Player 3");
  const saved = peer();
  rooms.message(saved, {
    type: "join",
    protocol: PROTOCOL,
    code: h.room.code,
    name: customPlayerName("  Edwin  "),
  });
  expect(session(saved).room.members.at(-1)?.name).toBe("Edwin");
  expect(customPlayerName("Player 3")).toBeUndefined();
});
describe("multiplayer", () => {
  test("independent controls survive faceoff and do not move another human", () => {
    const state = createSimulation();
    state.faceoff = undefined;
    for (const player of state.players)
      player.human = player.id === 0 || player.id === 6;
    const first = state.players.find((p) => p.id === 0);
    const second = state.players.find((p) => p.id === 6);
    if (!first || !second) throw new Error();
    const yaw = second.yaw;
    const controls = new Map([
      [0, { ...freshControls(), yawDelta: 0.02 }],
      [6, freshControls()],
    ]);
    stepSimulation(state, controls, STEP);
    expect(first.yaw).toBeCloseTo(0.026);
    expect(second.yaw).toBe(yaw);
    expect(controls.get(0)?.yawDelta).toBe(0);
    state.faceoff = { phase: "ready", remaining: 3 };
    const previous = first.yaw;
    controls.set(6, { ...freshControls(), yawDelta: 0.25 });
    stepSimulation(state, controls, STEP);
    expect(first.yaw).toBe(previous);
    expect(second.yaw).toBeCloseTo(yaw + 0.25);
  });
  test("snapshots round trip full active puck and player state", () => {
    const state = createSimulation();
    const controls = freshControls();
    for (let i = 0; i < 1000; i++) stepSimulation(state, controls, STEP);
    const copy = parseSnapshot(JSON.parse(JSON.stringify(state)));
    expect(copy).toBeDefined();
    if (!copy) throw new Error();
    expect(copy.puck.position.distanceTo(state.puck.position)).toBe(0);
    expect(
      copy.players[0]?.stickOrientation.angleTo(
        state.players[0].stickOrientation,
      ),
    ).toBeCloseTo(0);
    expect(() => stepSimulation(copy, new Map(), STEP)).not.toThrow();
    expect(localView(copy, 6).players[0]?.id).toBe(6);
    expect(parseSnapshot({ players: [] })).toBeUndefined();
  });
  test("room authority, matching snapshots, reconnect and expired reservation", () => {
    let now = 1000;
    const rooms = createRooms("us", () => now);
    const host = peer();
    const guest = peer();
    rooms.message(host, {
      type: "create",
      protocol: PROTOCOL,
      name: "Host",
      mode: "online",
      team: 0,
    });
    const h = session(host);
    rooms.message(guest, {
      type: "join",
      protocol: PROTOCOL,
      name: "Guest",
      team: 1,
      code: h.room.code,
    });
    const g = session(guest);
    expect(h.room.region).toBe("us");
    expect(g.room.members.map((m) => m.playerId)).toEqual([0, 6]);
    rooms.message(guest, { type: "start" });
    expect(guest.messages.at(-1)?.type).toBe("error");
    rooms.message(host, { type: "start" });
    rooms.tick(0.1);
    const hs = host.messages.filter((m) => m.type === "snapshot").at(-1);
    const gs = guest.messages.filter((m) => m.type === "snapshot").at(-1);
    expect(hs).toEqual(gs);
    rooms.disconnect(guest);
    const resumed = peer();
    rooms.message(resumed, {
      type: "resume",
      protocol: PROTOCOL,
      code: h.room.code,
      token: g.token,
    });
    expect(session(resumed).id).toBe(g.id);
    const attacker = peer();
    rooms.message(attacker, {
      type: "resume",
      protocol: PROTOCOL,
      code: h.room.code,
      token: crypto.randomUUID(),
    });
    expect(attacker.messages.at(-1)?.type).toBe("error");
    rooms.disconnect(resumed);
    now += 31000;
    rooms.tick(0.1);
    const expired = peer();
    rooms.message(expired, {
      type: "resume",
      protocol: PROTOCOL,
      code: h.room.code,
      token: g.token,
    });
    expect(expired.messages.at(-1)?.type).toBe("error");
  });
  test("LAN signals are restricted to room members and host paths", () => {
    const rooms = createRooms("eu");
    const host = peer();
    const guest = peer();
    const other = peer();
    const stranger = peer();
    rooms.message(host, {
      type: "create",
      protocol: PROTOCOL,
      name: "Host",
      mode: "lan",
      team: 0,
    });
    const h = session(host);
    for (const p of [guest, other])
      rooms.message(p, {
        type: "join",
        protocol: PROTOCOL,
        code: h.room.code,
        name: "Guest",
        team: 1,
      });
    const before = other.messages.length;
    rooms.message(guest, {
      type: "signal",
      to: session(other).id,
      signal: { type: "offer", sdp: "test" },
    });
    expect(other.messages.length).toBe(before);
    rooms.message(stranger, {
      type: "signal",
      to: h.id,
      signal: { type: "offer", sdp: "test" },
    });
    expect(stranger.messages.at(-1)?.type).toBe("error");
    rooms.message(guest, {
      type: "signal",
      to: h.id,
      signal: { type: "offer", sdp: "test" },
    });
    expect(host.messages.at(-1)?.type).toBe("signal");
    rooms.message(host, { type: "start" });
    rooms.tick(0.1);
    expect(host.messages.some((m) => m.type === "snapshot")).toBe(false);
  });
  test("a capped turn scales with the interval its input covers, not the room's ticks", () => {
    // Scale a capped input by its source interval, independent of the room tick.
    const yawFor = (duration: number, tick: number): number => {
      const match = createNetworkMatch();
      match.state.faceoff = undefined;
      match.roster([
        { id: crypto.randomUUID(), name: "A", playerId: 0, connected: true },
      ]);
      const player = match.state.players.find((p) => p.id === 0);
      const before = player?.yaw ?? 0;
      match.input(0, 1, { ...freshControls(), yawDelta: 1 }, duration);
      for (let elapsed = 0; elapsed < 0.2; elapsed += tick) match.advance(tick);
      return (player?.yaw ?? 0) - before;
    };
    const one = yawFor(STEP, 1 / 60);
    expect(Math.abs(one)).toBeGreaterThan(0);
    expect(yawFor(2 * STEP, 1 / 60) / one).toBeCloseTo(2, 2);
    expect(yawFor(4 * STEP, 1 / 60) / one).toBeCloseTo(4, 2);
    expect(yawFor(4 * STEP, 1 / 30) / one).toBeCloseTo(4, 2);
    expect(yawFor(4 * STEP, STEP) / one).toBeCloseTo(4, 2);
  });
  test("turning at the cap survives a send rate slower than the room tick", () => {
    // Keep the sustained turn rate independent of the input send rate.
    const rateFor = (sendHz: number): number => {
      const match = createNetworkMatch();
      match.state.faceoff = undefined;
      match.roster([
        { id: crypto.randomUUID(), name: "A", playerId: 0, connected: true },
      ]);
      const player = match.state.players.find((p) => p.id === 0);
      const before = player?.yaw ?? 0;
      const tick = 1 / 60;
      const send = 1 / sendHz;
      let next = 0;
      let sequence = 0;
      const seconds = 1;
      for (let elapsed = 0; elapsed < seconds; elapsed += tick) {
        while (next <= elapsed + tick) {
          match.input(0, ++sequence, { ...freshControls(), yawDelta: 1 }, send);
          next += send;
        }
        match.advance(tick);
      }
      return ((player?.yaw ?? 0) - before) / seconds;
    };
    const perTick = rateFor(60);
    expect(Math.abs(perTick)).toBeGreaterThan(1);
    expect(rateFor(30) / perTick).toBeCloseTo(1, 2);
    expect(rateFor(15) / perTick).toBeCloseTo(1, 2);
    expect(rateFor(120) / perTick).toBeCloseTo(1, 2);
  });
  test("a sequence is acknowledged only once its yaw has been spent", () => {
    // Acknowledge an input only after the room applies all of its yaw.
    const match = createNetworkMatch();
    match.state.faceoff = undefined;
    match.roster([
      { id: crypto.randomUUID(), name: "A", playerId: 0, connected: true },
    ]);
    match.input(0, 7, { ...freshControls(), yawDelta: 0.4 }, 8 * STEP);
    match.advance(STEP);
    expect(match.acknowledged[0]).toBeUndefined();
    for (let step = 0; step < 8; step++) match.advance(STEP);
    expect(match.acknowledged[0]).toBe(7);
  });
  test("stale input stops and repeated sequence cannot replay actions", () => {
    const match = createNetworkMatch();
    match.state.faceoff = undefined;
    match.roster([
      { id: crypto.randomUUID(), name: "A", playerId: 0, connected: true },
    ]);
    match.input(0, 1, { ...freshControls(), yawDelta: 0.02 });
    match.advance(0.1);
    const player = match.state.players.find((p) => p.id === 0);
    expect(player?.yaw).toBeCloseTo(0.026);
    match.input(0, 1, { ...freshControls(), yawDelta: 0.02 });
    match.advance(0.1);
    expect(player?.yaw).toBeCloseTo(0.026);
    match.input(0, 2, { ...freshControls(), forward: 1, sprint: true });
    match.advance(0.1);
    expect(player?.sprint).toBe(true);
    for (let i = 0; i < 10; i++) match.advance(0.1);
    expect(player?.sprint).toBe(false);
  });
  test("malformed inputs and incompatible versions are rejected", () => {
    expect(
      clientMessageSchema.safeParse({
        type: "input",
        sequence: 0,
        controls: { ...freshControls(), forward: 100 },
      }).success,
    ).toBe(false);
    expect(
      clientMessageSchema.safeParse({
        type: "create",
        protocol: 0,
        name: "a",
        team: 0,
        mode: "online",
      }).success,
    ).toBe(false);
  });
});

test("waiting room changes reserve positions, broadcast names, and lock at start", () => {
  const rooms = createRooms("us");
  const host = peer();
  const guest = peer();
  rooms.message(host, {
    type: "create",
    protocol: PROTOCOL,
    name: "Host",
    mode: "online",
  });
  const h = session(host);
  rooms.message(guest, {
    type: "join",
    protocol: PROTOCOL,
    name: "Guest",
    code: h.room.code,
  });
  expect(session(guest).room.members.map((member) => member.playerId)).toEqual([
    0, 6,
  ]);
  rooms.message(host, { type: "profile", name: "Edwin", playerId: 8 });
  const updated = guest.messages
    .filter((message) => message.type === "room")
    .at(-1);
  expect(updated?.room.members.find((member) => member.id === h.id)?.name).toBe(
    "Edwin",
  );
  expect(
    updated?.room.members.find((member) => member.id === h.id)?.playerId,
  ).toBe(8);
  rooms.message(guest, { type: "profile", playerId: 8 });
  expect(guest.messages.at(-1)?.type).toBe("error");
  rooms.disconnect(host);
  rooms.message(guest, { type: "profile", playerId: 8 });
  expect(guest.messages.at(-1)?.type).toBe("error");
  const resumed = peer();
  rooms.message(resumed, {
    type: "resume",
    protocol: PROTOCOL,
    code: h.room.code,
    token: h.token,
  });
  expect(
    session(resumed).room.members.find((member) => member.id === h.id)
      ?.playerId,
  ).toBe(8);
  rooms.message(resumed, { type: "start" });
  rooms.message(guest, { type: "profile", playerId: 2 });
  expect(guest.messages.at(-1)?.type).toBe("error");
  rooms.tick(0.1);
  const snapshot = resumed.messages
    .filter((message) => message.type === "snapshot")
    .at(-1);
  const state = parseSnapshot(JSON.parse(JSON.stringify(snapshot?.state)));
  expect(
    state?.players.filter((player) => player.human).map((player) => player.id),
  ).toEqual([6, 8]);
});

test("room handedness reaches the match and can change without moving another player", () => {
  const rooms = createRooms("us");
  const host = peer();
  rooms.message(host, {
    type: "create",
    protocol: PROTOCOL,
    mode: "online",
    handedness: "left",
  });
  const h = session(host);
  expect(h.room.members.at(0)?.handedness).toBe("left");
  const guest = peer();
  rooms.message(guest, {
    type: "join",
    protocol: PROTOCOL,
    code: h.room.code,
    handedness: "right",
  });
  rooms.message(host, { type: "profile", playerId: 8 });
  rooms.message(host, { type: "start" });
  rooms.tick(0.1);
  const snapshot = (): ReturnType<typeof parseSnapshot> =>
    parseSnapshot(
      JSON.parse(
        JSON.stringify(
          host.messages.filter((message) => message.type === "snapshot").at(-1)
            ?.state,
        ),
      ),
    );
  expect(
    snapshot()?.players.find((player) => player.id === 8)?.handedness,
  ).toBe("left");
  expect(
    snapshot()?.players.find((player) => player.id === 6)?.handedness,
  ).toBe("right");
  rooms.message(host, { type: "profile", handedness: "right" });
  rooms.tick(0.1);
  expect(
    snapshot()?.players.find((player) => player.id === 8)?.handedness,
  ).toBe("right");
  rooms.disconnect(host);
  const resumed = peer();
  rooms.message(resumed, {
    type: "resume",
    protocol: PROTOCOL,
    code: h.room.code,
    token: h.token,
  });
  expect(
    session(resumed).room.members.find((member) => member.id === h.id)
      ?.handedness,
  ).toBe("right");
});

test("curl and reverse curl turn in mirrored directions for left-handed network players", () => {
  for (const curl of [-1, 1]) {
    const turns: number[] = [];
    for (const handedness of ["right", "left"] as const) {
      const match = createNetworkMatch();
      match.state.faceoff = undefined;
      match.roster([
        {
          id: crypto.randomUUID(),
          name: "Player 1",
          playerId: 8,
          connected: true,
          handedness,
        },
      ]);
      const player = match.state.players.find(
        (candidate) => candidate.id === 8,
      );
      if (!player) throw new Error("Player missing");
      const yaw = player.yaw;
      for (let sequence = 1; sequence <= 10; sequence++) {
        match.input(8, sequence, { ...freshControls(), curl });
        match.advance(0.1);
      }
      turns.push(player.yaw - yaw);
      expect(Math.sign(player.yaw - yaw)).toBe(
        handedness === "left" ? curl : -curl,
      );
    }
    expect(turns[0]).toBeCloseTo(-(turns[1] ?? 0), 5);
  }
});
