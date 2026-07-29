<!-- gitnexus:start -->
# GitNexus

This repo is indexed by GitNexus as **AsciiCanvas**. Use GitNexus MCP for code exploration, impact analysis, and change verification.

Rules:
- Before editing any function, class, method, or shared API, run `gitnexus_impact({ target: "<symbol>", direction: "upstream" })`.
- Before finishing a code-change task, run `gitnexus_detect_changes({ scope: "all" })` and confirm the affected scope is expected.
- If the index is stale, re-index only with `npx gitnexus analyze --skip-agents-md`.
- Do not run bare `npx gitnexus analyze`; it rewrites the GitNexus sections in `AGENTS.md` and `CLAUDE.md`.

Useful resources:
- `gitnexus://repo/AsciiCanvas/context`
- `gitnexus://repo/AsciiCanvas/processes`
- `gitnexus://repo/AsciiCanvas/process/{name}`

<!-- gitnexus:end -->

# Docs Writing Rules

Apply these rules when writing or editing docs.

- Use high-information wording that locks direction with the fewest sufficient terms.
- Do not add broad, repeated, or low-marginal words when existing terms already identify the concept.
- Keep docs orthogonal: one page should own one kind of question.
- Maintain navigation and context routes so readers and agents load only the context needed for the current task.
- Keep a single source of truth for each key fact, principle, or decision.
- Link to the authoritative source instead of restating or rewording the same rule elsewhere.
- Use stable vocabulary: one concept gets one name across docs.
- Do not introduce a new rule, label, or concept when an existing one explains the point.
- Prefer restrained, minimal, sufficient writing over exhaustive explanation.

# Frontend Host Rules

- [Core host icon controls](docs/host/icon-controls.md)
