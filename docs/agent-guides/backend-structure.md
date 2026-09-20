# Backend code structure

## Boundaries

- Treat the room service as authoritative for online matches.
- Validate all network input at the boundary.
- Keep protocol schemas, wire encoding, and protocol versions together.
- Keep room membership separate from simulation state.
- Keep rate limits and payload limits close to the transport that enforces them.
- Do not trust peer identity, client timing, or client simulation state.

## Data and traffic

- Use one typed registry for ordered wire fields.
- Change the protocol version when a deployed client and server cannot interoperate.
- Keep backward decoding only when it has a defined removal plan.
- Send the smallest complete message.
- Do not reduce update rates without checking player-visible motion.
- Bound queues, retries, reconnects, payloads, and retained rooms.

## Functions

- Prefer pure parsing and transformation helpers.
- Keep side effects at service boundaries.
- Pass explicit dependencies instead of reading hidden global state.
- Use named domain types. Do not use `any` or unsafe assertions.
- Return early for invalid or stale messages.

## Operations

- Health endpoints must be cheap and must not mutate state.
- Logs must not contain secrets, room tokens, or unnecessary player data.
- Player-facing errors must remain separate from diagnostic detail.
