# Performance pass — September 8, 2026

## Changes

Production builds create Brotli and gzip variants for large GLBs and text assets. The Bun server negotiates supported encodings, preserves content types, rejects stale variants and revalidates unchanged files with ETags. Compression occurs during builds, not during requests. Original Blender/GLB geometry and textures are unchanged. Other hosting providers need equivalent compression configuration.

Frame timing uses a fixed 600-sample ring and calculates/publishes statistics at most ten times a second instead of sorting and serializing every rendered frame. Avatar mesh visibility is updated only when handedness or first-person mode changes. Animation, collision and puck calculations remain unchanged.

## Measurements

The active legacy binding, two current character GLBs and two arena GLBs total 17,368,912 bytes uncompressed and 5,221,122 bytes with Brotli: 69.94% fewer transferred bytes. This is a byte-size reduction, not a claim of 70% faster wall-clock loading. The first tropical load downloads a subset of these assets. Live gzip and Brotli responses decoded exactly to the original city GLB; an unchanged request returned HTTP 304 with zero body bytes.

Actual in-app browser, Neon Rooftop, twelve players, Elite bots, Balanced graphics, 1422 × 1324 CSS viewport / 1919 × 1787 render target, 600-frame windows:

| Build | FPS | Frame interval p95 | Measured callback CPU |
| --- | ---: | ---: | ---: |
| Before, first sample | 60.00 | 17.3 ms | 1.85 ms |
| Before, later sample | 59.85 | 17.5 ms | 2.04 ms |
| After | 60.00 | 17.3 ms | 1.69 ms |

The camera saw different player arrangements in these samples (29 draw calls at the end of the final sample versus 219 in the baseline), so these numbers do not establish a CPU or GPU speedup. Geometry/texture allocations stayed at 95/25. A separate after-change window at a smaller 1728 × 972 render target measured 59.80 FPS. No browser console warnings or errors were observed. These are short desktop measurements, not phone or sustained thermal tests.

A focused statistics benchmark measured about 83–95% less work depending on run (roughly 0.041–0.049 ms/frame before versus 0.002–0.008 ms/frame after). This small operation is outside the reported callback-CPU interval. Alternating-order avatar benchmarks showed only a small, noisy difference; no material animation speedup is claimed.

## Verification and next candidates

153 tests pass, including encoding negotiation, exact decompression, HEAD, revalidation, stale-variant rejection and rolling-window/reset statistics. TypeScript, build and Biome checks pass with the pre-existing eleven CSS warnings and one informational finding.

The next candidates are consolidating compatible character draw calls and distance-based character detail for phones. Profile on actual phone hardware before changing fidelity. This pass does not complete the separate art-review goal.
