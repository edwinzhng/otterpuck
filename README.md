# OTTERPUCK

A stylized first-person underwater-hockey game with otters and beavers, built with Three.js, TypeScript and Blender.

Play a six-versus-six match with AI teammates and opponents, or explore the pool and practice puck skills in Free Swim. Choose Tropical Cove or Neon Rooftop, your species, formation, position and bot difficulty. The game supports mouse/keyboard and landscape touchscreen controls.

## Run locally

Install [Bun](https://bun.sh), then:

```sh
bun install --frozen-lockfile
bun run dev
```

Open http://127.0.0.1:3200. Set `PORT` to use another port.

`bun run dev` rebuilds on every save and refreshes the open page itself, so there is nothing to reload by hand.

For the production build:

```sh
bun run build
bun run start
```

Production builds precompress models and code. The included server negotiates Brotli and gzip assets and revalidates cached files.

Blender is not needed to run or build the game; the exported runtime assets are included. Solo play requires no backend, API keys or external services.

## Play on a phone

Connect the phone and computer to the same Wi-Fi, then:

```sh
bun run build
bun run start:lan
```

Open `http://<computer-LAN-IP>:3204` on the phone. This command listens on the local network; stop it with Ctrl+C when finished. The ordinary start command binds to localhost only.

Phones automatically use touch controls. **Settings → Controls → Touch** also enables the overlay on a desktop or hybrid device. Play in landscape: the left joystick swims and steers, the outer ring sprints, right-side dragging aims, and holding Shoot charges a shot while still allowing drag-to-aim.

## Offline play

The production app automatically downloads an offline copy after its first online load. Once that background download finishes, both arenas, characters, tutorials and audio work without a connection. There is no download button or opt-in step. Keep the app open online long enough for the first download to complete.

Updates download in the background and take over after existing game tabs or windows close. An interrupted update keeps the previous offline copy. Browser storage can still be cleared or evicted by the device.

## Desktop controls

| Input | Action |
| --- | --- |
| W / S | Swim / brake |
| A / D | Turn the body and swim |
| Mouse | Look and aim |
| Shift | Sprint while stamina lasts |
| Space | Rise; hold at the surface to lift your head |
| Ctrl / C | Descend / duck dive |
| Left mouse | Hold to charge; release to shoot |
| Right mouse + A / D | Swerve |
| Q / E | Glance left / right without turning |
| X | Grab a nearby puck or knock down an incoming shot |
| T | Tactics |
| Esc | Pause / release mouse |
| Ctrl + F | Toggle fullscreen |
| H / P | Tutorial help / retry |
| Shift + L | Hide / show the tackle log |

## Gameplay rules

Sprinting spends stamina, which returns slowly and faster at the surface. A drained swimmer drops out of the sprint until stamina rebuilds and replenishes air more slowly afterwards. A full breath lasts 30 seconds holding still and 20 while swimming. Turning underwater costs some forward speed. Normal swimming turns at the same rate with or without the puck, while curling keeps its tighter limit. Turning from a stop curls, and a hard sprinting turn starts the slower automatic dummy. The dedicated Dummy control keeps its faster move and sprint burst.

A curl also shields the puck. A reverse curl seals the stick side and the front and leaves the far side open, a regular curl guards both sides evenly, and a challenger facing the same way as the carrier gets a far better angle than one coming head-on. Cover makes the challenging blade sit ever more exactly on the puck, and past a point no placement reaches it. Caught between two opponents facing your way, turning loses the puck.

Turnovers you are part of briefly show a small Puck lost or Puck won cue. Turnovers between other swimmers stay off the screen.

A small debug log in the top right lists the last few turnovers, yours and everyone else's, naming the side the tackle came from (or SANDWICH), the carry it was lost from, and how well covered the carrier was. Press Shift + L to show or hide it; it starts hidden.

The pool is approximately 25 × 15 × 2.44 m, with low metal trough goals. Supported formations are 3-3, 2-3-1 and 1-3-2. Players manage breath and rotate through formation coverage. Puck control combines physical blade contact, assisted uncontested carrying, curls, flicks and opposing challenges.

## Project structure

- `src/`: gameplay, AI, controls, UI, rendering, audio, runtime animation and colocated tests.
- `services/`: multiplayer room service and colocated service tests.
- `public/`: exported GLBs, textures, images and audio used by the game.
- `art/characters/`: current editable character/equipment sources and authoring scripts.
- `art/arenas/`: editable arena sources and authoring/export scripts.
- `art/otter.blend` and `art/otter-paws.blend`: first-person paw rig sources.
- `docs/agent-guides/`: product, code, review and asset-authoring standards.

## Blender workflow

Save edits in the existing `.blend` files, then export:

```sh
bun run assets:characters
bun run assets:arenas
bun run build
```

The scripts use the standard Blender application on macOS and `blender` on other platforms. Set `BLENDER_PATH` to override the executable. Export and preview tasks use two CPU threads. Blender uses its Python API; Bun orchestrates authoring and exports.

`bun art/characters/animate.ts` rebuilds the in-place clips while preserving the meshes. Full regeneration with `bun art/characters/build.ts` or `bun art/arenas/build.ts` replaces authored sources, so use export-only commands to preserve manual model edits.

Current otter and beaver sources include the corrected vertical dolphin and bank/flutter kicks. Runtime animation adapts to movement while physics remains authoritative. The stick is separate, and the goal is a floor-mounted metal trough without a net. Follow the [3D asset guide](docs/agent-guides/3d-assets.md) for authoring and review.

## Checks

```sh
bun run check
bun test
bun run build
bun run benchmark
```

CPU simulation and input benchmarks do not measure GPU or phone performance; verify interactive changes in a browser and on target devices.

See [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a change.

## Credits

The multiplayer swords icon is from [Lucide](public/licenses/lucide.txt). Music and splash recordings are credited with their sources and licenses in [audio credits](public/audio/CREDITS.md). No blanket license is granted for the game's code or authored assets by this repository.

## Multiplayer

Play with friends supports US East and EU West online rooms, plus device-hosted LAN rooms using WebRTC. LAN players need internet to join and must keep the host device awake. Empty positions are filled by bots. Rooms are held in memory and end when their regional service restarts.

Run the room service locally with `bun run rooms`; configure browser endpoints in `public/multiplayer.json` and server variables using `.env.example`. Railway services, regions and automatic deployment from `main` are defined in `.railway/railway.ts`; frontend build and headers are in `vercel.json`.

### Online rooms on one machine

Start `bun run rooms` beside `bun run dev`, then open `http://localhost:3200` in two windows. A **Local development** region appears in the region list on localhost, so both windows join a real online room served by the local room service — the same code path as US East, not the LAN peer-to-peer one.

A room on the same machine has almost no latency, which hides everything that only shows up over a real link. Give it one:

```sh
ROOM_LATENCY_MS=80 ROOM_JITTER_MS=15 bun run rooms
```

Both are one-way milliseconds, applied to traffic in each direction, and delivery stays ordered. They are ignored when `NODE_ENV=production`.

Self-host the whole thing on a Raspberry Pi behind Caddy, reachable by friends over HTTPS, with `docker compose up -d --build`. See [self-hosting on a Raspberry Pi](docs/self-hosting.md).
