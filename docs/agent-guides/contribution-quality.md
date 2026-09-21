# Contribution quality

Judge the submitted work, not the tool that produced it. Automated and generative tools do not lower the acceptance standard.

## Required ownership

The contributor must be able to explain:

- the player or maintenance problem;
- why each changed module is necessary;
- the source of new behavior, copy, and assets;
- the important failure and recovery paths;
- what was verified and what was not.

Reject unverifiable claims. A generated test, benchmark, screenshot description, or review summary is not evidence that the action occurred.

## Reject these patterns

- broad changes without a specific outcome;
- a second helper, component, registry, or state source for an existing concept;
- wrappers that only rename an API or add no invariant;
- speculative extension points, options, flags, or configuration;
- placeholder behavior presented as complete;
- generic copy that does not match the game or visible controls;
- comments that narrate obvious code, the prompt, or the edit process;
- large generated documents, snapshots, fixtures, or assets without a runtime need;
- invented citations, provenance, performance numbers, or test results;
- local paths, chat transcripts, model instructions, or tool output in product files;
- formatting churn or unrelated cleanup that hides the functional diff.

## Coherence check

Read the change as one system:

1. Trace the player action from UI or input to authoritative state and feedback.
2. Confirm there is one name and one source of truth for each concept.
3. Remove code that is not required for that trace.
4. Compare copy, visuals, and behavior with adjacent established patterns.
5. Confirm tests exercise behavior instead of restating implementation details.

## Evidence standard

- Link each claimed outcome to a test result, browser observation, measurement, or source location.
- Use before-and-after evidence for visible changes.
- Measure performance and traffic claims with the relevant runtime path.
- Mark incomplete verification explicitly. Do not infer that an unchecked path works.

## Repository hygiene

- Keep only files that support the product, its deployment, or a repeatable authoring workflow.
- Put editable sources in `art/` and optimized runtime assets in `public/`. Do not keep an uncompressed runtime duplicate unless an authoring tool reads it.
- Record the creator, source, license, and runtime filename for every audio or visual asset.
- Before deleting a file, check imports, package scripts, build steps, deployment files, tests, and documentation. Update the full workflow in the same change.
- Remove temporary renders, audit output, screenshots, local configuration, migration notes, and historical handoff documents after their useful result is captured.
- Keep guidance concise and durable. Document a rule or workflow, not the history of an individual cleanup.
- Before a public release, check tracked files and Git history for credentials, private data, unclear asset rights, and obsolete large artifacts.
