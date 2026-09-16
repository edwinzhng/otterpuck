export const LIMITS = {
  connections: 256,
  connectionsPerAddress: 32,
  addresses: 4096,
  addressRetention: 10 * 60_000,
  payloadBytes: 128_000,
  bufferedBytes: 64_000,
} as const;

export const createBudget = (
  capacity: number,
  period: number,
  now: () => number = Date.now,
): ((cost?: number) => boolean) => {
  let tokens = capacity;
  let previous = now();
  return (cost = 1): boolean => {
    const time = now();
    tokens = Math.min(
      capacity,
      tokens + (Math.max(0, time - previous) * capacity) / period,
    );
    previous = time;
    if (cost > tokens) return false;
    tokens -= cost;
    return true;
  };
};

type Address = {
  connections: number;
  touched: number;
  connect: ReturnType<typeof createBudget>;
  admission: ReturnType<typeof createBudget>;
  create: ReturnType<typeof createBudget>;
};

type Lease = { release: () => void; admit: (creating: boolean) => boolean };
export const createConnectionLimits = (
  now: () => number = Date.now,
): {
  acquire: (key: string) => Lease | undefined;
} => {
  const addresses = new Map<string, Address>();
  const attempts = createBudget(256, 1000, now);
  const creates = createBudget(32, 60_000, now);
  let connections = 0;
  return {
    acquire: (key: string): Lease | undefined => {
      if (!attempts() || connections >= LIMITS.connections) return;
      const time = now();
      for (const [id, address] of addresses)
        if (
          !address.connections &&
          time - address.touched >= LIMITS.addressRetention
        )
          addresses.delete(id);
      let address = addresses.get(key);
      if (!address) {
        if (addresses.size >= LIMITS.addresses) return;
        address = {
          connections: 0,
          touched: time,
          connect: createBudget(120, 60_000, now),
          admission: createBudget(60, 60_000, now),
          create: createBudget(6, 60_000, now),
        };
        addresses.set(key, address);
      }
      address.touched = time;
      if (
        !address.connect() ||
        address.connections >= LIMITS.connectionsPerAddress
      )
        return;
      const entry = address;
      entry.connections++;
      connections++;
      let released = false;
      return {
        release: (): void => {
          if (released) return;
          released = true;
          entry.connections--;
          connections--;
          entry.touched = now();
        },
        admit: (creating): boolean => {
          entry.touched = now();
          return (
            !released &&
            entry.admission() &&
            (!creating || (entry.create() && creates()))
          );
        },
      };
    },
  };
};
