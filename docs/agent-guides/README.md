# Otterpuck agent guides

Use these guides for all repository work. Start with the product principles, and then read the guides that apply to the task.

- [Product principles](product-principles.md): decisions for a simple game experience.
- [Contribution quality](contribution-quality.md): ownership, evidence, and rejection criteria for low-quality changes.
- [In-product copy](in-product-copy.md): player-facing labels, help, errors, and tutorials.
- [Code comments](code-comments.md): when to write, keep, rewrite, or remove comments.
- [UI design system](design-system.md): shared primitives, visual tokens, and reuse rules.
- [UI code structure](ui-structure.md): browser UI, input, rendering, and responsive behavior.
- [Backend code structure](backend-structure.md): rooms, network protocols, services, and validation.
- [Product-minded code review](code-review.md): review order and acceptance checks.

`AGENTS.md` contains repository-wide operating constraints. These guides add detailed standards and do not override it.

Run `bun run check` to apply the automated parts of these guides. The check combines Biome, TypeScript, and repository-specific convention rules. Product sense and visual quality still require review in the running game.
