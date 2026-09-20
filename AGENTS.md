# Otterpuck

## Agent guides

Read [docs/agent-guides/README.md](docs/agent-guides/README.md) before you change code, product copy, or documentation. It is the index for the repository's product, writing, structure, and review rules. Apply the guides that match the work.

This repository is the permanent home of the existing Otterpuck game. Preserve the working gameplay and current authored characters; do not start over. Historical handoff documents may mention temporary working directories. Work in this checkout.

## Browser use

Edwin authorizes browser use whenever needed for visual verification and performance testing. Reuse one tab where practical and keep checks lightweight. Preserve active match progress when testing. Browser permission does not need to be requested again.

## Development

Use Bun, TypeScript and Biome. Do not introduce npm, pnpm, ESLint or Prettier. Follow the code and comment rules in the agent guides. Blender's Python API is invoked by the TypeScript authoring scripts; the historical `art/otter.py` is retained as source provenance.

Gameplay physics and the existing controller remain authoritative. Visual animation, fur and particles must not change colliders or movement speed. Keep arm/stick geometry consistent with puck interaction logic. Test relevant changes with `bun test`, `bun run check`, and `bun run build`. Test actual renderer performance for interactive visual changes; CPU benchmarks are not phone or GPU frame-rate measurements.

## Assets

Keep editable Blender sources and repeatable GLB exports. Use `art/characters/` for current characters, `art/arenas/` for arenas, and `public/` for runtime assets. Root `art/*.blend` files support the earlier rigs and retained first-person binding. Export saved Blender edits instead of regenerating geometry unless a rebuild is intended. Never replace current corrected character animation with older exports. Preserve third-party audio credits.

Do not commit dependencies, build output, secrets, Blender autosaves or local review recordings. See README.md for setup, controls, asset commands and current verification limits.
