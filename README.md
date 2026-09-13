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

For the production build:

```sh
bun run build
bun run start
```

Production builds precompress models and code; the included server negotiates Brotli/gzip and revalidates cached assets. See [performance measurements](docs/performance.md).

Blender is not needed to run or build the game; the exported runtime assets are included. No backend, API keys or external services are required for play.

## Play on a phone

Connect the phone and computer to the same Wi-Fi, then:

```sh
bun run build
bun run start:lan
```

Open `http://<computer-LAN-IP>:3204` on the phone. This command listens on the local network; stop it with Ctrl+C when finished. The ordinary start command binds to localhost only.

Phones automatically use touch controls. **Settings → Controls → Touch** also enables the overlay on a desktop or hybrid device. Play in landscape: left joystick swims/steers, the outer ring sprints, right-side dragging aims, and holding Shoot charges a shot while still allowing drag-to-aim. The buttons expose puck skills and depth controls. See [touch controls and device testing](docs/touch-controls.md).

## Offline play

The production app automatically downloads an offline copy after its first online load. Once that background download finishes, both arenas, characters, tutorials and audio work without a connection. There is no download button or opt-in step. Keep the app open online long enough for the first download to complete.

Updates download in the background and take over after existing game tabs/windows close. An interrupted update keeps the previous offline copy. Browser storage can still be cleared or evicted by the device. See [offline implementation and verification](docs/offline.md).

## Desktop controls

| Input | Action |
| --- | --- |
| W / S | Swim / brake |
| A / D | Turn the body and swim |
| Mouse | Look and aim |
| Shift | Sprint |
| Space | Rise; hold at the surface to lift your head |
| Ctrl / C | Descend / duck dive |
| Left mouse | Hold to charge; release to shoot |
| Right mouse + A / D | Swerve |
| Q / E | Reverse / regular curl |
| Z | Hold to pull back; release to push forward |
| X | Grab a nearby puck or knock down an incoming shot |
| R | Toggle backhand |
| T | Tactics |
| Esc | Pause / release mouse |
| Ctrl + F | Toggle fullscreen |
| H / P | Tutorial help / retry |

The pool is approximately 25 × 15 × 2.44 m, with low metal trough goals. Supported formations are 3-3, 2-3-1 and 1-3-2. Players manage breath and rotate through formation coverage. Puck control combines physical blade contact, assisted uncontested carrying, curls, pull/push, flicks and opposing challenges. See [formation logic and research](docs/bot-formations.md).

## Project structure

- `src/`: gameplay, AI, controls, UI, rendering, audio and runtime animation. See [runtime boundaries](docs/architecture.md).
- `tests/`: physics, formations, movement, input, cameras, rig/deformation and asset checks.
- `public/`: exported GLBs, textures, images and audio used by the game.
- `art/characters/`: current editable character/equipment sources and authoring scripts.
- `art/arenas/`: editable arena sources and authoring/export scripts.
- `art/*.blend`: retained earlier rig sources, including the first-person interaction binding.
- `docs/`: controls, gameplay research and development notes.

The permanent local checkout is `/Users/edwin/repo/otterpuck`. The initial import preserves the latest playable prototype and gathers its matching asset sources. Earlier handoff documents contain historical temporary paths; they are not setup instructions for this repository.

## Blender workflow

Save edits in the existing `.blend` files, then export:

```sh
bun run assets:characters
bun run assets:arenas
bun run build
```

The scripts use the standard Blender application on macOS and `blender` on other platforms. Set `BLENDER_PATH` to override the executable. Export and preview tasks use two CPU threads. Blender uses its Python API; Bun orchestrates authoring and exports.

`bun art/characters/animate.ts` rebuilds the in-place clips while preserving the meshes. Full regeneration with `bun art/characters/build.ts` or `bun art/arenas/build.ts` replaces authored sources, so use export-only commands to preserve manual model edits.

Current otter/beaver sources include the corrected vertical dolphin and bank/flutter kicks. Runtime animation adapts to movement while physics remains authoritative. The stick is separate, and the goal is a floor-mounted metal trough, without a net. See [character assets](art/characters/README.md) and [arenas](art/arenas/README.md).

## Checks

```sh
bun run check
bun test
bun run build
bun run benchmark
```

The imported playable version passes 142 tests. CPU simulation and input benchmarks do not measure GPU or phone performance. Touch browser/device checks were pending because the Mac was locked; the broader visual-quality review is also still in progress. These are prototype features, not a claim of completed mobile or art acceptance.

## Credits

Music and splash recordings are credited with their sources and licenses in [audio credits](public/audio/CREDITS.md). Generated environment artwork is documented in `art/arenas/backgrounds.md` and `art/arenas/rock-texture.md`. No blanket license is granted for the game's code or authored assets by this repository.
