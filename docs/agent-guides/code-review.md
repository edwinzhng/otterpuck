# Product-minded code review

Apply the ownership and evidence requirements in [Contribution quality](contribution-quality.md) before detailed review.

Review in this order. Stop when a higher-priority check fails.

## 1. Player outcome

- Does the change solve the stated player problem?
- Is the next action clear to a non-technical player?
- Did the change add a choice that a default could remove?
- Is the desktop and touch behavior consistent?

## 2. Regression risk

- Does gameplay feel, physics, input, networking, or saved progress change?
- Are error and recovery paths complete?
- Can an old client, stale tab, interrupted touch, or reconnect enter a bad state?
- Are production-only and development-only options separated?

## 3. Simplicity

- Is there one source of truth for shared options, copy, and protocol fields?
- Can a branch, state field, comment, or abstraction be removed?
- Does each module have one clear responsibility?
- Is the change smaller than an alternative with the same player outcome?
- Does each new abstraction enforce a real invariant or remove demonstrated duplication?
- Can the contributor explain why every changed file belongs in this change?

## 4. Copy and accessibility

- Is the copy short, direct, and free of technical terms?
- Does it fit at narrow widths?
- Are labels, focus, keyboard input, touch input, and status announcements correct?

## 5. Performance and traffic

- Does page load request only the assets needed now?
- Does the frame loop avoid new allocation, layout, and network work?
- Are multiplayer messages bounded and compact?
- Was interactive renderer performance checked for visual changes?

## 6. Verification

- Run the smallest relevant checks first.
- Run `bun run check`, relevant `bun test` targets, and `bun run build` before release.
- Exercise the complete player flow, not only the changed function.
- Check desktop and touch layouts when UI or controls change.
- Record any verification that cannot be completed.
- Match every claimed result to evidence that was actually produced.

## 7. Diff quality

- Does unrelated formatting or cleanup hide the functional change?
- Does the change contain placeholders, generated filler, local paths, transcripts, or temporary artifacts?
- Do tests verify public behavior instead of copying implementation structure?
- Are new assets necessary, attributable, and suitable for distribution?

## Automated and manual checks

Automate rules when every violation has the same correct fix. Use Biome for language rules and `scripts/check-conventions.ts` for repository-specific boundaries. Keep player clarity, visual hierarchy, responsive fit, motion quality, and interaction feel in human review because those checks need context.
