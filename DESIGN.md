# CharDesk Product Design

CharDesk is a shared visual medium for humans and language models. People read
space, hierarchy, and rhythm; agents edit text, files, and diffs. Product design
must preserve both sides of that relationship.

This document is the highest-level design authority for the CharDesk product
interface. It defines product judgment, not visual implementation. Follow the
linked authorities for component, surface, copy, state, and domain contracts.

## Scope

Load this document when shaping, implementing, or reviewing a user-facing
CharDesk product interface. It applies to workflows, information architecture,
interaction, layout, product copy, responsive behavior, accessibility, and all
user-visible states.

It does not govern marketing pages, prose documentation, backend-only work, or
the visual style of content authored inside Canvas, Blackboard, CharGraph, or
Slides. For creating or editing those artifacts, use the
[`chardesk` skill](.agents/skills/chardesk/SKILL.md).

## Product Promise

CharDesk turns Unicode text into a workspace that people and agents can inspect
and revise together. The product should make structure visible without turning
text into an opaque image or hiding its editable source.

Every interface should strengthen at least one part of this promise:

- **See:** people can perceive the scene, hierarchy, state, and next action.
- **Edit:** agents and people can change the underlying artifact precisely.
- **Share:** the same artifact survives copying, saving, diffing, and continued work.

Features that do not strengthen this loop must justify the attention and
complexity they add.

## Operating Contract

- **Start with the work.** Identify the person, artifact, current state, intended
  change, and successful outcome before choosing a surface.
- **Protect meaning before appearance.** Preserve source content, document
  structure, spatial relationships, user intent, and consequential state.
- **Keep ownership explicit.** Route decisions to their canonical domain or UI
  authority. Existing code proves what exists, not that it is the desired pattern.
- **Separate facts from decisions.** Mark assumptions, unknowns, and unresolved
  product choices instead of burying them in implementation details.
- **Prefer the smallest complete workflow.** Remove steps and competing controls
  before compressing labels or hiding capability.
- **Verify the real interface.** Source inspection establishes behavior; rendered
  use establishes hierarchy, continuity, legibility, and interaction quality.

When requirements compete, protect them in this order:

1. User work, content integrity, privacy, and irreversible consequences.
2. A clear relationship between the artifact, its source, and its current state.
3. Direct, understandable progress through the primary workflow.
4. Consistency with established product behavior and shared interface contracts.
5. Accessibility, resilience, and continuity across input methods and form factors.
6. Visual refinement that does not weaken any priority above it.

## Request Modes

Resolve the request mode before acting:

- **Shape:** define the user problem, desired behavior, success signal, non-goals,
  and unresolved decisions. Do not commit product policy silently through a mockup.
- **Implement:** load the relevant authorities, compose established product
  behavior, connect real state, and cover the complete workflow.
- **Review:** report findings with evidence and user impact. Do not turn an audit
  into an edit unless implementation was requested.
- **Copy:** improve understanding and action without changing product behavior or
  expanding the surface.
- **Harden:** preserve the intended interaction while covering accessibility,
  localization, content extremes, recovery, and device variation.

## Product Principles

### The workspace is the product

Canvas and its artifact carry the user's work. Host chrome should orient, enable,
and respond without becoming the focal composition. Give persistent space only
to persistent value. Let transient tools recede when they are not relevant.

Do not treat the workspace as a backdrop for a conventional application shell.
The artifact, selection, viewport, source mode, and collaboration state form one
working context.

### One artifact serves two readers

People need a legible scene; agents need stable, inspectable source. Never improve
one by making the other opaque. Preserve text selection, copying, source access,
semantic structure, and precise revision wherever the artifact supports them.

Do not fake product output with screenshots, flattened previews, or decorative
approximations when the real artifact can be rendered.

### Source and projection remain honest

Respect the authority of each document mode. Source-backed workspaces treat their
canonical source as authoritative and Canvas as its projection. Directly edited
Canvas sessions preserve the Canvas document as the editable artifact. The
interface must not imply that a derived view is independently editable when it is
not, or conceal where a change will be written.

Mode changes, compilation, imports, and projections should preserve context and
make ownership visible at the moment it matters.

### Capability follows intent

CharDesk is powerful, but the full toolset is rarely the user's immediate job.
Lead with the actions available in the current mode and state. Reveal secondary
capability through proximity, progressive disclosure, or deliberate mode changes.

Do not duplicate the same action across competing surfaces. Do not expose a
control merely because the underlying system has a capability.

### Direct manipulation preserves continuity

Prefer acting on the visible artifact, selection, page, or source over configuring
an abstract representation elsewhere. Keep the object of an action visible when
possible, and keep navigation, focus, zoom, and selection stable across routine
operations.

Actions should be reversible when the domain allows it. When they are not, make
the affected object and consequence clear before commitment and provide an honest
recovery path afterward.

### State appears where it matters

Selection, active mode, connection, compilation, saving, permission, loading,
success, warning, and failure are different meanings. Present the relevant state
near the object or action it qualifies, and pair visual treatment with words,
icons, or accessible announcements when needed.

Do not use one visual signal for unrelated meanings. Do not repeat the same state
in multiple places unless each occurrence answers a different user question.

### Density reflects a working tool

CharDesk may be compact because it is an editor, not because information is
disposable. Keep related controls close, maintain strong grouping, and let
alignment carry structure. Add explanation only for constraints, consequences,
or unfamiliar behavior.

Avoid both spacious presentation-page composition and indiscriminate compression.
Users should scan the interface without decoding it.

### Complexity remains available, not required

The first useful action should not require understanding every document mode,
format, collaboration feature, or export path. Beginners should be able to act
without losing access to expert capability. Experts should not be forced through
ceremonial guidance on repeated use.

Prefer contextual learning, meaningful defaults, and reversible exploration over
front-loaded instruction.

### Every form factor preserves the job

Responsive design may change placement, visibility, and interaction sequence, but
not the user's access to essential work. Preserve the artifact, primary action,
state, and recovery path across pointer, keyboard, touch, narrow, and wide layouts.

Adapt the Host around the workspace instead of shrinking the desktop shell until
it technically fits.

### Trust is part of the interface

Make storage, sharing, collaboration, permissions, external connections, and
destructive effects understandable before they surprise the user. Never invent
success, hide degraded state, or imply persistence that has not occurred.

Product copy should be concise, literal, and action-oriented. Name the affected
artifact or state, explain material consequences, and give the next useful action.

## Reject Generic Product Reflexes

Do not default to:

- a dashboard of interchangeable cards around the workspace;
- terminal decoration, fake logs, or monospace styling used only to signal a
  developer aesthetic;
- permanent chrome for occasional actions;
- nested panels that separate controls from the artifact they affect;
- modal interruption for routine, reversible work;
- hidden state, unexplained disabled actions, or success that exists only in color;
- duplicate labels, instructions, status, navigation, or actions;
- feature-first navigation that mirrors internal architecture instead of user work;
- mobile layouts that remove essential capability rather than adapting its access;
- polished empty states that offer no meaningful next action.

Avoiding these defaults must not produce a featureless interface. CharDesk should
feel precise, spatial, capable, and alive to the work currently on the board.

## Route to Canonical Authorities

Use this document to make the product decision, then load only the authority that
owns the implementation question:

| Question | Authority |
| --- | --- |
| Visual hierarchy, surfaces, shared primitives, interaction states | [Visual system](apps/docs/content/docs/development/host-ui/visual-system.mdx) |
| Visible labels, descriptions, terminology, localization | [Interface content](apps/docs/content/docs/development/host-ui/interface-content.mdx) |
| Dialog, AlertDialog, Sheet, and modal composition | [Dialog surfaces](apps/docs/content/docs/development/host-ui/dialogs.mdx) |
| Core Host actions, icons, and control association | [Core Host icon controls](apps/docs/content/docs/development/host-ui/icon-controls.mdx) |
| Product capability ownership and public contracts | [Domain reference](apps/docs/content/docs/development/domains.mdx) |
| Source, projection, persistence, and collaboration flow | [State and data flows](apps/docs/content/docs/development/architecture/state-flows.mdx) |

Do not duplicate these contracts here. If an authority is missing or conflicts
with the desired product behavior, record the gap and require an explicit product
decision before establishing a new standard.

## Verification

Before implementation, establish:

- who is acting and what artifact or product object they are changing;
- the current state, intended outcome, consequence, and recovery path;
- the primary workflow, non-goals, and authorities that own its behavior;
- the meaningful empty, sparse, dense, loading, error, read-only, and collaborative
  conditions.

Before handoff, verify the rendered product in the states and form factors affected
by the change. Check hierarchy, focus order, keyboard and pointer behavior, touch
access where relevant, localization, content extremes, state announcements,
recovery, and continuity of artifact, viewport, selection, and source.

Report what was verified and what remains an assumption. A visually plausible
first state is not a complete CharDesk interaction.
