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

- Assume LLMs know general engineering concepts; document only project-specific context.
- Documentation routes knowledge to its owner; it does not reproduce tutorials or source.
- One page owns one question, and each fact has one authoritative source.
- Link authorities and connect decisions, contracts, implementation, and verification.
- Use stable vocabulary and the fewest sufficient words; remove repetition and low-value explanation.

# Documentation Ownership

- `README.md` and `README.zh-CN.md` are the user-facing product entry points.
- `packages/protocol/README.md` owns protocol installation and API usage.
- `packages/fonts/README.md` owns font installation and consumption.
- `package.json` owns scripts, dependencies, and local commands.

# Architecture Navigation

- [Blackboard product graph](kanban/FRAMEWORK_KANBAN.md)
- [Ownership and dependency direction](apps/docs/content/docs/development/architecture/ownership.mdx)
- [LLM–Human Text Protocol](apps/docs/content/docs/development/architecture/ansi-canvas-protocol.mdx)
- [Domain reference](apps/docs/content/docs/development/domains.mdx)
- [Agent navigation benchmark](apps/docs/content/docs/development/quality.mdx#agent-navigation)
- Treat the domain reference as the authority for business responsibility and the ownership map as the authority for dependency direction; confirm implementation details in source and tests.

# Frontend Host Rules

- [Core host icon controls](apps/docs/content/docs/development/host-ui/icon-controls.mdx)
- [Dialog surfaces](apps/docs/content/docs/development/host-ui/dialogs.mdx)
- [Interface content](apps/docs/content/docs/development/host-ui/interface-content.mdx)
