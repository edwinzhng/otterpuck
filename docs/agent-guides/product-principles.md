# Product principles

## The player

Assume that the player is non-technical. The player wants to start quickly, understand the next action, and recover from mistakes without reading documentation.

## Decision order

Use this order when requirements compete:

1. Preserve working gameplay and player progress.
2. Make the next action clear.
3. Keep controls consistent across screens and devices.
4. Reduce steps, choices, and text.
5. Keep feedback immediate and calm.
6. Add complexity only when it solves a measured problem.

## Defaults

- Choose a safe default for most players.
- Hide advanced and diagnostic controls from the normal flow.
- Ask for a choice only when it materially changes the result.
- Use progressive disclosure for secondary settings.
- Do not expose implementation terms such as protocol, snapshot, host process, or environment variable in player-facing copy.

## Interaction

- One gesture must have one predictable meaning in the same context.
- Do not add a gesture that conflicts with an existing gesture.
- Keep frequent actions within comfortable reach on touch devices.
- Give each action visible feedback.
- Make errors recoverable without a reload when practical.

## Scope

Prefer the smallest complete change. Do not redesign adjacent systems unless the requested result requires it. Remove obsolete paths when a replacement is complete.
