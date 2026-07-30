<!-- gitnexus:start -->
# GitNexus

This repository is indexed by GitNexus.

Rules:
- Use GitNexus for dependency and execution-flow questions; use source or AST search for local implementation details.
- Before changing the behavior, signature, ownership, or contract of a shared symbol, run `gitnexus_impact({ target: "<symbol>", direction: "upstream" })`.
- Before committing code changes, run `gitnexus_detect_changes({ scope: "all" })` and confirm the affected scope is expected.
- Treat graph results as navigation and impact evidence; confirm conclusions in source and tests.
- If the index is stale, re-index only with `npx gitnexus analyze --skip-agents-md`.
- Do not run bare `npx gitnexus analyze`; it rewrites the GitNexus sections in `AGENTS.md` and `CLAUDE.md`.

Useful resources:
- Resolve `{repo}` with `gitnexus_list_repos`; do not pass it literally.
- `gitnexus://repo/{repo}/context`
- `gitnexus://repo/{repo}/processes`
- `gitnexus://repo/{repo}/process/{name}`

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
- [Dialog surfaces](docs/host/dialogs.md)
