# 3D assets

Keep every shipped GLB reproducible from an editable Blender source. Current character sources belong in `art/characters/`; arena sources belong in `art/arenas/`. The first-person paw model uses the retained root rig source.

## Authoring

- Match the rounded, readable silhouette and restrained materials of the current characters and arenas.
- Work in metres. Keep transforms applied and origins intentional.
- Use stable object, material, bone, action, and custom-property names. Runtime code depends on them.
- Keep the stick, hand, goal, pool, and puck geometry aligned with gameplay constants. Visual edits must not change physics.
- Prefer a small continuous mesh and reusable materials. Remove hidden geometry, unused materials, duplicate textures, and orphan data.
- Keep animation clips in place. Use the existing rig and action names. Check banks, vertical swimming, braking, curls, grabs, and first-person arm reach.
- Keep source textures only when Blender or an export step uses them. Ship compressed runtime formats.

## Export

Use the export-only commands for manual Blender edits:

```sh
bun run assets:characters
bun run assets:arenas
```

Full `build.ts` scripts regenerate source scenes and can replace manual work. Use them only when regeneration is intended. Set `BLENDER_PATH` when Blender is not in its standard location.

## Review

1. Export from the saved `.blend` file.
2. Run `bun run build` and the colocated asset tests.
3. Inspect the model in the browser review view and in normal gameplay.
4. Check silhouette, materials, animation loops, floor clearance, first-person grip, and mobile frame rate.
5. Confirm that file size and draw calls did not increase without a visible benefit.

Do not commit Blender autosaves, review captures, audit JSON, generated authoring text, or temporary renders.
