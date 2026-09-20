import { isIP } from "node:net";
import {
  clientMessageSchema,
  decodeMessage,
  type ServerMessage,
} from "../src/multiplayer/protocol";
import { stringifySnapshot } from "../src/multiplayer/snapshot";
import { createBudget, createConnectionLimits, LIMITS } from "./limits";
import { createRooms } from "./rooms";
export const startRoomServer = (options: {
  port: number;
  hostname?: string;
  region: string;
  origins: readonly string[];
  trustProxy?: boolean;
}): {
  url: URL;
  port: number | undefined;
  stop: (close?: boolean) => Promise<void>;
} => {
  const rooms = createRooms(options.region);
  const limits = createConnectionLimits();
  const encoded = new WeakMap<ServerMessage, string>();
  const encode = (message: ServerMessage): string => {
    const cached = encoded.get(message);
    if (cached !== undefined) return cached;
    const text =
      message.type === "snapshot" &&
      message.state &&
      typeof message.state === "object" &&
      "wire" in message.state
        ? stringifySnapshot(message)
        : JSON.stringify(message);
    encoded.set(message, text);
    return text;
  };
  type SocketData = {
    peer: { send: (message: ServerMessage) => void; close: () => void };
    release: () => void;
    admit: (creating: boolean) => boolean;
    messages: ReturnType<typeof createBudget>;
    bytes: ReturnType<typeof createBudget>;
    actions: ReturnType<typeof createBudget>;
    invalid: number;
  };
  const server = Bun.serve<SocketData>({
    hostname: options.hostname ?? "0.0.0.0",
    port: options.port,
    fetch: (request, server): Response | undefined => {
      const url = new URL(request.url);
      if (request.method !== "GET")
        return new Response("Method not allowed", {
          status: 405,
          headers: { Allow: "GET" },
        });
      if (url.pathname === "/health")
        return Response.json(
          { ok: true, region: options.region, rooms: rooms.count() },
          { headers: { "Cache-Control": "no-store" } },
        );
      if (url.pathname !== "/socket")
        return new Response("Not found", { status: 404 });
      if (!options.origins.includes(request.headers.get("origin") ?? ""))
        return new Response("Origin not allowed", { status: 403 });
      const forwarded = request.headers.get("x-real-ip") ?? "";
      const address =
        options.trustProxy && isIP(forwarded)
          ? forwarded
          : (server.requestIP(request)?.address ?? "unknown");
      const lease = limits.acquire(address);
      if (!lease)
        return new Response("Too many connections. Try again shortly.", {
          status: 429,
          headers: { "Retry-After": "10", "Cache-Control": "no-store" },
        });
      const data: SocketData = {
        ...lease,
        messages: createBudget(100, 1000),
        bytes: createBudget(256_000, 1000),
        actions: createBudget(20, 1000),
        invalid: 0,
        peer: { send: (): void => {}, close: (): void => {} },
      };
      if (server.upgrade(request, { data })) return undefined;
      lease.release();
      return new Response("WebSocket required", { status: 426 });
    },
    websocket: {
      maxPayloadLength: LIMITS.payloadBytes,
      backpressureLimit: LIMITS.bufferedBytes,
      closeOnBackpressureLimit: true,
      idleTimeout: 60,
      perMessageDeflate: { compress: "64KB", decompress: "16KB" },
      open: (socket): void => {
        socket.data.peer = {
          send: (message): void => {
            if (
              socket.readyState === 1 &&
              socket.getBufferedAmount() < LIMITS.bufferedBytes
            )
              socket.send(encode(message), message.type === "snapshot");
          },
          close: (): void => socket.close(4001, "Session replaced"),
        };
      },
      message: (socket, raw): void => {
        const data = socket.data;
        const bytes =
          typeof raw === "string" ? Buffer.byteLength(raw) : raw.byteLength;
        if (!data.messages() || !data.bytes(bytes)) {
          socket.close(1008, "Too many messages");
          return;
        }
        const message = clientMessageSchema.safeParse(
          decodeMessage(typeof raw === "string" ? raw : raw.toString()),
        );
        if (!message.success) {
          if (++data.invalid >= 4) {
            socket.close(1008, "Invalid messages");
            return;
          }
          data.peer.send({
            type: "error",
            message:
              "Invalid message or incompatible game version. Reload the game.",
          });
          return;
        }
        const type = message.data.type;
        if (type === "create" || type === "join" || type === "resume") {
          if (!data.admit(type === "create")) {
            data.peer.send({
              type: "error",
              message: "Too many room attempts. Wait a minute and try again.",
              fatal: true,
            });
            socket.close(1008, "Room rate limit");
            return;
          }
        }
        if (["profile", "start", "leave"].includes(type) && !data.actions()) {
          socket.close(1008, "Too many room changes");
          return;
        }
        rooms.message(data.peer, message.data);
        if (!running && rooms.running()) schedule(true);
      },
      close: (socket): void => {
        socket.data.release();
        rooms.disconnect(socket.data.peer);
      },
    },
  });
  let previous = performance.now();
  let running = false;
  let timer: ReturnType<typeof setTimeout>;
  const schedule = (wake = false): void => {
    clearTimeout(timer);
    if (wake) previous = performance.now();
    running = rooms.running();
    timer = setTimeout(
      (): void => {
        const now = performance.now();
        rooms.tick((now - previous) / 1000);
        previous = now;
        schedule();
      },
      running ? 1000 / 60 : 1000,
    );
    timer.unref();
  };
  schedule();
  return {
    url: server.url,
    port: server.port,
    stop: async (close): Promise<void> => {
      clearTimeout(timer);
      await server.stop(close);
    },
  };
};
if (import.meta.main) {
  const origins = (
    process.env.ALLOWED_ORIGINS ?? "http://localhost:3200,http://127.0.0.1:3200"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (process.env.NODE_ENV === "production" && !process.env.ALLOWED_ORIGINS)
    throw new Error("ALLOWED_ORIGINS is required in production");
  const server = startRoomServer({
    port: Number(process.env.PORT ?? 3210),
    region: process.env.ROOM_REGION ?? "local",
    origins,
    trustProxy: Boolean(
      process.env.RAILWAY_ENVIRONMENT_ID ?? process.env.TRUST_PROXY,
    ),
  });
  console.info(`Room server listening at ${server.url}`);
}
