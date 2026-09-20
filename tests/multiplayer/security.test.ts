import { expect, spyOn, test } from "bun:test";
import {
  createBudget,
  createConnectionLimits,
  LIMITS,
} from "../../services/limits";
import { startRoomServer } from "../../services/server";
import { connectRoom } from "../../src/multiplayer/client";
import {
  clientMessageSchema,
  decodeMessage,
  PROTOCOL,
} from "../../src/multiplayer/protocol";
import { freshControls, type Simulation } from "../../src/types";

test("room attempt limits survive reconnect and refill without unbounded bursts", () => {
  let now = 0;
  const limits = createConnectionLimits(() => now);
  for (let i = 0; i < 6; i++) {
    const lease = limits.acquire("shared-wifi");
    expect(lease?.admit(true)).toBe(true);
    lease?.release();
  }
  const denied = limits.acquire("shared-wifi");
  expect(denied?.admit(true)).toBe(false);
  expect(denied?.admit(false)).toBe(true);
  denied?.release();
  now += 10_000;
  const resumed = limits.acquire("shared-wifi");
  expect(resumed?.admit(true)).toBe(true);
  resumed?.release();
});

test("connection caps allow a full LAN room and release exactly once", () => {
  const limits = createConnectionLimits(() => 0);
  const leases = Array.from({ length: LIMITS.connectionsPerAddress }, () =>
    limits.acquire("wifi"),
  );
  expect(leases.every(Boolean)).toBe(true);
  expect(limits.acquire("wifi")).toBeUndefined();
  leases.at(0)?.release();
  leases.at(0)?.release();
  expect(limits.acquire("wifi")).toBeDefined();
  expect(limits.acquire("wifi")).toBeUndefined();
  expect(limits.acquire("another-network")).toBeDefined();
});

test("byte budgets reject large bursts and never accumulate beyond capacity", () => {
  let now = 0;
  const consume = createBudget(256_000, 1000, () => now);
  expect(consume(128_000)).toBe(true);
  expect(consume(128_000)).toBe(true);
  expect(consume()).toBe(false);
  now = 10_000;
  expect(consume(256_001)).toBe(false);
  expect(consume(256_000)).toBe(true);
});

test("malformed WebSocket messages close the connection and HTTP writes are rejected", async () => {
  const server = startRoomServer({
    port: 0,
    hostname: "127.0.0.1",
    region: "test",
    origins: [""],
  });
  try {
    const response = await fetch(`http://127.0.0.1:${server.port}/health`, {
      method: "POST",
    });
    expect(response.status).toBe(405);
    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(`ws://127.0.0.1:${server.port}/socket`);
      const timeout = setTimeout(() => {
        socket.close();
        reject(new Error("Expected policy close"));
      }, 3000);
      socket.onopen = (): void => {
        for (let i = 0; i < 4; i++) socket.send("invalid");
      };
      socket.onclose = (event): void => {
        clearTimeout(timeout);
        try {
          expect(event.code).toBe(1008);
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      socket.onerror = (): void => {
        clearTimeout(timeout);
        reject(new Error("Socket failed"));
      };
    });
  } finally {
    await server.stop(true);
  }
});

test("pause cancellation drops unsent actions and replaced sessions do not reconnect", () => {
  const original = globalThis.WebSocket;
  class Socket {
    static OPEN = 1;
    static instance: Socket;
    readyState = 1;
    bufferedAmount = 0;
    sent: string[] = [];
    onmessage?: (event: { data: string }) => void;
    onclose?: (event: { code: number }) => void;
    constructor() {
      Socket.instance = this;
    }
    send(text: string): void {
      this.sent.push(text);
    }
    close(): void {}
  }
  Object.assign(globalThis, { WebSocket: Socket });
  let ended = false;
  const session = connectRoom(
    { id: "test", label: "Test", url: "ws://localhost/socket" },
    { type: "create", protocol: PROTOCOL, name: "Test", mode: "online" },
    {
      room: (): void => {},
      state: (): void => {},
      status: (): void => {},
      ended: (): void => {
        ended = true;
      },
    },
  );
  try {
    const id = crypto.randomUUID();
    Socket.instance.onmessage?.({
      data: JSON.stringify({
        type: "session",
        id,
        token: crypto.randomUUID(),
        room: {
          code: "ABC234",
          region: "test",
          mode: "online",
          phase: "playing",
          hostId: id,
          teamSize: 6,
          members: [{ id, name: "Test", playerId: 0, connected: true }],
        },
      }),
    });
    session.input({
      ...freshControls(),
      shot: 0.8,
      dive: true,
      knockdown: true,
    });
    session.cancelInput();
    const input = clientMessageSchema.parse(
      decodeMessage(Socket.instance.sent.at(-1) ?? ""),
    );
    expect(input.type).toBe("input");
    if (input.type !== "input") throw new Error("Missing input");
    expect(input.controls.shot).toBe(0);
    expect(input.controls.dive).toBe(false);
    expect(input.controls.knockdown).toBe(false);
    Socket.instance.onclose?.({ code: 4001 });
    expect(ended).toBe(true);
  } finally {
    session.leave();
    Object.assign(globalThis, { WebSocket: original });
  }
});

test("LAN host renders authoritative simulation every frame without waiting for snapshot broadcasts", () => {
  const original = globalThis.WebSocket;
  let now = 1000;
  const clock = spyOn(performance, "now").mockImplementation(() => now);
  class Socket {
    static OPEN = 1;
    static instance: Socket;
    readyState = 1;
    bufferedAmount = 0;
    onmessage?: (event: { data: string }) => void;
    constructor() {
      Socket.instance = this;
    }
    send(): void {}
    close(): void {}
  }
  Object.assign(globalThis, { WebSocket: Socket });
  const states: Simulation[] = [];
  const session = connectRoom(
    { id: "test", label: "Test", url: "ws://localhost/socket" },
    { type: "create", protocol: PROTOCOL, mode: "lan" },
    {
      room: (): void => {},
      state: (state): void => {
        states.push(state);
      },
      status: (): void => {},
      ended: (): void => {},
    },
  );
  try {
    const id = crypto.randomUUID();
    Socket.instance.onmessage?.({
      data: JSON.stringify({
        type: "session",
        id,
        token: crypto.randomUUID(),
        room: {
          code: "ABC234",
          region: "test",
          mode: "lan",
          phase: "playing",
          hostId: id,
          teamSize: 6,
          members: [{ id, name: "Player 1", playerId: 8, connected: true }],
        },
      }),
    });
    const initialYaw = states.at(-1)?.players.at(0)?.yaw ?? 0;
    for (let i = 0; i < 30; i++) {
      session.input({ ...freshControls(), yawDelta: 0.01 }, 1 / 60);
      now += 1000 / 60;
      session.frame();
      expect(session.alpha()).toBeGreaterThanOrEqual(0);
      expect(session.alpha()).toBeLessThan(1);
    }
    expect(states).toHaveLength(31);
    expect(new Set(states.map((state) => state.time)).size).toBe(31);
    expect(states.at(-1)?.players.at(0)?.id).toBe(8);
    expect(states.at(-1)?.players.at(0)?.yaw).toBeCloseTo(initialYaw + 0.3);
  } finally {
    session.leave();
    clock.mockRestore();
    Object.assign(globalThis, { WebSocket: original });
  }
});
