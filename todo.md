# Canvas Interaction Refactor Blueprint

## Goal

Refactor the canvas gesture interaction layer so interaction rules are explicit,
testable, and easier to evolve without changing the existing editor behavior.

The target is to reduce the complexity concentrated in `useCanvasInteraction`
while preserving the current freeform, structured, and animation workflows.

## Target Architecture

- Keep `@use-gesture/react` as the low-level gesture adapter for pointer, drag,
  wheel, click, and double-click events.
- Keep Zustand and Yjs as the source of truth for editor state, transactions,
  persistence, and history boundaries.
- Introduce a typed interaction engine that receives normalized input events
  and returns state transitions plus side effects.
- Keep transient drag and preview data outside React render state. Use refs and
  `requestAnimationFrame` for high-frequency preview updates.
- Keep `useCanvasRenderer` read-only. Rendering should project current state and
  preview state, not decide interaction semantics.

## Subsystems

- `interaction/`: owns the extracted canvas interaction subdomain under the
  `AsciiCanvas` hook boundary. Keep new decision, execution, preview,
  structured, viewport, and core interaction modules inside this subtree rather
  than adding more flat `hooks/*.ts` files.
- `gestureAdapter`: converts browser and `@use-gesture/react` callbacks into
  domain-level input events.
- `coordinateService`: centralizes `screenToGrid`, character-start snapping,
  zoom anchoring, and animation bounds clamping.
- `hitTestService`: centralizes structured node hit testing, resize handle hits,
  text caret hits, link hits, and canvas UI ignore checks.
- `interactionMachine`: owns the active interaction state and transition rules.
- `previewController`: owns RAF-throttled drag previews, hover state, cursors,
  and manual render requests.
- `commitController`: owns final store writes, Yjs transaction mode, history
  save/merge boundaries, and cleanup after gestures finish.

## State Model

Use a discriminated union for interaction state:

```ts
type InteractionState =
  | { type: "idle" }
  | { type: "panning"; lastScreen: Point }
  | { type: "selecting"; anchor: Point; current: Point }
  | { type: "drawing"; tool: ToolType; lastGrid: Point }
  | { type: "shapePreview"; tool: ToolType; start: Point; axis: "horizontal" | "vertical" | null }
  | { type: "structuredMoving"; ids: string[]; anchor: Point; baseScene: StructuredNode[] }
  | { type: "structuredRectResizing"; nodeId: string; handle: StructuredBoxResizeHandle }
  | { type: "structuredSplitBoxResizing"; nodeId: string; handle: StructuredSplitBoxHandle }
  | { type: "structuredLineResizing"; nodeId: string; handle: StructuredLineResizeHandle }
  | { type: "structuredTextSelecting"; nodeId: string; anchorOffset: number };
```

The interaction engine should keep temporary geometry in this state or in
private refs. Durable editor state should still be committed through the canvas
store.

## Migration Phases

1. [done] Extract coordinate helpers from `useCanvasInteraction`.
   - Move screen-to-grid conversion, snap behavior, animation clamping, and zoom
     anchoring into a small helper module.
   - Keep call sites behavior-compatible.

2. [done] Extract hit testing.
   - Move structured handle hit testing, caret hit testing, link hit testing,
     minimap ignore checks, and canvas UI ignore checks into a dedicated module.
   - Keep existing `structuredBoxEditing` geometry helpers as the source of
     truth for structured node bounds and handles.

3. [started] Add the interaction engine.
   - Define `InteractionState`, `InteractionEvent`, and `InteractionEffect`.
   - Implement pure transition tests before migrating behavior.
   - Keep the first version small: no XState dependency unless a later phase
     proves the custom reducer is insufficient.

4. [started] Migrate low-risk flows.
   - Move panning, wheel zoom, link hover, color picker hover, and freeform
     selection into the engine.
   - Keep RAF throttling for panning and selection preview.

5. Migrate drawing and shape preview.
   - Move brush, eraser, freeform shape preview, and structured shape creation
     into engine-driven transitions.
   - Preserve history behavior: merge during continuous updates and save at
     gesture end.

6. Migrate structured editing.
   - Move structured node move, rect resize, line resize, splitBox resize, and
     structured text selection into explicit states.
   - Preserve current preview behavior for structured moving and splitBox
     divider resizing.

7. Collapse the old hook.
   - Leave `useCanvasInteraction` as the React wiring layer.
   - Remove duplicated refs and branch logic once each behavior has an engine
     equivalent.
   - Keep public component props unchanged.

## Testing Plan

- Unit test coordinate conversion, snapping, animation clamping, and zoom
  anchoring.
- Unit test hit testing for structured nodes, selected handles, splitBox
  dividers, text caret offsets, and links.
- Unit test interaction transitions for panning, selecting, drawing, moving,
  resizing, and structured text selection.
- Component test freeform selection, text entry, fill, paste, structured node
  move, structured node resize, splitBox divider resize, and double-click text
  editing.
- E2E test representative pointer and keyboard workflows across freeform,
  structured, and animation modes.
- Run focused Vitest suites after each phase. Before finishing the full
  refactor, run `npm run test:run` and the relevant Playwright tests.

## Acceptance Criteria

- `useCanvasInteraction` mainly wires DOM events to the interaction engine.
- Interaction transitions are represented by typed states rather than implicit
  combinations of refs and nested branches.
- Freeform, structured, and animation core interactions do not regress.
- High-frequency drag and resize previews still use RAF and do not cause React
  render churn.
- Yjs history semantics remain intact: continuous gestures merge, gesture end
  creates the expected save boundary.
- New interaction logic has direct unit-test entry points.

## Defaults

- Do not replace the editor core with Konva, Fabric, or tldraw.
- Do not introduce a rich text editor dependency for canvas text editing.
- Do not add XState in the first refactor pass.
- Keep `GridMap`, `StructuredNode`, `AnimationTimeline`, and protocol v1 as the
  domain model.
- Treat existing `.claude` changes as unrelated user work.

## Progress Notes

### Completed

- Phase 1 is complete: coordinate conversion, wide-character snapping,
  animation bounds clamping, and zoom anchoring live in the interaction core.
- Phase 2 is complete: canvas UI guards, minimap guards, structured handle/caret
  hit testing, and link hit testing are isolated from the main hook.
- The extracted interaction modules are consolidated under
  `src/domains/canvas/components/AsciiCanvas/hooks/interaction/` with `core`,
  `gestures`, `structured`, `preview`, `viewport`, and `commit` subdomains.
- `useCanvasRenderer` no longer owns interaction handle geometry. Renderer and
  hit testing share the neutral structured handle geometry helper.

### In Progress

- Phase 3 is started: `interactionMachine.ts` defines typed interaction state
  and transition events, while `useCanvasInteraction` still uses a legacy adapter
  for branches that have not fully moved behind engine effects.
- Phase 4 is mostly implemented for low-risk flows. Panning, wheel/pinch zoom,
  link hover, color picker hover/start, selection preview, click, move, and drag
  reset behavior now route through focused interaction helpers and controllers.
- Commit and preview responsibilities are split out. Selection commits,
  drag-end commit routing, structured preview queues, hover state, viewport
  queueing, and RAF coalescing have direct unit-test entry points.

### Recently Landed

- Drag start, drag update, drag end, and continuous drawing updates now use
  explicit decision/execution helpers for primary canvas interactions, panning,
  selection, brush/eraser updates, drawing/shape starts, structured select
  starts, structured preview queues, and commit cleanup. Drag-start routing,
  primary canvas drag start, drag-start pointer adaptation, drag-update routing,
  non-panning drag update, drag-end routing, primary drag end, and
  brush/eraser update execution are further composed by handlers, so the hook
  only supplies DOM-derived inputs plus grid/context snapshots for those paths.
- Click, move, wheel, pinch, and color-picker interactions now have gesture-level
  decision/execution modules. Click, move, wheel, and pinch are further composed
  by handlers. Click routing now owns point/link resolution and link-open
  eligibility adaptation, move routing owns hover-context resolution flags, and
  wheel/pinch routing own anchor resolution short-circuiting plus event-specific
  preventDefault/delta adaptation. Shared gesture guards now centralize
  canvas-UI/minimap filtering, while the hook supplies pointer-derived context
  and callbacks for those paths.
- Structured select/edit work has been split into structured modules for hit
  resolution, drag-start setup, double-click edit routing, text selection
  starts, move/resize preview calculations, and structured edit execution.

### Remaining Work

- Phase 5 is partially started through drawing and shape helpers. Brush and
  eraser update execution now sit behind a handler, while freeform shape
  preview and structured shape creation are not yet fully engine-driven
  transitions.
- Phase 6 is partially started through structured select/edit/move/resize
  helpers, but structured move, rect resize, line resize, splitBox resize, and
  structured text selection are not yet fully represented as explicit engine
  states with effects.
- Phase 7 is not complete. `useCanvasInteraction` is smaller, but it still owns
  DOM gesture adaptation, pointer-context assembly, event-specific
  `preventDefault`, and some decision/execution orchestration.

### Verification

- Latest focused verification passed: `37` canvas interaction test files and
  `292` tests.
- `npx tsc -b` passed after the latest handler cleanup.
- `git diff --check` reports only CRLF normalization warnings.
