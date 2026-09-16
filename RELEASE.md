# Release log

Gameplay changes on this branch, newest first. Infrastructure work (self-hosting,
room service limits, snapshot compression) is left out.

## Turnovers

- **Turnovers you are in briefly show a small cue.** Puck lost appears when the
  puck is taken off you; Puck won appears when you take it or help close the
  pincer that does. Turnovers between other swimmers stay off the screen.
- **An optional debug log in the top right** lists the last few turnovers, yours
  and everyone else's, naming the tackle side, the carry the puck was lost from
  and the cover the taker had to beat. It starts hidden; `Shift + L` toggles it.

## Match sizes

- **2v2 and 3v3 alongside 6v6**, chosen in the quick match setup and by the host
  in the multiplayer waiting room.
- **New formations for the small sides**: 3v3 plays 2-1 or 1-2, 2v2 plays 1-1,
  each with its own wall lanes, formation targets and rotation partners.
- **Small sides press harder and breathe differently.** Forwards take the
  pressure duty there are no wings to carry, and only one swimmer cycles for air
  at a time so a pair never surfaces together.

## Alternative ruleset

Picked in the lobby and remembered; **original** keeps the previous behaviour.

- **Stamina replaces the old fatigue counter.** Sprinting spends it and drops the
  sprint when empty. It returns slowly, faster at the surface, and sprinting at
  the surface costs half the underwater rate. The HUD shows a stamina meter.
- **A shorter breath**: 30s still, 20s swimming, 10s sprinting, shortened further
  as stamina runs down.
- **Turning underwater costs a little forward speed.**
- **A hard turn with the puck hands over to the curl**, and yaw is capped at the
  curl rate, so no puck action turns faster than the curl.

## Puck shielding

- **A curl now covers the puck** instead of leaving it open to any blade that
  reaches it. Cover depends on where the challenger stands and which way they
  face, mirrored for left-handed carriers.
- **A reverse curl seals the stick side and the front** and leaves the far side
  open; a regular curl guards both sides evenly.
- **A challenger facing your way gets a far better angle** than one coming
  head-on.
- **Caught between two opponents facing your way, turning loses the puck.**
