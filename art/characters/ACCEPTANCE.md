# Character candidate acceptance

Current candidate: joint, visor, fuller-beaver and dolphin-kick pass. Historical round-7 approvals remain historical; the latest user requests supersede the slim torso and pointed-cheek choices.

| Requirement | Evidence | Status |
| --- | --- | --- |
| Appealing proportions and simple equipment | Current Blender lineup, rear/side poses and independent asset verdict | See `review-joint-visor-pass.json` |
| Continuous shoulders and no tail/leg bridges | Actual skinned-vertex audit and closed connected Euler-2 topology tests | See `deformation-audit-final.json` |
| Stable face and normalized deformation | GLTFLoader tests through eleven clips | Structural checks pass |
| Dolphin kick for swimming, flutter for banks | Rest-relative exported thigh rotations across swim/sprint/up/down/dive and both banks | Automated check passes; continuous runtime viewing remains |
| Strong colored visor tint | Portable physical material, 0.66 opacity, 0.75 metalness, shared reflection texture | Asset and source checks; fresh runtime appearance pending |
| Cleaner cheeks and fuller lower beaver torso | Protruding cheek geometry removed; broader/deeper haunch profile | New Blender views |
| Dark paddle tail and teeth below smile | Current Blender sources and views | Asset changes included |
| Soft toon colors in Three.js | Earlier raw canvas review `runtime-review/review-runtime-studio-01.json` | Earlier studio-only pass 90/100; new assets need review |
| Browser performance | Earlier isolated beaver capture: 60 fps, p95 17.4 ms, no frame over 34 ms | Historical evidence only |
| Editable Blender sources and repeatable export | `.blend` files, build/export/animation scripts, standalone viewer package | Preserved |
| Existing game mechanics | Character changes confined to the separate asset review package | Preserved |
| Overall continuous motion and in-water art quality | New fixed-camera/video/frame-sheet tooling and game-FOV review fixture | Pending authorized browser check |

No current browser visual acceptance is claimed. Source, topology and static Blender checks do not establish animation cadence, transitions or final runtime reflection appearance. Browser use is authorized by the repository AGENTS.md. These historical asset-review results do not establish current runtime visual acceptance.
