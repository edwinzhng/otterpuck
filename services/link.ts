export type Delivery = (action: () => void) => void;

const deliverNow: Delivery = (action) => action();

// Delay local room traffic without reordering it.
export const createDelivery = (latency: number, jitter: number): Delivery => {
  if (latency <= 0 && jitter <= 0) return deliverNow;
  let previous = 0;
  return (action): void => {
    const now = performance.now();
    const wobble = jitter > 0 ? (Math.random() * 2 - 1) * jitter : 0;
    previous = Math.max(previous, now + Math.max(0, latency + wobble));
    const timer = setTimeout(action, previous - now);
    timer.unref?.();
  };
};

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
