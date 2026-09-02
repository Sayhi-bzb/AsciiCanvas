---
name: chardesk
description: Create, edit, inspect, show, or render CharDesk Canvas, Blackboard, CharGraph, and Slide content through the CLI or live workspace tools.
---

# CharDesk

Canonical source is the editable authority; Canvas cells are its projection.

## Access

- Slides, file artifacts, and explicit local paths use
  [`references/cli.md`](references/cli.md).
- An explicit Blackboard workspace ID or URL uses
  [`references/live-workspace.md`](references/live-workspace.md) when
  `chardesk_blackboard_*` tools are available.
- With no explicit target, prefer available live workspace tools; otherwise use
  the CLI.
- When a live Canvas is requested but its tools are unavailable, read
  [`references/experimental-live.md`](references/experimental-live.md).

## Context

- Content creation, editing, restructuring, or visual improvement uses the
  executable [`CharGraph casebook`](references/authoring.md).
- `blackboard.yaml` or a Blackboard package directory:
  [`references/blackboard.md`](references/blackboard.md).
- A Slide document or Slide deliverable:
  [`references/slides.md`](references/slides.md).

New unspecified documents default to a Blackboard package. Existing source
determines its document contract. A standalone `.chardesk` remains a supported
Freeform Canvas input.

## Delivery

Execute available setup, inspection, opening, rendering, and navigation actions
directly. Open the first complete delivery once. Later filesystem edits are live:
inspect them, then reuse the existing page without another open/close cycle. When
the human asks to view a workspace after its local page was closed, run `open`
again; the CLI reuses or recreates the session without a maintenance workflow.
User-facing handoff reports the result and only the privileged UI action that
requires the human.
