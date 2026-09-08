# Initial reference fidelity audit

Scope: existing Blender previews, runtime source, panorama assets and GLB identity. Actual gameplay screenshots are pending. This is a diagnosis, not a runtime visual score or acceptance.

Reference: latest slim-beaver/otter sheet, `codex-clipboard-d8936e56-fdf1-4700-aed0-c0d58b40fb46.png`. Reviewed tropical surface/overview and city surface previews from the existing game.

## Changes needed before a strong visual comparison

1. **Mountain form and terrain layers.** The tropical mountain remains a large truncated cone with broad nearly featureless slopes. Its green shoulders are shallow smooth mounds without a convincing shoreline. The reference has asymmetric rocky ridges, overlapping terrain planes, foliage at the base and a much richer separation of near/middle/distant land. Author a small set of broad interlocking rock faces and ridgelines; soften their edges while retaining plane changes. Use restrained warm-lit/cool-shadow vertex color areas and a distinct shoreline. More subdivisions or noise alone will not solve the silhouette.

2. **Palm silhouette.** Narrow straight-looking trunks and almost uniformly radial crowns read as wire stems carrying flat pointed straps. Closely repeated sharp leaflet tips add harshness without the reference's fuller sweeping frond masses. Vary frond length, inclination and crown asymmetry; use fewer, broader overlapping leaflet groups with a readable continuous arch. Add a slight rounded collar/root transition and broad trunk color bands rather than fine bark detail. Keep them soft without turning leaves into inflated tubes.

3. **Poolside composition and grounding.** The deck is a broad bare slab holding equally separated repeated chairs and small isolated planters. The reference is clean but still has grouped landscaping, a framing shade structure and a readable terrace edge. Arrange a few deliberate seating/plant clusters with negative space between them, bring some low foliage behind the copings, and reduce the exposed dead slab perimeter. Use subtle baked/contact shading around fixed prop bases so they sit on the ground. Runtime currently has no environmental shadow setup; the only shadow meshes are swimmer/puck blobs.

4. **Panorama detail versus blur.** The 1774×887 images cover the entire 360-degree background. Only a few hundred source texels span a gameplay view, so the city towers are visibly enlarged and blurred even before `backgroundBlurriness = 0.025`. The reference's distant city has clear stepped silhouettes, a dense but restrained window rhythm and atmospheric layers. Use a substantially higher-resolution authored background, or sharp modeled mid-distance silhouettes with the existing panorama limited to haze/clouds. Preserve soft shading while keeping silhouette edges intentional. A sharpening filter cannot recover the missing skyline structure.

5. **Material treatment.** `arenas.ts` substitutes a six-step grayscale ramp with nearest filtering for nearly every nonmetal material and drops source maps and vertex colors. That creates hard banding over uniformly colored geometry and would erase authored painterly variation. Preserve source color data/maps and use a broad smoothly interpolated color ramp, with subtle local color variation baked in Blender where useful. The desired softness is a combination of shape, restrained color design, contact shading and lighting; it is not a generic hard toon threshold.

6. **City depth and character.** The source preview's near tower is a mostly blank stacked block while the panorama supplies an oversized blurry spire. The reference has several readable crown shapes, stepped silhouettes and a lower layered skyline around the rooftop. Keep a few crisp mid-distance landmarks at varying heights; support them with quieter distant forms rather than enlarging the panorama. Cyan/blue should remain dominant with warm dusk and controlled rose accents.

## Concrete end-wall flicker cause

`create.ts` places `PoolWallEnd` centered at Y ±12.61 with depth 0.22, giving an inside face at Y ±12.5. `DeckEnd` is centered at Y ±15 with depth 5, also giving an inside face at Y ±12.5. The deck spans height 2.18–2.44 m, so those faces overlap across the entire upper 26 cm end-wall strip above each goal. Move the deck's inner edge behind the pool wall/coping or omit that hidden inner deck face. The low trough itself has clearance from the end wall and is not the primary coplanar pair found here.

## Character and animation integration

The staged GLBs exactly match the verified vertical-kick exports:

- Otter SHA-256: `3c8f8a05e2fae80c3fe0018493b4e5572dcc15095b06fcf2a59a002890d81631`
- Beaver SHA-256: `4880369c03da9a2daac45bc96b80c4cd204ce0032d7fc82a14878e9109829fae`

`motion.ts` blends the exported clips and does not replace thigh, shin, foot or fin-tip rotations. It preserves paired dolphin kicks and bank flutter from these files. It phase-locks the relevant locomotion clips, which avoids unrelated kick phases when blending.

`avatar.ts` keeps the new continuous skin separate from the older first-person paw model, so the old arm scaling in `poseSwimmer` is not directly applied to the new avatar. Two integration details still need real-game evidence:

- `poseAvatar` moves the entire visual root to satisfy a fixed shoulder-to-stick offset on every frame. Consequently the torso follows stick sweeps/shot motion and can drift relative to the authoritative player/collider. Prefer a stable body root and a bounded arm reach, or explicitly clamp a small cosmetic body follow if the current result visibly lunges/slides.
- `reach` translates the paw endpoint after solving the two-bone aim. Unlike a rigid glove attachment, the paw participates in the continuous skin. Check extended reaches and both handedness choices for a stretched wrist/cuff. Do not restore the earlier disconnected-arm scaling approach.

The shared character material pipeline preserves source vertex color/map data, unlike the current arena conversion. New runtime color, unusual-angle readability, continuous swimming cadence and actual gameplay scale are still unverified in this pass.

## Required capture set for the independent scored pass

Capture actual renderer output for tropical surface looking toward the island, tropical underwater approaching a goal, city surface with skyline, city underwater, a close three-quarter swimmer and a gameplay-distance swimmer. Include a short fixed-view dolphin and banking sequence for continuity assessment. Score those independently against the reference with the unchanged 90+ threshold; Blender previews cannot substitute for actual-game acceptance.
