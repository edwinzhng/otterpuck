# Otterpuck arenas

The playable game offers **Tropical Cove** and **Neon Rooftop** from the lobby. Both use the existing 25 × 15 × 2.44 m playing pool, low metal troughs and authoritative gameplay controller. The arena is visual state; switching it does not change collision, scoring or puck rules.

Hold **Space** after reaching the surface to lift the first-person view above the water. Release to lower your head; **Ctrl** descends. The camera lift does not move the player collider. Player sprint is 2.9 m/s, down from 3.4 m/s. Speed streaks use actual movement speed, occupy only the screen edges, and respect reduced-motion preferences.

## Editable sources and export

- `tropical.blend`: pool, low troughs, limestone deck, curved palms, grouped broadleaf planting, lounges, sails, rounded island shore and connected mountain ridges.
- `city.blend`: pool, rooftop terrace, pergolas, foliage, guards, light strips and layered city towers.
- `create.ts` and `scenery.ts`: repeatable Blender authoring through its Python API, driven by Bun.
- `export.ts`: evaluates geometry modifiers and batches static geometry by material, keeping pool surfaces and foliage separate. Exports the selected arena only, with meters and glTF Y-up conversion.
- `build.ts`: authors both scenes and exports their GLBs. The editable Blender scenes retain separate, named objects; export batching does not overwrite them.
- `preview.ts`: low-thread-count source previews from overview, waterline and goal views. These are Blender composition checks, not screenshots of the browser renderer.

From the project root, run `bun art/arenas/build.ts` to regenerate the Blender scenes and GLBs. This intentionally replaces generated arena sources; preserve any manual Blender edits separately before rebuilding. To export manual edits without regenerating, run `bun art/arenas/export.ts`. Run `bun art/arenas/preview.ts` for source previews.

Runtime assets live in `public/models/arenas/` and `public/art/arenas/`. Runtime materials preserve authored vertex colors and maps, use the character's smoothly interpolated color ramp, and add restrained foliage motion. Packed rock paint is documented in `rock-texture.md`. `src/arena-surfaces.ts` adds large tile areas and moving caustics. Water uses one static reflection capture after loading each arena. Environmental shadows are also captured only when the arena changes; swimmer contact shadows use shared soft gradients.

Only one arena is retained at a time. Replaced geometry, materials, backgrounds and gradient textures are disposed. The generated panoramas are distant scenery behind actual modeled objects, not substitute pool geometry.

## Validation

`bun test` covers gameplay, new surface camera behavior and sprint speed. Arena GLB checks cast rays across the playing area to catch scenery intersecting the water, verify trough entry height, and enforce geometry and material-batch budgets. `bun x tsc --noEmit` checks types; Biome checks changed source. `bun build.ts` builds the production app.

The playable game now loads the approved preview's otter and beaver GLBs, including corrected vertical dolphin and bank/flutter kicks. Continuous skinned bodies remain cosmetic. Their protected mitten follows the physical stick through an arm solver; the first-person mitten is extracted from the same authored asset. Identical skin skeleton uploads are shared within each character, while different players retain independent animation.

The older small first-person arm proxy is retained only for the existing first-person interaction binding. Hidden legacy rigs are no longer animated for third-person characters. The world still uses the existing controller, collider, physical stick contacts and puck rules.

Runtime review is available at `?review`; its frame capture saves raw renderer pixels, avoiding the color shift observed in the automation screenshot transport. The current independent visual review remains below the90-point goal, so the newest refinements require further actual-game review. See `performance.md` for measured performance and remaining verification.
