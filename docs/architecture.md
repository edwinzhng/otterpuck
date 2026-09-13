# Runtime boundaries

`main.ts` owns application phases, the fixed-step loop, and wiring between systems. Gameplay remains authoritative: presentation reads simulation state and must not change player movement, colliders, or stick contact geometry.

| Module | Responsibility |
| --- | --- |
| `simulation.ts` | Player updates, possession, AI coordination, and simulation step order |
| `puck-physics.ts` | Puck integration, floor/goal support, wall response, and scoring |
| `simulation-events.ts` | Simulation announcements without a UI dependency |
| `world.ts` | Asset lifecycle, swimmer presentation, and renderer orchestration |
| `world-camera.ts` | Camera interpolation, head lift, pool bounds, and review/practice views through the small `CameraRig` interface |
| `shadows.ts` | Shadow texture creation and instanced shadow transforms |
| `ui-types.ts` / `ui-setup.ts` | UI references and one-time DOM construction/binding |
| `ui.ts` | HUD updates at the existing 10 Hz cadence |
| `minimap.ts` | Canvas minimap drawing from simulation state and tactics preference |
| `player-labels.ts` | Per-frame camera projection for player labels and puck direction |
| `settings.ts` | Persisted graphics/volume controls, connected through callbacks |
| `dom.ts` | Typed element lookup and text updates that skip unchanged values |
| `input.ts` / `touch-input.ts` / `touch-controls.ts` | Device bindings and controller state; active touch gameplay suppresses browser selection and context menus |

The simulation module keeps its existing public exports for callers and tests. Puck physics imports simulation data types and announcements, never the simulation orchestrator. Camera and HUD code consume narrow presentation inputs rather than importing the renderer implementation. Settings request changes through callbacks; they do not own the renderer or audio lifecycle.

Camera, shadow, and puck-physics scratch objects are private synchronous working storage. They are copied into output objects before returning and must never be retained in simulation state. Label projection accepts caller-owned output storage while retaining an allocating default for other callers. Keep these functions synchronous if retaining shared scratch storage.

This refactor deliberately retains the authored assets, character animation, render resolution defaults, simulation equations, and 120 Hz simulation cadence. Further splitting of player/puck interaction code should follow concrete feature boundaries and preserve the contact/animation tests.
