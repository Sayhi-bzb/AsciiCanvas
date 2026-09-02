---
name: chardesk
description: Create, edit, inspect, or render CharDesk visual documents through the CLI or live workspace tools.
---

# CharDesk

Every visual workspace belongs to a real working situation. Let the subject
reveal whose surface this is, what is happening, and which traces matter.
Compose from inside that situation and keep it implicit. User direction and the
existing document establish the scene when present.

Canonical source is authoritative; Canvas is its projection.

## Surfaces

- A `blackboard.yaml` or Blackboard package uses
  [`references/blackboard.md`](references/blackboard.md).
- A Slide source or deliverable uses
  [`references/slides.md`](references/slides.md).
- Creating or visually restructuring content uses the available
  [`materials`](references/materials.md).

New unspecified documents default to a Blackboard package. Existing source
determines its document contract. A standalone `.chardesk` remains a supported
Freeform Canvas input.

## Backstage

- Local paths, Slides, and artifacts use
  [`references/backstage/cli.md`](references/backstage/cli.md).
- A Blackboard workspace ID or URL uses
  [`references/backstage/live-workspace.md`](references/backstage/live-workspace.md)
  when `chardesk_blackboard_*` tools are available.
- With no target, prefer available live workspace tools; otherwise use the CLI.
- If a requested live Canvas has no tools, read
  [`references/backstage/experimental-live.md`](references/backstage/experimental-live.md).

## Delivery

Complete the required Agent actions. Hand off the result and only UI permission
or restart actions that require the human.
