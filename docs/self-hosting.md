# Self-hosting on a Raspberry Pi behind Caddy

Runs the game and the room service on a Pi on your home network, published over
HTTPS through a Caddy already running on the host, so friends outside the house
can join your rooms. Requires a 64-bit Raspberry Pi OS (Bun has no armv7 build)
and a Pi 4 or 5 — the image build compresses the whole asset set and wants 2 GB
of RAM.

Substitute your own hostname for `otterpuck.example.com` throughout.

## 1. Point a name at the house

Add a DNS record for `otterpuck.example.com` pointing at your home IP address,
using your dynamic-DNS provider if the address is not static. Your router
already forwards 443 to the Pi; forward 80 as well, or Caddy cannot answer the
ACME HTTP challenge and will never get a certificate for the new name.

## 2. Configure the services

On the Pi, clone the repository and write `.env` beside `docker-compose.yml`:

```sh
PUBLIC_ROOMS_HOME_URL=wss://otterpuck.example.com/socket
ALLOWED_ORIGINS=https://otterpuck.example.com
TRUST_PROXY=1
```

Both names must match the address friends actually type, exactly and with no
trailing slash: the room server compares the browser's `Origin` header against
`ALLOWED_ORIGINS` literally and rejects anything else with 403.

`PUBLIC_ROOMS_HOME_URL` is a build argument, baked into `dist/multiplayer.json`
when the web image builds. Changing the hostname later means rebuilding, not
just restarting.

## 3. Add the Caddy site

In `/etc/caddy/Caddyfile`:

```caddy
otterpuck.example.com {
	handle /socket {
		reverse_proxy 127.0.0.1:3210 {
			header_up X-Real-IP {remote_host}
		}
	}
	reverse_proxy 127.0.0.1:3200
}
```

Then `sudo systemctl reload caddy`.

The `header_up` line is not optional. The room service reads `X-Real-IP` for its
per-address connection and room-creation limits, and Caddy does not set that
header on its own — it sets `X-Forwarded-For`. Without it every player counts as
the same address and one friend reconnecting repeatedly can lock everyone else
out of room creation.

Do not add `encode` to this site. The web server stores precompressed Brotli and
gzip copies of every asset and negotiates them itself.

## 4. Start it

```sh
docker compose up -d --build
```

The first build takes a while on a Pi. Check both services with
`docker compose ps`, and the room service with
`curl -s https://otterpuck.example.com/socket` — it should answer
`Origin not allowed`, which means Caddy is reaching it and the origin check is
live.

## 5. Play

Open `https://otterpuck.example.com`, choose **Play with friends → 🏠 Home
server**, create a room and hit **Copy invite**. The invite link carries both
the room code and the region, so friends who open it land on your Pi without
choosing anything. Empty positions fill with bots.

## Operational notes

Rooms live in memory. `docker compose restart`, a redeploy or a power cut ends
every match in progress; there is no persistence to configure.

The service ships with limits already set: 256 concurrent connections, 32 per
address, and 6 room creations per address per minute. A 6v6 match streams
snapshots at 60 Hz to every player, so your home connection's *upstream*
bandwidth, not the Pi, is what caps how many simultaneous matches you can host.

Offline play works here, unlike plain-HTTP LAN hosting — the page is served over
HTTPS, so the service worker registers and caches the game after the first load.
