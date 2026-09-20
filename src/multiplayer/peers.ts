import {
  type ClientMessage,
  decodeMessage,
  encodeClientMessage,
  type RoomView,
  type Signal,
  signalSchema,
} from "./protocol";
import { stringifySnapshot } from "./snapshot";

type Link = {
  connection: RTCPeerConnection;
  channel?: RTCDataChannel;
  queue: RTCIceCandidateInit[];
  pingAt?: number;
};
export const createPeers = (
  self: string,
  sendSignal: (to: string, signal: Signal) => void,
  receive: (from: string, data: unknown) => void,
  status: (message: string) => void,
  latency: (from: string, milliseconds: number) => void,
): {
  sync: (room: RoomView) => void;
  signal: (from: string, signal: Signal) => Promise<void>;
  send: (to: string, data: ClientMessage) => void;
  broadcast: (data: unknown) => void;
  close: () => void;
  ping: (to: string) => void;
} => {
  const links = new Map<string, Link>();
  let room: RoomView | undefined;
  const bind = (id: string, link: Link, channel: RTCDataChannel): void => {
    let windowAt = performance.now();
    let messages = 0;
    let bytes = 0;
    link.channel = channel;
    channel.onopen = (): void => status("Direct connection ready");
    channel.onclose = (): void =>
      status("Direct connection closed. Rejoin the room to retry.");
    channel.onmessage = (event): void => {
      const now = performance.now();
      if (now - windowAt >= 1000) {
        windowAt = now;
        messages = 0;
        bytes = 0;
      }
      if (typeof event.data !== "string" || event.data.length >= 128000) return;
      bytes += event.data.length;
      if (++messages > 100 || bytes > 512000) {
        channel.close();
        status(
          "A direct connection exceeded its traffic limit. Rejoin to retry.",
        );
        return;
      }
      const data = decodeMessage(event.data);
      if (
        data &&
        typeof data === "object" &&
        "type" in data &&
        "nonce" in data &&
        typeof data.nonce === "number" &&
        Number.isFinite(data.nonce)
      ) {
        if (data.type === "peer-ping") {
          if (channel.readyState === "open" && channel.bufferedAmount < 64000)
            channel.send(
              JSON.stringify({ type: "peer-pong", nonce: data.nonce }),
            );
          return;
        }
        if (data.type === "peer-pong") {
          if (data.nonce === link.pingAt)
            latency(
              id,
              Math.round(Math.max(0, performance.now() - data.nonce)),
            );
          return;
        }
      }
      receive(id, data);
    };
  };
  const create = (id: string): Link => {
    const connection = new RTCPeerConnection({ iceServers: [] });
    const link: Link = { connection, queue: [] };
    links.set(id, link);
    connection.onicecandidate = (event): void => {
      if (event.candidate)
        sendSignal(id, {
          type: "candidate",
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
        });
    };
    connection.ondatachannel = (event): void => bind(id, link, event.channel);
    connection.onconnectionstatechange = (): void => {
      if (connection.connectionState === "failed")
        status(
          "Direct connection failed. Check that both devices use the same Wi-Fi, then rejoin.",
        );
    };
    return link;
  };
  const offer = async (id: string): Promise<void> => {
    const link = create(id);
    bind(id, link, link.connection.createDataChannel("otterpuck"));
    await link.connection.setLocalDescription(
      await link.connection.createOffer(),
    );
    const description = link.connection.localDescription;
    if (description?.sdp)
      sendSignal(id, { type: "offer", sdp: description.sdp });
  };
  return {
    ping: (to): void => {
      const link = links.get(to);
      if (
        link?.channel?.readyState !== "open" ||
        link.channel.bufferedAmount > 64000
      )
        return;
      link.pingAt = performance.now();
      link.channel.send(
        JSON.stringify({ type: "peer-ping", nonce: link.pingAt }),
      );
    },
    sync: (next): void => {
      room = next;
      const wanted = next.members.filter(
        (m) =>
          m.connected &&
          m.id !== self &&
          (self === next.hostId || m.id === next.hostId),
      );
      for (const [id, link] of links)
        if (!wanted.some((m) => m.id === id)) {
          link.connection.close();
          links.delete(id);
        }
      if (self === next.hostId)
        for (const member of wanted)
          if (!links.has(member.id))
            void offer(member.id).catch(() =>
              status("Could not connect to a player. Rejoin to retry."),
            );
    },
    signal: async (from, signal): Promise<void> => {
      if (
        !room?.members.some((m) => m.id === from && m.connected) ||
        (self !== room.hostId && from !== room.hostId)
      )
        return;
      if (!signalSchema.safeParse(signal).success) return;
      let link = links.get(from);
      if (signal.type === "offer") {
        link?.connection.close();
        link = create(from);
        await link.connection.setRemoteDescription({
          type: "offer",
          sdp: signal.sdp,
        });
        await link.connection.setLocalDescription(
          await link.connection.createAnswer(),
        );
        const description = link.connection.localDescription;
        if (description?.sdp)
          sendSignal(from, { type: "answer", sdp: description.sdp });
      } else if (signal.type === "answer" && link) {
        await link.connection.setRemoteDescription({
          type: "answer",
          sdp: signal.sdp,
        });
      } else if (signal.type === "candidate") {
        if (!link) return;
        const candidate = {
          candidate: signal.candidate,
          sdpMid: signal.sdpMid,
          sdpMLineIndex: signal.sdpMLineIndex,
        };
        if (link.connection.remoteDescription)
          await link.connection.addIceCandidate(candidate);
        else if (link.queue.length < 64) link.queue.push(candidate);
      }
      if (link?.connection.remoteDescription)
        for (const candidate of link.queue.splice(0))
          await link.connection.addIceCandidate(candidate);
    },
    send: (to, data): void => {
      const channel = links.get(to)?.channel;
      if (channel?.readyState === "open" && channel.bufferedAmount < 128000)
        channel.send(encodeClientMessage(data));
    },
    broadcast: (data): void => {
      const text = stringifySnapshot(data);
      for (const link of links.values())
        if (
          link.channel?.readyState === "open" &&
          link.channel.bufferedAmount < 128000
        )
          link.channel.send(text);
    },
    close: (): void => {
      for (const link of links.values()) link.connection.close();
      links.clear();
    },
  };
};
