---
name: chardesk
description: Create, edit, inspect, or render CharDesk visual documents through the CLI or live workspace tools.
---

# CharDesk

Canonical source is authoritative; Canvas is its projection.

## Route

- Local paths, Slides, and artifacts use
  [`references/cli.md`](references/cli.md).
- A Blackboard workspace ID or URL uses
  [`references/live-workspace.md`](references/live-workspace.md) when
  `chardesk_blackboard_*` tools are available.
- With no target, prefer available live workspace tools; otherwise use the CLI.
- If a requested live Canvas has no tools, read
  [`references/experimental-live.md`](references/experimental-live.md).
- Creating or visually restructuring content uses the executable
  [`CharGraph casebook`](references/authoring.md).
- A `blackboard.yaml` or Blackboard package uses
  [`references/blackboard.md`](references/blackboard.md).
- A Slide source or deliverable uses
  [`references/slides.md`](references/slides.md).

New unspecified documents default to a Blackboard package. Existing source
determines its document contract. A standalone `.chardesk` remains a supported
Freeform Canvas input.

## Delivery

Complete the required Agent actions. Hand off the result and only UI permission
or restart actions that require the human.
