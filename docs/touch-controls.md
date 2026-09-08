# Touch controls

The existing game now supports phones in landscape. Automatic mode selects touch controls for a coarse primary pointer; hybrid devices can select **Settings → Controls → Touch**. The same setting enables the touch overlay on a desktop for layout review. Mouse & keyboard restores desktop input. Touch sensitivity and graphics quality are saved locally.

| Control | Action |
| --- | --- |
| Left joystick | Swim and steer the body; push to the outer edge to sprint; pull back to brake |
| Drag the water on the right | Look and aim |
| Shoot | Hold to charge, drag while holding to aim, release to shoot |
| Grab / Knock down | Contextual puck reaction |
| Curl / Reverse | Hold to curl with the puck |
| Swerve | Hold while steering the joystick left/right |
| Pull | Hold to bring the puck back; release to push it forward |
| Backhand | Toggle shot side |
| Rise | Hold to ascend; continue holding at the surface to lift the head |
| Dive | Start a duck dive and hold to descend |
| Pause | Pause, restart, reset the practice puck, or return to the menu |

Menu controls remain usable in portrait; Play asks for landscape. Rotating into portrait, hiding the page, losing window focus or changing input mode pauses/cancels held input. Pointer cancellation never fires a loaded shot. Each finger owns its own action through pointer capture, including a shot drag that leaves its button. Touch controls do not require pointer lock or orientation-lock APIs. Audio starts directly from the Play/Resume gesture.

## Testing on a phone

From the game directory, run:

```sh
bun run build
bun run start:lan
```

This explicitly starts a second server on port 3204, listening on the local network. Open `http://<your-computer-LAN-IP>:3204` on a phone connected to the same Wi-Fi. The default server binds only to this computer. `127.0.0.1` on the phone points to the phone itself, not the computer. Stop the LAN server with Ctrl+C when finished. No hosting service or public tunnel is configured.

## Implementation

- `src/touch-controls.ts`: independent pointer ownership and input translation, without DOM or rendering dependencies.
- `src/touch-input.ts`: Pointer Events, capture, lifecycle cancellation, settings and HUD state.
- `src/touch-markup.ts` / `src/touch.css`: touch HUD, safe-area layout, help and settings.
- `src/input.ts`: selects the input source and writes the existing shared `Controls` state.
- `src/main.ts`: mobile graphics default, landscape gate, gesture-time audio and pause lifecycle.

The physics and AI remain authoritative. The Mobile graphics preset caps device pixel ratio at 0.85; users can choose another preset. It introduces no additional WebGL effects, particle systems or render passes. Held controls update through the existing frame loop; the thumb and charge bar only write changed values.

## Verification — September 8, 2026

142 tests passed, including 12 new tests for simultaneous steering/charging/aiming, independent release/cancellation, sprint hysteresis, reaction/depth edges, skills, returning to keyboard input, and actual sprint-shot simulation. TypeScript, changed-file Biome and the production build pass. The local server serves the new entrypoint and bundled assets.

The 180-second CPU simulation benchmark averaged 0.0329 ms per step (p95 0.0498 ms), with 27 shots and a 1–2 result. A warmed 90,000-sample two-pointer input diagnostic averaged 0.00015 ms per poll. These measurements exclude browser rendering and do not establish phone frame rates.

Browser verification is pending: the Mac was locked and computer use could not unlock it. No phone or responsive browser screenshot, audio playback check, GPU frame-rate result, or physical multi-finger device test is claimed for this pass. Next checks: 844×390 and 667×375 landscape, 390×844 portrait menus/rotation, simultaneous movement + charge/aim on iOS Safari and Android Chrome, interrupted touches, surface head lift, and sustained full-team play in both arenas.
