import { expect, test } from "bun:test";
import { PROTOCOL, serverMessageSchema } from "../src/multiplayer/protocol";
import { parseSnapshot } from "../src/multiplayer/snapshot";
import { startRoomServer } from "./server";

test("real WebSocket handshake enforces origins and answers application pings", async () => {
  const server = startRoomServer({
    port: 0,
    hostname: "127.0.0.1",
    region: "test-us",
    origins: [""],
  });
  try {
    const health = await fetch(`http://127.0.0.1:${server.port}/health`);
    expect((await health.json()).region).toBe("test-us");
    const blocked = await fetch(`http://127.0.0.1:${server.port}/socket`, {
      headers: { Origin: "https://wrong.example" },
    });
    expect(blocked.status).toBe(403);
    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(`ws://127.0.0.1:${server.port}/socket`);
      const timeout = setTimeout(() => {
        socket.close();
        reject(new Error("WebSocket test timed out"));
      }, 3000);
      socket.onopen = (): void =>
        socket.send(
          JSON.stringify({ type: "ping", nonce: 123, protocol: PROTOCOL }),
        );
      socket.onmessage = (event): void => {
        try {
          expect(JSON.parse(String(event.data))).toEqual({
            type: "pong",
            nonce: 123,
            region: "test-us",
          });
          clearTimeout(timeout);
          socket.close();
          resolve();
        } catch (error) {
          clearTimeout(timeout);
          socket.close();
          reject(error);
        }
      };
      socket.onerror = (): void => {
        clearTimeout(timeout);
        reject(new Error("WebSocket failed"));
      };
    });
  } finally {
    await server.stop(true);
  }
});

test("idle server wakes for a match and sends decodable compact snapshots", async () => {
  const server = startRoomServer({
    port: 0,
    hostname: "127.0.0.1",
    region: "test",
    origins: [""],
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(`ws://127.0.0.1:${server.port}/socket`);
      const finish = (error?: Error): void => {
        clearTimeout(timeout);
        socket.close();
        if (error) reject(error);
        else resolve();
      };
      const timeout = setTimeout(
        () => finish(new Error("No match snapshot")),
        3000,
      );
      socket.onopen = (): void =>
        socket.send(
          JSON.stringify({
            type: "create",
            protocol: PROTOCOL,
            mode: "online",
            name: "Test",
            team: 0,
          }),
        );
      socket.onmessage = (event): void => {
        try {
          const message = serverMessageSchema.parse(
            JSON.parse(String(event.data)),
          );
          if (message.type === "session")
            socket.send(JSON.stringify({ type: "start" }));
          if (message.type === "room" && message.room.phase === "loading")
            socket.send(
              JSON.stringify({
                type: "loaded",
                loadId: message.room.loadId,
                ok: true,
              }),
            );
          if (message.type === "snapshot") {
            expect(parseSnapshot(message.state)?.players).toHaveLength(12);
            expect(String(event.data).length).toBeLessThan(16000);
            finish();
          }
        } catch (error) {
          finish(error instanceof Error ? error : new Error(String(error)));
        }
      };
      socket.onerror = (): void => finish(new Error("WebSocket failed"));
    });
  } finally {
    await server.stop(true);
  }
});
