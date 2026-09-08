# Shader approach audit

The proposed soft RGB lighting ramp is a suitable, inexpensive basis for the reference. It can provide broad warm lit areas and cool colored shadows without adding outlines, fur shells, or expensive screen effects. It does not establish a visual pass: no new Three.js runtime evidence was supplied.

## Verified from local Three.js 0.185.1 source

The gradient hook returns irradiance within the built-in MeshToonMaterial direct-light path. Keeping that path preserves skinned normal transforms, lighting, shadow attenuation, fog, and output conversion. Reading RGB instead of the default red channel is valid. Linear filtering is appropriate for the intended soft ramp; the 128 × 1 RGBA texture is only 512 bytes and adds no pass. Treat its values as linear lighting coefficients (the existing NoColorSpace default is appropriate).

## Corrections and limitations

1. Preview and runtime are not yet identical. Blender style.ts uses an emission result of baseColor × (0.9 × ramp + 0.095). character-review.ts instead adds a hemisphere and second directional light; those contributions depend on surface orientation and have their own colors. Sharing ramp stops is useful, but either reproduce the review-light equation in Blender or explicitly treat Blender as approximate and judge the Three.js view as authoritative.
2. character-review.ts's frame limiter drops valid animation frames near the refresh boundary. It requires an elapsed time >= 16.667 ms, then discards the remainder by setting previous = now. A deterministic 0.1 ms-rounded timestamp simulation yields 40 rendered frames/second on both 60 Hz and 120 Hz schedules. Preserve the render remainder and maintain a separate simulation timestamp (or use a small tolerance) before judging flow.
3. The new material path currently runs only for ?characters. The game and ?review still use createSwimmerView's standard materials and the strongly cyan world lighting. Do not describe the preview material as already applied to gameplay.
4. Keep color-space and tone-mapping settings explicit and aligned between reference preview and runtime. The newly added SRGBColorSpace and NoToneMapping declarations are appropriate for this comparison.
5. applyCharacterStyle also resets mesh visibility with a hard-coded right-glove rule. That is acceptable inside this preview, but move visibility selection outside the material conversion before reusing the function for configurable gameplay handedness.
6. Retain the tiny custom shader hook and pinned Three version. On a dependency upgrade, verify that the gradient chunk replacement still occurs; a silent replacement miss would restore grayscale shading without a type error.

## Reference interpretation

The concept is soft stylized 3D with sculpted forms and selective highlights, rather than a hard cel-shaded outline style. A smooth colored ramp supports that target; adding hard bands or more effects would not fix muzzle volume, silhouette, or eye expression. Glossy eyes and nose with largely matte coat/equipment are consistent with the image.

## Earlier topology correction

continuous.ts explicitly includes Head and Muzzle in a voxel remesh followed by smoothing and weight transfer. My earlier statement that the exported muzzle would remain merely joined/intersecting was incorrect. The visible root issue was a curvature/color transition, not evidence of disconnected exported topology.

No visual score was changed by this source audit.

