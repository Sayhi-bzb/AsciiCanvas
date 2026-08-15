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
| `Hypothesis` | Product behavior worth testing; not an accepted contract |
| `Open question` | Product choice that must precede implementation |
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

The file workflow above is the current authoring implementation, not the final
product shape. The working product hypothesis is a shared blackboard.

## Shared Blackboard product hypothesis

```text
Conversation                         Blackboard
Human <---------- speech ----------> LLM
   \                                  /
    +---------- shared focus --------+
                     |
                     v
              named CharDesk Canvas
```

Chat carries intent, explanation, questions, and feedback. The Blackboard
carries spatial structure and the current shared model. A response may report
an action without reproducing the complete Canvas.

### Physical mapping

| ID | Physical concept | Product concept | Status |
| --- | --- | --- | --- |
| `BOARD-01` | Classroom | Chat or project scope | `Hypothesis` |
| `BOARD-02` | Named blackboard | Stable Canvas identity and current revision | `Hypothesis` |
| `BOARD-03` | Speech | Conversation response | `Hypothesis` |
| `BOARD-04` | Chalk | Write capability | `Hypothesis` |
| `BOARD-05` | Look at the board | Read the current revision | `Hypothesis` |
| `BOARD-06` | Write or erase locally | Patch the current Canvas | `Hypothesis` |
| `BOARD-07` | Erase the board | Explicit clear or replacement | `Hypothesis` |
| `BOARD-08` | Point at a mark | Ephemeral focus or region reference | `Hypothesis` |
| `BOARD-09` | Photograph the board | Meaningful checkpoint | `Hypothesis` |
| `BOARD-10` | Photo archive | Git or another durable history | `Hypothesis` |

The Blackboard is the stable metaphor. Teacher, student, and scribe are dynamic
roles rather than fixed identities:

| Role | Responsibility |
| --- | --- |
| Speaker | Expresses intent, explanation, or feedback in Conversation |
| Writer | Temporarily holds the Chalk and changes the Blackboard |
| Viewer | Observes the current Blackboard |
| Facilitator | Chooses the goal, focus, and accepted checkpoint |

Human and LLM may switch roles. An explanatory task may make the LLM a teacher;
capturing a Human idea may make it a scribe.

### Blackboard Contract draft

```text
You and the human share one named blackboard.
Chat is speech; the CharDesk Canvas is the board.
Look at the current board before taking the chalk.
Preserve useful marks; patch locally and clear only when explicitly asked.
Use space and sparse color to express relationships, not decoration.
After writing, briefly say what changed and point to the relevant area.
You do not watch the board while idle; read it again on the next turn.
```

This metaphor may compress workflow guidance by activating familiar Blackboard
behavior. It does not own storage, concurrency, syntax, or validation. Those
remain explicit digital contracts.

### Initial product laws

| ID | Law | Status |
| --- | --- | --- |
| `BOARD-11` | A Blackboard has a stable identity across turns | `Hypothesis` |
| `BOARD-12` | A Writer reads the current revision before writing | `Hypothesis` |
| `BOARD-13` | One turn holds the Chalk; a stale base revision is not silently overwritten | `Hypothesis` |
| `BOARD-14` | Patch is the default operation; clear is explicit | `Hypothesis` |
| `BOARD-15` | Human may watch continuously; an idle LLM does not | `Hypothesis` |
| `BOARD-16` | A Human change reaches the LLM through a later turn or explicit wake action | `Hypothesis` |
| `BOARD-17` | Git records meaningful checkpoints, not every stroke | `Hypothesis` |
| `BOARD-18` | Protocol validation, not the metaphor, decides whether content is valid | `Hypothesis` |

### Open product questions

| ID | Question | Why it matters | Status |
| --- | --- | --- | --- |
| `BOARD-Q01` | Does a Blackboard belong to one Chat, one Project, or the user? | Defines identity, discovery, and lifetime | `Open question` |
| `BOARD-Q02` | Is Human read-only first, or can Human and LLM both hold Chalk? | Determines whether conflict handling is needed in the first loop | `Open question` |
| `BOARD-Q03` | Is current state owned by a file, Yjs room, or service revision? | Determines persistence and transport | `Open question` |
| `BOARD-Q04` | How does a website observe new revisions? | Determines the local or remote bridge | `Open question` |
| `BOARD-Q05` | How does Chat point to a Blackboard region? | Connects speech to shared spatial attention | `Open question` |
| `BOARD-Q06` | Which actions create history or checkpoints? | Separates live state from durable archive | `Open question` |
| `BOARD-Q07` | Can a Canvas change start a turn, or only appear when a Human prompts? | Defines attention, cost, and autonomy | `Open question` |

No file, Yjs, MCP, Hook, Git, or service choice is implied until these product
questions are resolved.

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

### Blackboard framing evaluation

| ID | Hypothesis | Comparison | Evidence needed | Status |
| --- | --- | --- | --- | --- |
| `BOARD-EVAL-01` | Blackboard framing reduces workflow instruction while improving spatial expression | Technical workflow prompt vs Blackboard Contract | Goal score and Human review | `Hypothesis` |
| `BOARD-EVAL-02` | A Writer preserves useful marks instead of redrawing the whole board | Same modification tasks under both prompts | Unrelated-cell preservation and patch size | `Hypothesis` |
| `BOARD-EVAL-03` | Separating speech from board reduces duplicated response content | Same explanatory tasks under both prompts | Response overlap, output tokens, and task success | `Hypothesis` |
| `BOARD-EVAL-04` | Blackboard roles improve reference and change reporting | Tasks requiring correction of one region | Correct target, focus reference, and first-pass acceptance | `Hypothesis` |

These experiments test the metaphor before storage or synchronization work is
allowed to harden the product shape.

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
| `OCCAM-10` | `Review` | The three-file authoring workflow predates the Blackboard product hypothesis | Re-evaluate representations only after the Blackboard contract and first loop are selected | Current shape and `BOARD-Q*` |

## Decision record

| Date | Item | Decision | Evidence |
| --- | --- | --- | --- |
| 2026-08-15 | Baseline | Record the current framework before pruning; no removal approved | Source, tests, GitNexus, and official Agent boundaries |
| 2026-08-15 | Shared Blackboard | Adopt the Blackboard as a working product hypothesis; storage, writers, observation, and history remain open | `BOARD-01` through `BOARD-Q07` |

## Update protocol

- Keep IDs stable; update status and decision instead of renumbering items.
- Give each fact one primary owner and one nearest verification route.
- Separate repository facts from design proposals and absent capabilities.
- Add a decision record only when an Owner, contract, or adapter changes.
- Reconfirm source and tests before moving a candidate to removal.
- Keep this page as a snapshot, not a tutorial or chronological work log.
