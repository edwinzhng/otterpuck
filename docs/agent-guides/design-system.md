# UI design system

## Sources of truth

- `src/ui-components.ts` owns shared markup and accessibility defaults.
- The start of `src/style.css` owns global visual tokens and shared component styles.
- `src/touch-markup.ts` owns specialized gameplay touch controls.
- Feature modules compose these primitives. They do not copy them.

## Current primitives

| Primitive | Use |
| --- | --- |
| `button` | Primary, secondary, icon, and quiet actions |
| `cardButton` | Large navigation and selection cards |
| `segmentedButton` | One option in a compact exclusive choice |
| `field` | Labeled custom select field |
| `dialog` | Modal shell with a title and close action |
| `control` | A control key or gesture with its description |

Shared CSS also provides panels, button rows, fields, segmented groups, focus states, disabled states, and the root color tokens.

## Rules

- Use a current primitive before you create markup.
- Add a primitive when a product pattern appears twice.
- Put interaction semantics and accessibility defaults in the primitive.
- Put visual variants in the shared component selector. Do not copy declarations into a feature selector.
- Use a semantic variant name such as `primary`, `quiet`, or `icon`. Do not name a variant for its color.
- Keep feature layout outside the primitive. A component must not know its screen position.
- Keep touch gameplay controls separate when their pointer behavior differs from normal buttons.
- Do not add a general-purpose abstraction for a pattern that occurs once.

## Change checklist

When you add or change a primitive:

1. Check its normal, hover, focus, active, disabled, and selected states.
2. Check keyboard and screen-reader semantics.
3. Check desktop and the narrowest touch layout.
4. Replace duplicate product markup in the same change.
5. Add an objective convention check only when it has one clear fix.
