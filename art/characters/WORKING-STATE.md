# Character review state — joint, visor and dolphin-kick pass

Source staging: `/private/tmp/uwh-game`. Durable standalone package: `/Users/edwin/repo/uwh-game/art/character-shading-review-2026-09-07`. Review URL: `http://127.0.0.1:3202/`. The original game on 3200 remains unchanged.

Latest user requests are stronger colored mirrored lenses (roughly half the previous transparency), a fuller beaver belly and especially lower torso/hips, teeth below the smile, darker crosshatched beaver tail, continuous shoulders, removal of accidental tail-to-leg bridges, cleaner cheeks, and a dolphin kick for straight/up/down swimming with flutter kicks reserved for banks.

The current Blender sources and GLBs include those changes. Lenses use opacity 0.66 and metallic coating, with a shared inexpensive reflection map in the viewer. Pointed cheek geometry is removed; small shoulder/hip surface motion remains. Shoulders use a broad anatomical weight field with a spatial head transition. The beaver paddle clears both legs. Synchronized leg kicks and delayed tail phases are authored in the in-place clips. Gameplay movement and collision code are unchanged.

Both files retain 33 bones and eleven clips. `animate.ts` can rebuild clips on existing Blender files without rebuilding geometry; `export.ts` exports saved Blender edits; `build.ts` regenerates everything. The source authoring text is synchronized with current parameters. Tests cover closed connected topology, normalized weights, stable eyes, equipment, visor settings, dolphin synchronization and alternating bank kicks. Separate deformation audits sample actual GLTFLoader skinned vertices through swim/sprint/dive/bank/reach poses.

Earlier actual browser captures succeeded before the new asset requests. Raw canvas images confirmed the intended palette; the earlier lavender/olive browser screenshot discrepancy is absent from raw canvas captures. The bounded raw studio review passed 90/100. An isolated earlier beaver run held 60 fps with 17.4 ms p95 and zero frames over 34 ms. Captures and metrics are in the durable package's `art/characters/runtime-review`. These are historical measurements, not current-pass verification.

New viewer tooling adds fixed-camera capture, dense transition frame sheets, and a Water review fixture using a 77-degree FOV. These changes need a fresh browser check. The fixture is not an authored tropical environment or gameplay integration.

Browser authorization does not carry between user turns under Edwin's supplied AGENTS.md. The most recent requests concern assets and animation, so no browser operation is authorized now. Do not use a headless browser or alternative automation as a workaround. Finish the asset package and ask once for a fresh browser-use request if needed. The goal tool remains blocked from the earlier permission impasse; overall style/motion acceptance is not complete.

Remaining overall acceptance: review the new assets and synchronized swim continuously in Three.js; validate transitions, game-FOV visibility, final visor appearance and in-water readability. The independent asset/deformation verdict is narrower than these runtime gates. Environments stay deferred.
