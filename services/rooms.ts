import { randomInt } from "node:crypto";
import {
  createNetworkMatch,
  createRoomSimulation,
  type NetworkMatch,
} from "../src/multiplayer/match";
import { customPlayerName } from "../src/multiplayer/names";
import type {
  ClientMessage,
  RoomView,
  ServerMessage,
} from "../src/multiplayer/protocol";
import { packSnapshot, parseSnapshot } from "../src/multiplayer/snapshot";
import type { Simulation } from "../src/types";

type Peer = { send: (message: ServerMessage) => void; close: () => void };
type Member = RoomView["members"][number] & {
  token: string;
  peer: Peer | undefined;
  expires: number;
  defaultName: string;
};
type Room = Omit<RoomView, "members"> & {
  members: Member[];
  match?: NetworkMatch;
  checkpoint?: Simulation;
  checkpointAt: number;
  created: number;
  nextPlayerNumber: number;
};
export const createRooms = (
  region: string,
  now: () => number = Date.now,
): {
  message: (peer: Peer, message: ClientMessage) => void;
  disconnect: (peer: Peer) => void;
  tick: (seconds: number) => void;
  count: () => number;
  running: () => boolean;
} => {
  const rooms = new Map<string, Room>();
  let nextCleanup = 0;
  const membership = new Map<Peer, { room: Room; member: Member }>();
  const view = (room: Room): RoomView => ({
    code: room.code,
    region: room.region,
    mode: room.mode,
    phase: room.phase,
    hostId: room.hostId,
    teamSize: room.teamSize,
    swimTurn: room.swimTurn,
    difficulty: room.difficulty,
    members: room.members.map(({ id, name, playerId, peer, handedness }) => ({
      id,
      name,
      playerId,
      connected: Boolean(peer),
      handedness,
    })),
  });
  const broadcast = (room: Room, message: ServerMessage): void => {
    for (const member of room.members) member.peer?.send(message);
  };
  const updated = (room: Room): void => {
    const snapshot = view(room);
    room.match?.roster(snapshot.members);
    broadcast(room, { type: "room", room: snapshot });
  };
  const error = (peer: Peer, message: string, fatal = false): void =>
    peer.send({ type: "error", message, fatal });
  const remove = (room: Room, member: Member): void => {
    if (member.peer) membership.delete(member.peer);
    room.members = room.members.filter((m) => m !== member);
    if (room.members.length === 0) {
      rooms.delete(room.code);
      return;
    }
    if (room.hostId === member.id) {
      if (room.mode === "lan" && room.phase === "playing") {
        broadcast(room, {
          type: "error",
          message:
            "The phone hosting this match left. Create a new room to play again.",
          fatal: true,
        });
        for (const other of room.members)
          if (other.peer) membership.delete(other.peer);
        rooms.delete(room.code);
        return;
      }
      room.hostId =
        room.members.find((m) => m.peer)?.id ?? room.members[0]?.id ?? "";
    }
    updated(room);
  };
  const attach = (peer: Peer, room: Room, member: Member): void => {
    const previous = member.peer;
    if (previous) {
      membership.delete(previous);
      previous.close();
    }
    member.peer = peer;
    member.connected = true;
    member.expires = 0;
    membership.set(peer, { room, member });
    peer.send({
      type: "session",
      id: member.id,
      token: member.token,
      room: view(room),
    });
    if (room.match)
      peer.send({
        type: "snapshot",
        state: packSnapshot(room.match.state),
        acknowledged: room.match.acknowledged,
      });
    if (room.checkpoint)
      peer.send({ type: "snapshot", state: room.checkpoint });
    updated(room);
  };
  const freeSeat = (room: Room, member: Member): number | undefined =>
    ([0, 1] as const)
      .flatMap((team): number[] =>
        Array.from({ length: room.teamSize }, (_, i): number => team * 6 + i),
      )
      .find(
        (id) =>
          !room.members.some(
            (other) => other !== member && other.playerId === id,
          ),
      );
  const join = (
    peer: Peer,
    room: Room,
    name: string | undefined,
    requestedTeam?: 0 | 1,
    handedness: "left" | "right" = "right",
  ): void => {
    const otters = room.members.filter((member) => member.playerId < 6).length;
    const team =
      requestedTeam ?? (otters <= room.members.length - otters ? 0 : 1);
    const playerId = Array.from(
      { length: room.teamSize },
      (_, i) => team * 6 + i,
    ).find((id) => !room.members.some((m) => m.playerId === id));
    if (playerId === undefined) {
      error(
        peer,
        requestedTeam === undefined
          ? "This room is full."
          : "That team is full. Choose the other team.",
      );
      return;
    }
    const defaultName = `Player ${room.nextPlayerNumber++}`;
    const member: Member = {
      id: crypto.randomUUID(),
      token: crypto.randomUUID(),
      name: customPlayerName(name) ?? defaultName,
      defaultName,
      handedness,
      playerId,
      connected: true,
      peer: undefined,
      expires: 0,
    };
    room.members.push(member);
    if (!room.hostId) room.hostId = member.id;
    attach(peer, room, member);
  };
  return {
    count: (): number => rooms.size,
    running: (): boolean => {
      for (const room of rooms.values())
        if (
          room.match &&
          !room.match.state.finished &&
          room.members.some((member) => member.peer)
        )
          return true;
      return false;
    },
    message: (peer, message): void => {
      if (message.type === "ping") {
        peer.send({ type: "pong", nonce: message.nonce, region });
        return;
      }
      const current = membership.get(peer);
      if (
        message.type === "create" ||
        message.type === "join" ||
        message.type === "resume"
      ) {
        if (current) {
          error(peer, "Leave your current room first.");
          return;
        }
        if (message.type === "resume") {
          const room = rooms.get(message.code);
          const member = room?.members.find(
            (m) =>
              m.token === message.token && (!m.expires || m.expires > now()),
          );
          if (!room || !member) {
            error(
              peer,
              "This room or reconnect reservation expired. Join again.",
              true,
            );
            return;
          }
          attach(peer, room, member);
          return;
        }
        if (message.type === "join") {
          const room = rooms.get(message.code);
          if (!room) {
            error(
              peer,
              "Room not found in this region. Check the code and location.",
            );
            return;
          }
          join(peer, room, message.name, message.team, message.handedness);
          return;
        }
        if (rooms.size >= 32) {
          error(peer, "This region is full. Try another region.");
          return;
        }
        const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let code = "";
        do {
          code = Array.from({ length: 6 }, () =>
            alphabet.at(randomInt(alphabet.length)),
          ).join("");
        } while (rooms.has(code));
        const room: Room = {
          code,
          region,
          mode: message.mode,
          phase: "waiting",
          hostId: "",
          teamSize: 6,
          swimTurn: 3,
          difficulty: "medium",
          members: [],
          checkpointAt: 0,
          created: now(),
          nextPlayerNumber: 1,
        };
        rooms.set(code, room);
        join(peer, room, message.name, message.team, message.handedness);
        return;
      }
      if (!current) {
        error(peer, "Join a room first.");
        return;
      }
      const { room, member } = current;
      if (message.type === "leave") {
        remove(room, member);
        return;
      }
      if (message.type === "profile") {
        if (
          room.phase !== "waiting" &&
          (message.name !== undefined || message.playerId !== undefined)
        ) {
          error(peer, "Team and position are locked once the match starts.");
          return;
        }
        if (
          message.playerId !== undefined &&
          message.playerId % 6 >= room.teamSize
        ) {
          error(peer, "That position is not part of this match size.");
          return;
        }
        if (
          message.playerId !== undefined &&
          room.members.some(
            (other) =>
              other.id !== member.id && other.playerId === message.playerId,
          )
        ) {
          error(peer, "That position was just taken. Choose another spot.");
          return;
        }
        if (message.handedness !== undefined)
          member.handedness = message.handedness;
        if (message.name !== undefined)
          member.name = customPlayerName(message.name) ?? member.defaultName;
        if (message.playerId !== undefined) member.playerId = message.playerId;
        updated(room);
        return;
      }
      if (message.type === "start") {
        if (member.id !== room.hostId) {
          error(peer, "Only the room creator can start.");
          return;
        }
        if (room.phase !== "waiting") return;
        room.phase = "playing";
        if (room.mode === "online")
          room.match = createNetworkMatch(createRoomSimulation(room));
        updated(room);
        return;
      }
      if (message.type === "settings") {
        if (member.id !== room.hostId) {
          error(peer, "Only the room creator can change the match settings.");
          return;
        }
        if (room.phase !== "waiting") return;
        if (message.teamSize !== undefined) {
          room.teamSize = message.teamSize;
          for (const other of room.members)
            if (other.playerId % 6 >= room.teamSize)
              other.playerId = freeSeat(room, other) ?? other.playerId;
        }
        if (message.swimTurn !== undefined) room.swimTurn = message.swimTurn;
        if (message.difficulty !== undefined)
          room.difficulty = message.difficulty;
        updated(room);
        return;
      }
      if (message.type === "input") {
        room.match?.input(
          member.playerId,
          message.sequence,
          message.controls,
          message.duration,
        );
        return;
      }
      if (message.type === "signal") {
        if (room.mode !== "lan") return;
        const target = room.members.find((m) => m.id === message.to);
        if (target && (member.id === room.hostId || target.id === room.hostId))
          target.peer?.send({
            type: "signal",
            from: member.id,
            signal: message.signal,
          });
        return;
      }
      if (
        message.type === "checkpoint" &&
        room.mode === "lan" &&
        room.phase === "playing" &&
        room.hostId === member.id &&
        now() - room.checkpointAt >= 900
      ) {
        const state = parseSnapshot(message.state);
        if (state) {
          room.checkpoint = state;
          room.checkpointAt = now();
        }
      }
    },
    disconnect: (peer): void => {
      const current = membership.get(peer);
      if (!current) return;
      membership.delete(peer);
      current.member.peer = undefined;
      current.member.connected = false;
      current.member.expires = now() + 30000;
      updated(current.room);
    },
    tick: (seconds): void => {
      const time = now();
      const cleanup = time >= nextCleanup;
      if (cleanup) nextCleanup = time + 1000;
      for (const room of rooms.values()) {
        if (cleanup)
          for (const member of [...room.members])
            if (member.expires && member.expires <= time) remove(room, member);
        if (!rooms.has(room.code)) continue;
        if (cleanup && time - room.created > 2 * 60 * 60 * 1000) {
          broadcast(room, {
            type: "error",
            message: "Room expired. Create a new room.",
            fatal: true,
          });
          for (const member of room.members)
            if (member.peer) membership.delete(member.peer);
          rooms.delete(room.code);
          continue;
        }
        if (room.members.some((m) => m.peer) && room.match?.advance(seconds))
          broadcast(room, {
            type: "snapshot",
            state: packSnapshot(room.match.state),
            acknowledged: room.match.acknowledged,
          });
      }
    },
  };
};
