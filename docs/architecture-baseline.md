# Architecture Migration Baseline

Recorded on 2026-07-13 before the migration defined in [../blueprint.md](../blueprint.md).

## Quality Gates

| Gate | Result | Baseline detail |
| --- | --- | --- |
| `npm run build` | Pass | TypeScript and Vite production build completed. |
| `npm run lint` | Fail | 43 errors: one unused test parameter, React ref access findings in `useCanvasInteraction`, and two unused helper parameters. |
| `npm test -- --run` | Fail | 708 passed, 2 failed, 710 total. Failures are the Spotify template icon expectation and structured text color picker label expectation. |
| `npm run knip` | Fail | 76 unused files, one unused dev dependency, 78 unused exports, and one duplicate export. Most unused files are legacy re-export entries or generated coverage files. |

These failures are migration baselines, not accepted final-state exceptions. Each phase must avoid adding failures; final acceptance requires all gates to pass.

## Repository State

- Legacy compatibility trees coexist with `domains` and `shared`: `components`, `features`, `lib`, `services`, `store`, `styles`, `types`, and `utils`.
- `domains/canvas` contains 104 files and currently owns rendering, interaction, state, structured editing, toolbar behavior, animation integration, import/export integration, and session integration.
- Cross-domain imports include bidirectional edges between canvas and actions, export, protocol, import, character-library, cast, and animation-related domains.
- Git tracks generated output under `coverage`, `test-results`, `playwright-perf-report`, and `proofshot-artifacts`.

## Change Isolation

The baseline worktree also contains staged App and ToolBar changes that predate this migration pass. They are treated as concurrent work and must not be reverted or attributed to architecture migration phases.
