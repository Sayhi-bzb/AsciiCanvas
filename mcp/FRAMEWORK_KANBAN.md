# Agent–CharDesk Framework Kanban

Snapshot: 2026-08-15

This document tracks the current authoring framework, its owners, and
simplification candidates. It records project-specific boundaries; syntax and
implementation remain owned by their linked authorities.

## Status

| Status | Meaning |
| --- | --- |
| `Core` | Product behavior that remains without any Agent integration |
| `Adapter` | Agent- or transport-specific entry point over Core |
| `Review` | Supported today; ownership or necessity needs a decision |
| `Candidate` | Possible simplification; no removal decision has been made |
| `Missing owner` | A consumed concept has no production owner |
| `Not implemented` | Discussed behavior that the repository does not provide |

## Current shape

```text
Human goal
    |
    v
Agent + Skill
    |
    +-- apply_patch --> plain.txt
    |                       |
    |                      seed
    |                       v
    +-- apply_patch --> styled.ans
                            |
                         validate
                            |
                         publish
                            v
                      <name>.chardesk

Core:     Plain + Styled geometry invariant
Adapters: Skill, CLI, MCP, Codex Hook
Evidence: Evaluator cases + optional trace.jsonl
```

The framework currently expands one invariant into three main files, three
Agent adapters, six CLI commands, and several instruction surfaces:

> Styling may change style state, but not visible graphemes or cell geometry.

## Platform-owned concepts

These contracts are not owned by CharDesk. Project code may consume them but
must not assume an implementation beyond the platform's public behavior.

| ID | Concept | Owner | CharDesk use | Evidence |
| --- | --- | --- | --- | --- |
| `PLAT-01` | Agent and model | Agent product | Reason over the task and invoke tools | [OpenAI glossary](https://learn.chatgpt.com/docs/glossary) |
| `PLAT-02` | `read`, `apply_patch`, shell execution, tool results | Agent host | Inspect, patch, and run project programs | Host tool contract |
| `PLAT-03` | Skill activation | Agent product | Load the CharDesk workflow and syntax reference | [Skill](../.agents/skills/chardesk/SKILL.md) |
| `PLAT-04` | MCP lifecycle and tool calls | MCP client/Agent host | Expose the project `publish_canvas` tool | [OpenAI glossary](https://learn.chatgpt.com/docs/glossary) |
| `PLAT-05` | Hook lifecycle and matching | Codex | Optionally react to visible Codex tool events | [OpenAI Hooks](https://learn.chatgpt.com/docs/hooks) |
| `PLAT-06` | Sandbox and filesystem permissions | Agent host | Bound project reads, writes, and commands | [OpenAI glossary](https://learn.chatgpt.com/docs/glossary) |
| `PLAT-07` | Plugin packaging | Agent product | Possible distribution container for Skill, MCP, and Hook | [OpenAI glossary](https://learn.chatgpt.com/docs/glossary) |

`apply_patch` is platform-owned. A project Hook may observe a native
`apply_patch` event, but cannot assume that an outer tool such as `exec` exposes
an inner patch as the same lifecycle event.

## Product core

These contracts are independent of Agent integration.

| ID | Concept | Owner | Status | Authority |
| --- | --- | --- | --- | --- |
| `CORE-01` | Plain Unicode and ANSI/ESC-less recognition | `@chardesk/protocol` | `Core` | [Text Protocol v1](../packages/protocol/spec/v1.md) |
| `CORE-02` | Grapheme segmentation and Unicode/CJK cell width | `@chardesk/protocol` | `Core` | [Protocol source](../packages/protocol/src/index.ts) |
| `CORE-03` | Deterministic cells and geometry comparison | `@chardesk/protocol` | `Core` | [Geometry](../packages/protocol/src/geometry.ts) |
| `CORE-04` | `.chardesk` import as Freeform | Document domain | `Core` | [Import adapter](../src/domains/document/protocol/import.ts) |
| `CORE-05` | `.chardesk` and ANSI serialization | Export domain | `Core` | [Text exporter](../src/domains/export/formats/text.ts) |
| `CORE-06` | Canvas state and rendering | Canvas/Product domains | `Core` | [State flows](../apps/docs/content/docs/development/architecture/state-flows.mdx) |

The protocol owns syntax and geometry. Agent adapters must call it rather than
reimplement ANSI, grapheme, CJK, or width rules.

## Persisted representations

| ID | Path or form | Persistence | Content | Owner | Status |
| --- | --- | --- | --- | --- | --- |
| `FILE-01` | `.chardesk/work/<name>/plain.txt` | Local disk; Git ignored | Plain layout without style controls | Authoring workflow | `Review` |
| `FILE-02` | `.chardesk/work/<name>/styled.ans` | Local disk; Git ignored | ESC-less styled text | Authoring workflow | `Review` |
| `FILE-03` | `<name>.chardesk` | Product artifact | Validated styled text | CharDesk format | `Core` |
| `FILE-04` | `.chardesk/work/<name>/state.json` | Local disk; Git ignored | Hook hashes and acceptance state | Hook adapter | `Candidate` |
| `FILE-05` | `.chardesk/work/<name>/trace.jsonl` | Local/eval disk; Git ignored | Tool, validation, token, and timing events | Evaluator | `Missing owner` |
| `FILE-06` | `packages/mcp/evals/*.json` | Repository | Expected Plain and required styles | Evaluator | `Review` |

Current publication writes the validated `styled.ans` bytes unchanged to the
`.chardesk` output. The two paths therefore represent one styled payload.

The name `styled.ans` is also ambiguous: project documentation reserves `.ans`
for terminal ANSI with ESC, while this work file explicitly rejects ESC and
contains CharDesk's visible ESC-less controls.

## Authoring core

| ID | Capability | Owner | Consumers | Status | Authority |
| --- | --- | --- | --- | --- | --- |
| `AUTH-01` | Reject ANSI/control syntax in Plain | Authoring core | validate, seed, publish | `Core` | [Authoring](../packages/mcp/src/authoring.ts) |
| `AUTH-02` | Compare Plain and Styled geometry | Authoring core + protocol | validate, publish, evaluator | `Core` | [Authoring tests](../packages/mcp/src/authoring.test.ts) |
| `AUTH-03` | Seed Styled from normalized Plain | Authoring core | CLI, Hook | `Review` | [Authoring](../packages/mcp/src/authoring.ts) |
| `AUTH-04` | Atomically publish validated Styled | Authoring core | CLI, MCP, Hook | `Core` | [Authoring](../packages/mcp/src/authoring.ts) |
| `AUTH-05` | Hash Plain and Styled | Hook state | Hook | `Candidate` | [Hook](../packages/mcp/src/hook.ts) |
| `AUTH-06` | Keep paths inside the workspace | CLI/MCP boundary | CLI, MCP | `Core` | [Path resolver](../packages/mcp/src/paths.ts) |

The minimum project-owned behavior is `validate(plain, styled)` followed by an
atomic publication of accepted Styled text.

## Adapter inventory

All current adapters converge on `publishCanvasFiles`.

```text
CLI publish ---------+
MCP publish_canvas --+--> publishCanvasFiles --> .chardesk
Codex Hook ----------+
```

| ID | Adapter | Owner | Current behavior | Portability | Status |
| --- | --- | --- | --- | --- | --- |
| `ADAPT-01` | Skill | CharDesk content; Agent activation | Instructs Hook-first two-phase authoring with CLI fallback | Medium-high | `Review` |
| `ADAPT-02` | `chardesk-canvas` CLI | CharDesk | inspect, validate, seed, publish, evaluate, hook | High for coding agents with shell | `Review` |
| `ADAPT-03` | MCP `publish_canvas` | CharDesk MCP server | Structured wrapper over publication | Medium; requires an MCP host | `Candidate` |
| `ADAPT-04` | Codex PostToolUse Hook | CharDesk handler; Codex lifecycle | Attempts seed and publish after native `apply_patch` | Low across Agent hosts | `Candidate` |
| `ADAPT-05` | Plugin | Agent product + future package | Possible distribution of adapters | Host-dependent | `Not implemented` |

The current Code Mode exposes patching inside an outer `exec` call, so the
native `apply_patch` matcher does not observe that nested operation. The Hook
also returns `suppressOutput`, which Codex PostToolUse does not support.

## CLI surface

| ID | Command | Responsibility | Main authoring path | Status |
| --- | --- | --- | --- | --- |
| `CLI-01` | `inspect` | Report Plain width and height | No | `Candidate` |
| `CLI-02` | `validate` | Validate without writing output | Optional | `Review` |
| `CLI-03` | `seed` | Create Styled from Plain | Yes without Hook | `Review` |
| `CLI-04` | `publish` | Validate and write `.chardesk` | Yes | `Core` |
| `CLI-05` | `evaluate` | Score an existing Agent run | No; evaluation only | `Review` |
| `CLI-06` | `hook` | Adapt Codex hook stdin/stdout | No; Codex only | `Candidate` |

The package named `@chardesk/mcp` currently contains four responsibilities:
authoring, CLI, MCP transport, and evaluation, plus the Codex Hook adapter.

## Instruction surfaces

| ID | Surface | Owned question | Status | Authority |
| --- | --- | --- | --- | --- |
| `DOC-01` | Skill | What should an Agent do when authoring CharDesk content? | `Review` | [SKILL.md](../.agents/skills/chardesk/SKILL.md) |
| `DOC-02` | ANSI reference | What concise syntax may an Agent emit? | `Core` | [ansi.md](../.agents/skills/chardesk/references/ansi.md) |
| `DOC-03` | Protocol spec | What syntax, geometry, and compatibility are normative? | `Core` | [v1.md](../packages/protocol/spec/v1.md) |
| `DOC-04` | Development docs | How do protocol, product, and Agent boundaries connect? | `Review` | [LLM–Human protocol](../apps/docs/content/docs/development/architecture/ansi-canvas-protocol.mdx) |
| `DOC-05` | MCP instructions | What workflow should an MCP-connected Agent prefer? | `Candidate` | [MCP server](../packages/mcp/src/server.ts) |
| `DOC-06` | Hook configuration | Which Codex lifecycle event launches the adapter? | `Candidate` | [Codex config](../.codex/config.toml) |

One fact should have one owner. Other surfaces should route to that owner rather
than reproduce the workflow.

## Evaluation inventory

| ID | Concept | Owner | Current evidence | Status |
| --- | --- | --- | --- | --- |
| `EVAL-01` | Goal and required-style checks | Evaluator | Case JSON and evaluator tests | `Review` |
| `EVAL-02` | Publication and protocol validity | Evaluator + authoring core | Product equals Styled and validation passes | `Core` |
| `EVAL-03` | First-pass acceptance and retries | Evaluator | `validation_result` trace events | `Review` |
| `EVAL-04` | Tool and patch counts | Evaluator | `tool_call` trace events | `Review` |
| `EVAL-05` | Token estimate | Evaluator | Input/output/reasoning characters divided by four | `Review` |
| `EVAL-06` | Default-style utilization and SGR density | Evaluator | Parsed Styled cells | `Review` |
| `EVAL-07` | `trace.jsonl` production | Coding-agent runner | Tests construct traces manually; no production writer is assigned | `Missing owner` |

Evaluation is evidence for choosing an authoring interface. It is not part of
the runtime authoring contract.

## Discussed but absent

| ID | Capability | Status | Consequence |
| --- | --- | --- | --- |
| `GAP-01` | Repository/CI verification of committed `.chardesk` files | `Not implemented` | Publication is not a repository acceptance gate |
| `GAP-02` | `verify` CLI command | `Not implemented` | Current commands are `validate` and `publish` |
| `GAP-03` | Prevention of direct `.chardesk` edits | `Not implemented` | An Agent may bypass the two-phase process |
| `GAP-04` | Agent-host tool permission that requires publication | `Not implemented` | `publish` is cooperative, not mandatory |
| `GAP-05` | Portable Agent trace runner | `Not implemented` | Ergonomic metrics require manually supplied trace data |
| `GAP-06` | Nested `tools.apply_patch` hook propagation | `Not implemented` by the current host | The Codex Hook cannot automate Code Mode patches |

## Occam Kanban

No item below is approved for removal. A candidate moves only after its public
contract, consumers, replacement, and verification are known.

| ID | Status | Observation | Decision needed | Evidence |
| --- | --- | --- | --- | --- |
| `OCCAM-01` | `Candidate` | `styled.ans` and `.chardesk` are byte-identical after publication | Can one styled representation own both work and product state? | `publishCanvasFiles` |
| `OCCAM-02` | `Candidate` | `styled.ans` stores ESC-less text despite `.ans` meaning terminal ANSI elsewhere | Choose an unambiguous work-file name or remove the duplicate representation | Protocol docs and validator |
| `OCCAM-03` | `Candidate` | CLI, MCP, and Hook wrap the same publication function | Which adapters have demonstrated consumers? | GitNexus callers and integration tests |
| `OCCAM-04` | `Candidate` | `@chardesk/mcp` mixes authoring, CLI, MCP, Hook, and evaluator concerns | Keep one package, rename it, or split runtime and evaluation ownership | Package manifest and imports |
| `OCCAM-05` | `Candidate` | Skill, development docs, MCP instructions, and Hook encode the same workflow | Select one workflow owner and turn other surfaces into routes | Linked instruction surfaces |
| `OCCAM-06` | `Missing owner` | Evaluator consumes `trace.jsonl` without a production writer | Assign a runner owner or remove trace-dependent metrics | Evaluator source and tests |
| `OCCAM-07` | `Review` | `publish` validates only when the Agent invokes it | Decide whether artifact validity or process compliance needs enforcement | CLI and absent CI check |
| `OCCAM-08` | `Candidate` | Hook does not observe nested patching and emits unsupported `suppressOutput` | Remove it, repair it as a Codex-only convenience, or prove a consumer | Hook config, handler, Codex docs |
| `OCCAM-09` | `Review` | `inspect` and `validate` overlap portions of `seed` and `publish` | Retain only commands justified by Agent traces or external consumers | CLI implementation |

## Decision record

| Date | Item | Decision | Evidence |
| --- | --- | --- | --- |
| 2026-08-15 | Baseline | Record the current framework before pruning; no removal approved | Source, tests, GitNexus, and official Agent boundaries |

## Update protocol

- Keep IDs stable; update status and decision instead of renumbering items.
- Give each fact one primary owner and one nearest verification route.
- Separate repository facts from design proposals and absent capabilities.
- Add a decision record only when an Owner, contract, or adapter changes.
- Reconfirm source and tests before moving a candidate to removal.
- Keep this page as a snapshot, not a tutorial or chronological work log.
