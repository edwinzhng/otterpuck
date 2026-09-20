// Development only. Adds latency and jitter to a room connection so a local
// game behaves like a distant one, which is the only way to see reconciliation
// artefacts without a real server between the players. Delivery stays ordered,
// matching the WebSocket transport the game actually uses.
export type Link = { deliver: (action: () => void) => void };

const immediate: Link = { deliver: (action): void => action() };

export const createLink = (latency: number, jitter: number): Link => {
  if (latency <= 0 && jitter <= 0) return immediate;
  let previous = 0;
  return {
    deliver: (action): void => {
      const now = performance.now();
      const wobble = jitter > 0 ? (Math.random() - 0.5) * 2 * jitter : 0;
      // Never deliver ahead of an earlier message, or the room would see the
      // input stream reordered, which the real transport cannot do.
      previous = Math.max(previous, now + Math.max(0, latency + wobble));
      const timer = setTimeout(action, previous - now);
      timer.unref?.();
    },
  };
};

// Read the simulated link from the environment. Ignored in production so a
// stray variable cannot slow a real room down.
export const linkFromEnvironment = (
  environment: Record<string, string | undefined>,
): { latency: number; jitter: number } => {
  if (environment.NODE_ENV === "production") return { latency: 0, jitter: 0 };
  const read = (name: string): number => {
    const value = Number(environment[name]);
    return Number.isFinite(value) && value > 0 ? Math.min(value, 2000) : 0;
  };
  return { latency: read("ROOM_LATENCY_MS"), jitter: read("ROOM_JITTER_MS") };
};
