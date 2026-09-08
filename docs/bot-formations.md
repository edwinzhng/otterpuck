# Bot formations

## Coaching references

- [Wellington Underwater Hockey Association, school coaching manual, June 1999 revision 2](https://www.wuha.org.nz/uploads/6/1/4/5/6145499/word_wuha_manual_6.pdf), printed pages 34–39: predictable supporting roles, forwards available ahead of the puck, connected passing distances, diagonal defensive support, and a replacement arriving underwater before the relieved player surfaces. This is historical New Zealand coaching guidance; it does not establish the present national team's formation.
- [San Francisco Underwater Hockey: formations](https://sfuwh.org/about-uwh/formations/) and [positions](https://sfuwh.org/about-uwh/positions/): front-to-back role naming, forwards as receiving options, a linking midfield, strong-side involvement and weak-side cover.
- [Atlantis Sports: 3–3](https://wiki.atlantissports.org/teams/formations/3-3) and [1–3–2](https://wiki.atlantissports.org/en/teams/formations/1-3-2): additional club descriptions of strong/swing back responsibilities and midfield/back support.

The presets below are game adaptations of those principles. Their exact spacing, pursuit costs, air thresholds and partner priorities are authored game rules, not claimed national-team playbooks. The game's short flick distance requires compact passing connections.

## Shape and pursuit

`formation-layout.ts` is the shared layout for normal play and strike deployment. Positive lateral coordinates mean the team's right; positive depth means its attacking direction. Both axes mirror for the other team. Wall lanes mirror too. Each team's slot-zero forward takes the strike; remaining players deploy into their selected formation.

| Formation | Ahead of the puck | Linking line | Rear cover |
| --- | --- | --- | --- |
| 3–3 | LF, CF, RF | Strong back pressures; CB links | Weak back protects the diagonal toward the defending middle |
| 2–3–1 | LF, RF | LW, C, RW | B |
| 1–3–2 | F | LW, C, RW | LB, RB |

Forwards aim about 1.35–1.47 m ahead. The center stays between the wings. Midfield and backs remain behind play, with more depth on the weak side. Near boundaries, the formation origin moves inward enough to preserve lane spacing. At a side wall, the 3–3 back line becomes a compact diagonal; players retain their left/center/right ordering.

Every player retains a `formationTarget` independently of temporary puck or recovery jobs. One challenger per team can approach the puck. Selection weighs distance, depth, role, strong/weak side and existing coverage, with hysteresis. Immediate nearby contact and emergency fallback remain possible. Actual possession wins over last-touch history. Other players retain their lanes, watch the puck, and route around traffic. They do not challenge a teammate's controlled puck.

Bots pass to a forward option only when that teammate is down and within 2.7 m. Support sprinting depends on needing to catch up; proximity to the puck alone no longer makes the entire formation sprint continuously.

## Air handoffs

| Formation | Preferred links |
| --- | --- |
| 3–3 | Side forwards ↔ CF; strong back ↔ CB. Weak back stays in cover during that exchange. |
| 2–3–1 | LF ↔ RF; wings ↔ C; C covers the lone B when needed. |
| 1–3–2 | F ↔ strong wing; wings ↔ C; LB ↔ RB. |

An air rotation persists through handoff, recovery and return. The incoming player must have sufficient air and reach the outgoing role on the bottom before the planned ascent begins. It keeps covering that role while the outgoing player breathes and dives back. The returning player approaches beside the cover player, then both resume their own roles.

Two disjoint pairs can rotate concurrently; a player cannot cover two teammates or be assigned to both sides of a handoff. Human movement is never commanded by this planner. Defense delays discretionary cycling, while a protected air reserve always permits ascent. Goal restarts clear the rotations.

## Verification

`tests/formations.test.ts` covers mirrored geometry, lane ordering, strike deployment, role-aware pursuit and fallback, every formation's handoff/recovery/return, defensive ascent, independent pairs, and actual AI swimming back into formation around a teammate's possession. Existing strike, crowd-grab, collision, curl, shooting, breath, and full-match tests remain active.

September 8 verification: 120 tests pass; TypeScript, changed-file Biome checks and production build pass. A 180-second simulation benchmark averaged 0.0295 ms per step, with 0.047 ms p95. This measures simulation CPU time, not browser rendering. Live visual/frame-rate verification of this pass is pending because the Mac was locked. Port 3203 was verified to serve the exact new build.
