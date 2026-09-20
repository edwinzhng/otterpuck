# Contributing to Otterpuck

Thank you for helping improve Otterpuck. Keep each change focused on a clear player or maintenance outcome.

## Before you change code

1. Read `AGENTS.md` and the applicable guides in `docs/agent-guides/`.
2. Search for an existing component, registry, helper, or rule before you add one.
3. For a large feature or gameplay change, open an issue before implementation.

## Quality standard

You are responsible for every line, asset, and claim in your contribution, including material produced with an automated or generative tool.

- Submit the smallest complete change that solves the stated problem.
- Understand and review all submitted code.
- Do not include speculative abstractions, placeholder features, duplicate systems, filler copy, narrated comments, or unrelated cleanup.
- Do not claim that a test, device check, visual review, or benchmark passed unless you performed it.
- Record the source and license of every new external or generated asset.
- Remove temporary files, generated reports, local paths, and tool transcripts before submission.

## Development

Use Bun, TypeScript, and Biome. Do not add npm, pnpm, ESLint, or Prettier.

Before you open a pull request, run:

```sh
bun run check
bun test
bun run build
```

Run the relevant browser and device checks for changes to gameplay, controls, layout, animation, audio, or rendering. State clearly when a required check was not possible.

## Pull requests

- Explain the player or maintenance problem before the implementation.
- Keep one concern in each pull request.
- Include before-and-after evidence for visible changes.
- Identify gameplay, protocol, persistence, performance, accessibility, and compatibility risks.
- List new generated material and external sources, or state that there are none.
- Do not use generated descriptions as a substitute for reviewing the diff.

By submitting a contribution, you confirm that you have the right to submit it and agree that it can be distributed under the repository's applicable licenses.
