# Character assets

These are the current editable otter and beaver assets used by the game. They combine the accepted character modeling pass with the corrected vertical kick animation sources. Their GLB exports are in `public/models/characters/` and the actual game preview is available at `?review`.

## Sources

- `otter.blend`, `beaver.blend`: continuous skinned bodies, modular equipment, stable faces, short limbs, 33-bone rigs and eleven in-place animation clips.
- `equipment.blend`: separately authored short pusher and low goal trough. Gameplay retains its existing physical stick and arena trough geometry.
- `create.ts`, `continuous.ts`, `geometry.ts`, `style.ts`, `rig.ts`: authored geometry, shading and animation definitions.
- `animate.ts`: rebuilds clips in the saved character files without rebuilding meshes.
- `export.ts`: exports the saved characters to GLB.
- `build.ts`: regenerates both characters and separate equipment, then exports them.

The otter has a compact tapered tail. The beaver has a fuller lower torso, dark crosshatched paddle tail, and teeth below the smile. Both have continuous shoulders, simple paws, a protected mitten, masks, snorkels, caps with straight panels/numbers and ear guards, and colored fins. Protruding cheek tufts were removed. Straight swimming uses paired dolphin kicks; banking uses alternating flutter. Runtime fin clearance keeps the deformed surfaces above the tiles.

## Export saved Blender edits

From the repository root:

```sh
bun run assets:characters
bun test
bun run build
```

The source preview and runtime share `src/character-look.ts`. GLB exports preserve portable materials and shading metadata; the game supplies the final realtime shading and visor reflections. Blender-only shader graphs are not expected to run in glTF.

To rebuild animation only:

```sh
bun art/characters/animate.ts
bun run assets:characters
```

Full regeneration, which replaces generated Blender sources:

```sh
bun art/characters/build.ts
```

Blender is selected through `art/blender.ts`; set `BLENDER_PATH` when needed. Bun invokes Blender's Python API in background tasks with two CPU threads.

## Review

`bun art/characters/preview.ts --pair` creates a Blender composition check. Other options include `--motion=Swim --side`, `--motion=BankLeft`, `--motion=SwimUp`, `--motion=SwimDown`, `--beaver --rear`, and `--frame=38`.

Review the exported models in the actual game as well. Blender renders and historical asset-review scores do not establish final gameplay-camera appearance or sustained browser performance. Earlier audit JSON and working-state documents are retained as history; temporary paths and separate-preview references in them do not supersede this repository. Browser use is authorized by root AGENTS.md.
