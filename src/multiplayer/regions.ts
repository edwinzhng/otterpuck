import { z } from "zod";

const privateHost =
  /^(localhost|127\.0\.0\.1|\[::1\]|10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2}|[a-z0-9-]+\.local)$/;
export const regionsSchema = z
  .array(
    z.object({
      id: z.string().regex(/^[a-z-]+$/),
      label: z.string().max(80),
      url: z.string().refine((value) => {
        if (value === "") return true;
        if (/^wss:\/\/[^\s]+$/.test(value)) return true;
        const match = /^ws:\/\/([^/:\s]+|\[[^\]\s]+\])(:\d+)?\/socket$/.exec(
          value,
        );
        return Boolean(match?.at(1) && privateHost.test(match[1] ?? ""));
      }),
    }),
  )
  .max(5);
export type Region = z.infer<typeof regionsSchema>[number];
export const loadRegions = async (): Promise<Region[]> => {
  const response = await fetch("/multiplayer.json", { cache: "no-store" });
  const regions = regionsSchema.parse(await response.json());
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1")
    regions.unshift({
      id: "local",
      label: "Local development",
      url: `ws://${location.hostname}:3210/socket`,
    });
  return regions;
};
export const measurePing = (region: Region): Promise<number> =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(region.url);
    const samples: number[] = [];
    let sent = 0;
    const finish = (error?: Error): void => {
      clearTimeout(timeout);
      socket.close();
      if (error) reject(error);
      else
        resolve(
          Math.round(
            samples.sort((a, b) => a - b).at(Math.floor(samples.length / 2)) ??
              0,
          ),
        );
    };
    const timeout = setTimeout(() => finish(new Error("Timed out")), 5000);
    const ping = (): void => {
      sent = performance.now();
      socket.send(JSON.stringify({ type: "ping", nonce: sent }));
    };
    socket.onopen = ping;
    socket.onmessage = (event): void => {
      let value: unknown;
      try {
        value = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (
        !value ||
        typeof value !== "object" ||
        !("type" in value) ||
        value.type !== "pong" ||
        !("nonce" in value) ||
        value.nonce !== sent
      )
        return;
      samples.push(performance.now() - sent);
      if (samples.length === 5) finish();
      else ping();
    };
    socket.onerror = (): void => finish(new Error("Unavailable"));
  });
