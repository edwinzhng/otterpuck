# Vertical kick correction

Both characters now kick up/down in dolphin and flutter clips. The authored kick rotations previously used each bone's local X axis, but thigh/shin rest axes are strongly rolled and mirrored. The correction converts the intended anatomical rotation into each leg bone's rest-local basis. Existing paired dolphin phases and alternating bank phases are preserved.

## Files to publish

- `art/characters/rig.ts`: the only changed authoring source; adds the rest-basis conversion in `animate()`.
- `art/characters/otter.blend`
- `art/characters/beaver.blend`
- `public/models/characters/otter.glb`
- `public/models/characters/beaver.glb`

`animate.ts`, `geometry.ts`, and `export.ts` are unchanged copies of the accepted source, included to rerun the pipeline. Live game files were not edited.

## Verification

The test loads the actual exported GLBs with Three.js. It samples the skinned surface vertices at both fin tips at 129 times in each of seven clips. It removes the full animated pelvis transform, restoring the anatomical rest orientation so body translation, pitch, and bank cannot masquerade as kick excursion.

| Clip | Previous sideways excursion | Previous vertical excursion | Corrected vertical excursion |
| --- | ---: | ---: | ---: |
| Swim | 10.45 cm | 9.16 cm | 29.86 cm |
| Sprint | 14.87 cm | 13.19 cm | 40.05 cm |
| Bank/flutter | 4.27 cm | 3.69 cm | 12.61 cm |

Corrected lateral excursion is below 1 micrometer in all tested clips for both characters. SwimUp, SwimDown, and Dive also pass. The straight-swim left/right vertical correlation is approximately 1.0; bank flutter correlation is -0.980. Authored angle amplitudes and clip durations are unchanged.

Four tests pass with 3,706 assertions. They also confirm byte-identical skinned mesh attributes, indices, skin weights, unchanged materials and rest skeleton, and identical non-leg animation tracks. TypeScript and Biome pass.

Evidence: `kick-evidence.json` contains measurements and every sampled trajectory. `tests/kick-analysis.ts` reproduces that report; `tests/kick.test.ts` checks the motion and preservation contract. `baseline/` contains the original GLBs used for comparison.

## Repeatable commands

Run from this folder using Bun:

```sh
bun art/characters/animate.ts
bun art/characters/export.ts
bun tests/kick-analysis.ts
bun test tests
bun x tsc --noEmit
bun x biome check tests art/characters/rig.ts tsconfig.json package.json
```

The Blender runners explicitly use two CPU threads. Blender needed the permitted unsandboxed background invocation because its Metal backend crashed during sandboxed startup.

This verifies exported animation direction and preservation. Browser playback, live controller overrides, continuous runtime cadence, and visual tail/fin clearance were not inspected in this pass. Runtime must retain these clip rotations rather than replacing thigh/shin rotations with the old local-X procedural kicks.
