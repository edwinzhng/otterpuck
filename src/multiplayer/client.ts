import { probeTurnCap, readTurnCap } from "../simulation";
import {
  type Controls,
  freshControls,
  type Simulation,
  type TeamSize,
} from "../types";
import { createSnapshotInterpolation } from "./interpolation";
import {
  createNetworkMatch,
  createRoomSimulation,
  type NetworkMatch,
  type YawPayout,
} from "./match";
import { createPeers } from "./peers";
import { createMovementPrediction } from "./prediction";
import {
  type ClientMessage,
  clientMessageSchema,
  decodeMessage,
  PROTOCOL,
  type RoomView,
  serverMessageSchema,
} from "./protocol";
import type { Region } from "./regions";
import { localView, packSnapshot, parseSnapshot } from "./snapshot";
// What a turn costs between the mouse and the room, sampled over a second:
// how much yaw the snapshots pull back, how much of it the turn cap throws
// away, and how far behind the room's acknowledgement is.
// Whether a message goes out on its own timer or on the frame whose mouse
// movement it carries.
export type InputCadence = "timer" | "frame";
export type NetworkStats = {
  sends: number;
  snapshots: number;
  applied: number;
  missed: number;
  short: number;
  clipped: number;
  discarded: number;
  waiting: number;
  payout: YawPayout;
  cadence: InputCadence;
};
export type Session = {
  start: () => void;
  settings: (teamSize: TeamSize) => void;
  profile: (
    change: Omit<Extract<ClientMessage, { type: "profile" }>, "type">,
  ) => void;
  leave: () => void;
  input: (controls: Controls, seconds?: number) => void;
  cancelInput: () => void;
  frame: () => void;
  alpha: () => number;
  room: () => RoomView | undefined;
  debug: (on: boolean) => void;
  payout: (mode: YawPayout) => void;
  cadence: (mode: InputCadence) => void;
  stats: () => NetworkStats | undefined;
};
// Input goes out at the rate the room advances. At half that, a message spans
// two advances, so the room has applied only part of it while the client still
// replays all of it over every snapshot: the turn rate wobbles for as long as
// the turn lasts, then unwinds backwards once the mouse stops.
const SEND_HZ = 60;
export const connectRoom = (
  region: Region,
  request: ClientMessage,
  callbacks: {
    room: (room: RoomView, self: string) => void;
    state: (state: Simulation) => void;
    status: (text: string) => void;
    rejected?: (message: string) => void;
    ended: () => void;
    ping?: (milliseconds: number | undefined) => void;
  },
): Session => {
  const prediction = createMovementPrediction();
  const interpolation = createSnapshotInterpolation();
  let socket: WebSocket;
  let room: RoomView | undefined;
  let self = "";
  let token = "";
  let stopped = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let attempts = 0;
  let sequence = Date.now() * 1000;
  let view: Simulation | undefined;
  let match: NetworkMatch | undefined;
  let peers: ReturnType<typeof createPeers> | undefined;
  let controls = freshControls();
  let hostAdvancedAt = performance.now();
  let hostFrameAt = performance.now();
  let checkpointAt = 0;
  let lastReceived = performance.now();
  let waitingForUpdates = false;
  let lastPong = performance.now();
  let pingAt = 0;
  // When the last input went out, so each message can report the interval its
  // accumulated yaw was made over rather than leaving the room to guess.
  let sentAt = performance.now();
  let peerPingAt = 0;
  let peerPongAt = 0;
  let payout: YawPayout = "queued";
  let cadence: InputCadence = "timer";
  let debugging = false;
  const counters = {
    sends: 0,
    snapshots: 0,
    applied: 0,
    missed: 0,
    short: 0,
    since: performance.now(),
  };
  let measured: NetworkStats | undefined;
  const sample = (now: number): void => {
    if (!debugging || now - counters.since < 1000) return;
    const seconds = (now - counters.since) / 1000;
    const cap = readTurnCap();
    measured = {
      sends: counters.sends / seconds,
      snapshots: counters.snapshots / seconds,
      applied: counters.applied / seconds,
      missed: counters.snapshots > 0 ? counters.missed / counters.snapshots : 0,
      short: counters.snapshots > 0 ? counters.short / counters.snapshots : 0,
      clipped: cap.steps > 0 ? cap.clipped / cap.steps : 0,
      discarded: cap.discarded / seconds,
      waiting: prediction.waiting(),
      payout,
      cadence,
    };
    Object.assign(counters, {
      sends: 0,
      snapshots: 0,
      applied: 0,
      missed: 0,
      short: 0,
      since: now,
    });
  };
  const send = (message: ClientMessage): void => {
    if (socket?.readyState === WebSocket.OPEN) {
      if (socket.bufferedAmount > 64000) {
        socket.close();
        return;
      }
      socket.send(JSON.stringify(message));
    }
  };
  const apply = (
    value: unknown,
    acknowledged?: Record<string, number>,
  ): void => {
    const parsed = parseSnapshot(value);
    const player = room?.members.find((m) => m.id === self);
    if (!parsed || !player || (view && parsed.time < view.time)) return;
    const previous = view;
    interpolation.push(parsed, performance.now());
    view = localView(parsed, player.playerId);
    const reconciliation = prediction.reconcile(
      view,
      acknowledged?.[player.playerId] ?? (acknowledged ? -1 : undefined),
      previous,
    );
    counters.applied += reconciliation.applied;
    counters.missed += reconciliation.missed;
    counters.short += reconciliation.short;
    counters.snapshots += 1;
    lastReceived = performance.now();
    if (waitingForUpdates) {
      waitingForUpdates = false;
      callbacks.status("Match connected");
    }
    callbacks.state(view);
  };
  const publishHost = (): void => {
    const member = room?.members.find((member) => member.id === self);
    if (!match || !member) return;
    view = {
      ...match.state,
      players: [...match.state.players].sort(
        (a, b) =>
          Number(b.id === member.playerId) - Number(a.id === member.playerId),
      ),
    };
    lastReceived = performance.now();
    callbacks.state(view);
  };
  const advanceHost = (now: number): void => {
    if (!match) return;
    const due = match.advance((now - hostAdvancedAt) / 1000);
    hostAdvancedAt = now;
    if (due)
      peers?.broadcast({
        type: "snapshot",
        state: packSnapshot(match.state),
        acknowledged: match.acknowledged,
      });
    publishHost();
  };
  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    clearTimeout(reconnectTimer);
    peers?.close();
    socket?.close();
    try {
      sessionStorage.removeItem("otterpuck-room");
    } catch {}
  };
  const connect = (): void => {
    if (stopped) return;
    socket = new WebSocket(region.url);
    socket.onopen = (): void => {
      lastPong = performance.now();
      callbacks.status(token ? "Reconnecting…" : "Connected to room service");
      send(
        token && room
          ? { type: "resume", protocol: PROTOCOL, code: room.code, token }
          : request,
      );
    };
    socket.onmessage = (event): void => {
      const result = serverMessageSchema.safeParse(
        decodeMessage(String(event.data)),
      );
      if (!result.success) return;
      const message = result.data;
      if (message.type === "error") {
        callbacks.status(message.message);
        if (!room) {
          stop();
          callbacks.rejected?.(message.message);
          return;
        }
        if (message.fatal || !room) {
          stop();
          callbacks.ended();
        }
        return;
      }
      if (message.type === "pong") {
        lastPong = performance.now();
        if (room?.mode !== "lan")
          callbacks.ping?.(Math.round(Math.max(0, lastPong - message.nonce)));
        return;
      }
      if (message.type === "session") {
        self = message.id;
        token = message.token;
        attempts = 0;
        try {
          sessionStorage.setItem(
            "otterpuck-room",
            JSON.stringify({
              region: region.id,
              code: message.room.code,
              token,
            }),
          );
        } catch {}
        peers?.close();
        peers = undefined;
      }
      if (message.type === "session" || message.type === "room") {
        if (room?.phase !== "playing" && message.room.phase === "playing")
          lastReceived = performance.now();
        room = message.room;
        callbacks.room(room, self);
        if (room.mode === "lan") {
          if (!peers)
            peers = createPeers(
              self,
              (to, signal) => send({ type: "signal", to, signal }),
              (from, data): void => {
                if (!room) return;
                if (self === room.hostId) {
                  const parsed = clientMessageSchema.safeParse(data);
                  const member = room.members.find(
                    (m) => m.id === from && m.connected,
                  );
                  if (member && parsed.success && parsed.data.type === "input")
                    match?.input(
                      member.playerId,
                      parsed.data.sequence,
                      parsed.data.controls,
                      parsed.data.duration,
                    );
                } else if (
                  from === room.hostId &&
                  data &&
                  typeof data === "object" &&
                  "type" in data &&
                  data.type === "snapshot" &&
                  "state" in data
                ) {
                  const snapshot = serverMessageSchema.safeParse(data);
                  if (snapshot.success && snapshot.data.type === "snapshot")
                    apply(snapshot.data.state, snapshot.data.acknowledged);
                }
              },
              callbacks.status,
              (from, milliseconds): void => {
                if (from === room?.hostId) {
                  peerPongAt = performance.now();
                  callbacks.ping?.(milliseconds);
                }
              },
            );
          peers.sync(room);
          if (room.phase === "playing" && self === room.hostId && !match) {
            match = createNetworkMatch(createRoomSimulation(room.teamSize));
            hostAdvancedAt = performance.now();
          }
          match?.roster(room.members);
          if (match && self === room.hostId) publishHost();
          if (
            room.phase === "playing" &&
            !room.members.some((m) => m.id === room?.hostId && m.connected)
          )
            callbacks.status("Waiting for the host to reconnect…");
        }
        return;
      }
      if (message.type === "signal")
        void peers
          ?.signal(message.from, message.signal)
          .catch(() =>
            callbacks.status(
              "Could not connect directly. Rejoin the room to retry.",
            ),
          );
      if (message.type === "snapshot") {
        if (room?.mode === "lan" && self === room.hostId) {
          const state = parseSnapshot(message.state);
          if (state) {
            match = createNetworkMatch(state);
            match.roster(room.members);
            hostAdvancedAt = performance.now();
            publishHost();
          }
          return;
        }
        apply(message.state, message.acknowledged);
      }
    };
    socket.onerror = (): void =>
      callbacks.status("Could not reach the selected region.");
    socket.onclose = (event): void => {
      if (stopped) return;
      if (event.code === 4001 || event.code === 1008) {
        callbacks.status(
          event.code === 4001
            ? "This player session was opened in another tab."
            : "Connection limited. Wait a minute before rejoining.",
        );
        stop();
        callbacks.ended();
        return;
      }
      if (!token || ++attempts > 8) {
        callbacks.status("Connection lost. Rejoin the room to try again.");
        stop();
        callbacks.ended();
        return;
      }
      callbacks.status("Connection lost. Reconnecting…");
      reconnectTimer = setTimeout(connect, Math.min(500 * 2 ** attempts, 4000));
    };
  };
  // The yaw in a message is made frame by frame, but a timer's windows do not
  // line up with the frames that made it: at 55fps against a 60Hz timer some
  // messages carry two frames of mouse movement and some carry none, and the
  // room pays each out over the window it reports rather than the time the
  // movement took. Sending on the frame that made it keeps the two together.
  const dispatchInput = (now: number, seconds?: number): void => {
    const member = room?.members.find((m) => m.id === self);
    if (!room || !member) return;
    const input: ClientMessage = {
      type: "input",
      sequence: ++sequence,
      controls,
      // Capped to what the protocol accepts: a throttled timer in a background
      // tab can leave a gap far longer than any interval worth crediting, and
      // the room would reject the whole message over it.
      duration: Math.min(seconds ?? (now - sentAt) / 1000, 0.5),
    };
    sentAt = now;
    counters.sends += 1;
    if (room.mode === "online") send(input);
    else if (self === room.hostId && match) {
      match.input(member.playerId, input.sequence, controls, input.duration);
      if (now - hostFrameAt > 100) advanceHost(now);
      if (now - checkpointAt > 1000) {
        checkpointAt = now;
        send({ type: "checkpoint", state: match.state });
      }
    } else peers?.send(room.hostId, input);
    controls = {
      ...controls,
      yawDelta: 0,
      shot: 0,
      dive: false,
      knockdown: false,
    };
  };
  const timer = setInterval((): void => {
    const now = performance.now();
    sample(now);
    if (socket?.readyState === WebSocket.OPEN && now - pingAt > 2000) {
      pingAt = now;
      send({ type: "ping", nonce: now });
    }
    if (socket?.readyState === WebSocket.OPEN && now - lastPong > 15000)
      socket.close();
    if (room?.mode === "lan" && now - peerPingAt > 2000) {
      peerPingAt = now;
      if (room.hostId === self) callbacks.ping?.(0);
      else {
        if (now - peerPongAt > 4500) callbacks.ping?.(undefined);
        peers?.ping(room.hostId);
      }
    }
    if (room?.phase !== "playing" || view?.finished) {
      // Nothing is being sent, so the next message must not report the whole
      // lobby as the interval it accumulated over.
      sentAt = now;
      return;
    }
    if (cadence === "timer") dispatchInput(now);
    if (
      now - lastReceived > 3000 &&
      !(room.mode === "lan" && self === room.hostId) &&
      !waitingForUpdates
    ) {
      waitingForUpdates = true;
      callbacks.status("Waiting for match updates…");
    }
  }, 1000 / SEND_HZ);
  connect();
  return {
    start: (): void => send({ type: "start" }),
    settings: (teamSize): void => send({ type: "settings", teamSize }),
    profile: (change): void => send({ type: "profile", ...change }),
    leave: (): void => {
      send({ type: "leave" });
      stop();
    },
    cancelInput: (): void => {
      controls = {
        ...freshControls(),
        pitch: controls.pitch,
        backhand: controls.backhand,
      };
      if (room?.phase !== "playing") return;
      const input: ClientMessage = {
        type: "input",
        sequence: ++sequence,
        controls,
      };
      if (room.mode === "online") send(input);
      else if (self === room.hostId) {
        const member = room.members.find((member) => member.id === self);
        if (member) match?.input(member.playerId, input.sequence, controls);
      } else peers?.send(room.hostId, input);
    },
    frame: (): void => {
      const now = performance.now();
      if (room?.mode === "lan" && self === room.hostId && match) {
        hostFrameAt = now;
        advanceHost(now);
      } else {
        const member = room?.members.find((member) => member.id === self);
        if (view && member) interpolation.render(view, member.playerId, now);
      }
    },
    input: (next, seconds = 0): void => {
      if (room?.mode === "lan" && self === room.hostId && match) {
        const member = room.members.find((member) => member.id === self);
        if (member) match.input(member.playerId, ++sequence, next);
        controls = {
          ...next,
          yawDelta: 0,
          shot: 0,
          dive: false,
          knockdown: false,
        };
        next.yawDelta = 0;
        next.shot = 0;
        next.dive = false;
        next.knockdown = false;
        return;
      }
      if (view && performance.now() - lastReceived < 500)
        prediction.advance(view, next, seconds, sequence + 1);
      controls = {
        ...next,
        yawDelta: controls.yawDelta + next.yawDelta,
        shot: Math.max(controls.shot, next.shot),
        dive: controls.dive || next.dive,
        knockdown: controls.knockdown || next.knockdown,
      };
      next.yawDelta = 0;
      next.shot = 0;
      next.dive = false;
      next.knockdown = false;
      // The prediction above ran against the sequence this send is about to
      // claim, so the room and the client agree on what the message covers.
      if (
        cadence === "frame" &&
        room?.phase === "playing" &&
        !view?.finished &&
        seconds > 0
      )
        dispatchInput(performance.now(), seconds);
    },
    alpha: (): number =>
      room?.mode === "lan" && self === room.hostId ? (match?.alpha() ?? 1) : 1,
    room: () => room,
    debug: (on): void => {
      debugging = on;
      probeTurnCap(on);
      if (!on) measured = undefined;
      Object.assign(counters, {
        sends: 0,
        snapshots: 0,
        applied: 0,
        missed: 0,
        short: 0,
        since: performance.now(),
      });
    },
    // A LAN host runs the room itself, so its switch is a local call; everyone
    // else asks the server, which only listens when it was started for this.
    payout: (mode): void => {
      payout = mode;
      if (match) match.payout(mode);
      else if (room?.mode === "online")
        send({ type: "debug", yawPayout: mode });
    },
    cadence: (mode): void => {
      cadence = mode;
    },
    stats: () => measured,
  };
};
