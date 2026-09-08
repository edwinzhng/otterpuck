# Performance and verification — September 8, 2026

Measured on Edwin's computer. No browser/GPU result below is inferred from a command-line simulation.

## Actual game renderer

One existing in-app browser tab, 1388×1324 CSS viewport, Balanced render scale1.35, 600 rendered-frame samples per window. Full12-player Elite matches:

| Arena | Average fps |95th percentile frame interval | Average measured render-callback CPU | Draws | Triangles | Textures |
|---|---:|---:|---:|---:|---:|---:|
| Tropical |59.90 |18.1ms |1.77ms |193 |672,026 |23 |
| City |59.75 |18.1ms |2.10ms |213 |698,719 |23 |

These measurements preceded the latest ridge, facade, painted-rock, shadow and hidden-rig refinements. Final browser measurement is still required. The CPU column is the measured rendered callback, not total browser/GPU utilization. Texture count stayed stable across the first map change; more repeated-map checks remain.

An earlier Free swim sample ran at55.0fps,25.1ms p95 and188 textures. Sharing identical skeleton uploads reduced texture count to23, with byte-level sampled animated-vertex checks preserving each player's independent animation. This comparison changes player count and is not a controlled FPS speedup claim.

## Focused animation benchmark

`bun tests/animation-benchmark.ts` runs four alternating-order trials, each600 measured frames after60 warmup frames. It compares the previous third-person path (posing the hidden legacy rig plus the new avatar) with skipping the hidden rig. Both pose the same twelve authored swimmers.

- Previous mean CPU:0.3563ms per12-character frame.
- Optimized mean CPU:0.2388ms.
- Reduction:32.98%.

This excludes rendering and GPU work. `animation-performance.json` records every trial. The accompanying avatar regression compares world-space bones and physical stick position; poses are unchanged.

## Other safeguards

- Play rendering is capped near60fps, menu30fps and pause15fps; hidden pages stop rendering. Review is60fps moving/30fps paused.
- Blender authoring uses two CPU threads, sequentially.
- Current tropical geometry:83,456 triangles/15 material batches. City:97,500/21. Both remain below100,000 arena triangles.
- Static reflections/shadows are not recaptured every frame. Transparent effects are bounded.
- End-wall ray checks verify a separation greater than12cm between independently drawn end-wall/deck surfaces, removing the previous coplanar overlap.
-99 tests pass, including gameplay, formation/team selection, defensive AI, stick contact, first-person glove bounds, skeleton sharing and exported assets. Typecheck and production build pass. Biome has no errors; CSS cascade/accessibility warnings remain.

## Remaining

Check the latest shaders/assets in the game, repeated map disposal, both end walls in motion, surface head lift, audio toggles, character motion and final match frame times. Independent visual acceptance and copying the staged update into the live game remain pending.

Browser authorization is explicit and recorded in both AGENTS.md files. Automatic approval review nevertheless reapplied the removed per-turn rule to a frame capture and rejected the evidence-backed retry. A fresh user reply is pending; no alternative browser route is being used.
