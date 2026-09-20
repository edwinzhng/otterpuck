# UI code structure

Use the [UI design system](design-system.md) for shared components and visual tokens.

## Ownership

- Keep shared product options and control metadata in typed registries.
- Keep markup generation in UI modules.
- Keep input translation in input modules.
- Keep simulation rules out of DOM and CSS code.
- Keep renderer state out of menu components.
- Keep player-facing copy in a single source when more than one view uses it.

## Components and state

- Use the shared markup primitives in `src/ui-components.ts` for standard buttons, card buttons, segmented controls, fields, dialogs, and control rows.
- Add a shared primitive when the same interaction or visual pattern appears twice. Do not copy its markup or accessibility state into a feature module.
- Keep specialized controls, such as gameplay touch surfaces, in their dedicated component module.
- Keep shared colors, spacing, radii, type sizes, and control states in the root CSS tokens or component selectors.
- Give one module one clear responsibility.
- Prefer named helpers over repeated query and toggle blocks.
- Derive UI state from the authoritative game or session state.
- Do not store the same state in the DOM and TypeScript unless synchronization is explicit.
- Use semantic elements, labels, `aria-pressed`, status regions, and keyboard support.
- Preserve focus, pointer capture, and touch cancellation behavior.

## Automated enforcement

- `bun run check` runs Biome, TypeScript, and the repository convention checks.
- The convention check rejects raw product button markup outside the shared UI component modules.
- Add a narrow convention check when a rule is objective, stable, and has a clear fix.
- Do not encode subjective product or writing judgments as brittle text checks.

## Responsive behavior

- Design desktop and touch controls as separate presentations of the same actions.
- Do not show both control sets at the same time.
- Test the narrowest supported portrait and landscape layouts.
- Keep primary actions visible without horizontal scrolling.
- Defer large assets until the player needs them.

## Motion and performance

- Keep gameplay input and simulation independent from render frame rate.
- Do not add visual work that changes colliders or movement speed.
- Avoid layout reads in animation loops.
- Reuse loaded assets and dispose replaced Three.js resources.
