---
name: simplify
description: Simplify code and reduce repository-wide redundancy while preserving behavior. Use after implementation or when asked to refactor, remove dead or duplicate code, reduce code volume, flatten complexity, or audit a repository for unnecessary abstractions and compatibility paths.
---

# Simplify Code Safely

Improve clarity and reduce unnecessary code. Treat fewer lines as a useful outcome, not the objective: prefer explicit, maintainable code over dense or clever code.

## Establish the constraints

1. Read the repository's `AGENTS.md`, `CLAUDE.md`, and relevant nested instructions before analyzing code. Treat those files as the source of project conventions; do not assume generic style rules override them.
2. Inspect `git status` and preserve unrelated or pre-existing worktree changes.
3. Audit the whole repository by default. If the user supplies a narrower scope, honor it.
4. Identify the public contracts, tests, build commands, and package boundaries relevant to each candidate. Do not infer that repository-local usage is the complete contract surface.

## Find simplification candidates

Look for:

- unreachable or unused private code;
- duplicated branches, helpers, types, and transformations;
- redundant conditions, state, wrappers, adapters, and intermediate representations;
- abstractions with no independent responsibility;
- comments that only restate the code;
- nesting or control flow that can be expressed more directly;
- compatibility or defensive paths whose original consumer may no longer exist.

Do not collapse distinct responsibilities, remove useful boundaries, introduce nested ternaries or dense one-liners, or trade debuggability for a lower line count.

## Build an evidence chain

Use the repository's configured tools when available, and confirm their findings in source and tests:

- Use `ast-grep --lang <language> -p '<pattern>'` for syntax-shaped searches, repeated structures, and structural transformations.
- Use Serena for symbol declarations, implementations, semantic references, file overviews, and language-server diagnostics. Read Serena's initial instructions and activate the project before using its semantic tools.
- Use GitNexus for dependency and execution-flow questions. Resolve the indexed repository first, run upstream impact analysis before changing a shared symbol, and run change detection after editing to check the affected scope.
- Use text search only for non-semantic evidence such as strings, comments, configuration keys, registries, URLs, reflection, dynamic imports, and generated-code references.

Treat graph and language-server results as navigation evidence, not proof by absence. If an index is stale, follow the repository's re-indexing instructions. If Serena or GitNexus is unavailable or incomplete, continue conservatively and do not interpret missing references as proof that deletion is safe.

## Classify before editing

Assign every candidate to one class:

### Proven equivalent

Apply the cleanup directly only when source, references, contracts, and tests support preserving all observable behavior. Typical examples include exact duplicate logic, unreachable private branches, and unused private symbols with no dynamic or generated references.

### Approval required

Do not edit candidates that appear low risk but may change edge behavior. Report the evidence, uncertainty, affected surface, proposed deletion, and expected reduction, then wait for explicit user approval. This includes obsolete-looking compatibility paths, defensive fallbacks, lifecycle hooks, and symbols that might have external consumers.

### Keep

Leave high-risk or insufficiently understood code unchanged. Record the evidence needed to reconsider it when that is useful.

Never delete or alter an export, public API, protocol field, plugin or framework entry point, configuration-driven path, migration, compatibility shim, or reflection/dynamic-loading target solely because no local semantic reference is found.

## Refine and verify

1. Apply only proven-equivalent changes and any approval-required changes the user explicitly accepts.
2. Re-read the result and remove accidental complexity introduced by the refactor.
3. Run focused tests and diagnostics for the changed code, then the broadest practical repository checks defined by project-owned scripts.
4. Run GitNexus change detection when available and confirm that affected symbols and execution flows match the intended scope.
5. Revert or revise any simplification that changes behavior, weakens a contract, obscures intent, or lacks adequate verification.

## Report the result

Summarize:

- proven-equivalent code removed or simplified;
- approval-required candidates left unchanged;
- high-risk candidates intentionally kept;
- tests, diagnostics, and impact checks run;
- meaningful reduction in files, symbols, branches, or lines when measurable.

Document only decisions that help a reviewer understand the safety or intent of the simplification.
