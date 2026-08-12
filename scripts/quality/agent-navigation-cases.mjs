export const AGENT_NAVIGATION_CASES = [
  {
    id: "slide-size",
    question: "Where are custom slide size validation, resizing, crop, and editor coordination owned?",
    expectedOwner: "slides",
    ownerPrefixes: ["src/domains/slides/", "src/domains/canvas/state/slices/createSlideSlice.ts"],
    anchors: [
      "src/domains/slides/deck.ts:resizeSlide",
      "src/domains/canvas/state/slices/createSlideSlice.ts:resizeSlide",
    ],
  },
  {
    id: "collaboration-remote-update",
    question: "canvas domain remote Yjs document projection into local editor state",
    expectedOwner: "canvas",
    ownerPrefixes: ["src/domains/canvas/"],
    anchors: [
      "src/domains/canvas/state/canvasDocument.ts:observeActiveScene",
      "src/domains/canvas/state/editorStore.ts:useEditorStore",
    ],
  },
  {
    id: "slide-preview",
    question: "What renders slide sidebar thumbnails and keeps preview geometry consistent?",
    expectedOwner: "widgets",
    ownerPrefixes: ["src/widgets/toolbar/"],
    anchors: [
      "src/widgets/toolbar/slide-preview-canvas.tsx:SlidePreviewCanvas",
      "src/widgets/toolbar/slide-canvas-renderer.ts:drawSlideCanvas",
    ],
  },
  {
    id: "selection-command-registration",
    question: "actions domain selection commands composition root registration factory",
    expectedOwner: "actions",
    ownerPrefixes: ["src/domains/actions/", "src/app/compositionRoot.ts"],
    anchors: [
      "src/domains/actions/adapters/selectionCommands.ts:registerSelectionCommands",
      "src/domains/canvas/state/selectionCommandPort.ts:registerSelectionCommandFactory",
    ],
  },
  {
    id: "session-persistence",
    question: "sessions domain persistence schema migration restore editor adapter",
    expectedOwner: "sessions",
    ownerPrefixes: [
      "src/domains/sessions/",
      "src/domains/canvas/state/editorPersistence.ts",
      "src/domains/canvas/state/editorStore.ts",
    ],
    anchors: [
      "src/domains/sessions/persistence.ts:migratePersistedStateToV5",
      "src/domains/canvas/state/editorStore.ts:migrate",
    ],
  },
  {
    id: "structured-scene-update",
    question: "structured-content normalizeScene renderStructuredScene sceneToGridEntries applyStructuredScene",
    expectedOwner: "structured-content",
    ownerPrefixes: ["src/domains/structured-content/"],
    anchors: [
      "src/domains/structured-content/model/scene.ts:normalizeScene",
      "src/domains/canvas/state/editorStore.ts:applyStructuredScene",
    ],
  },
  {
    id: "document-import",
    question: "document domain external content parse import slides protocol session source",
    expectedOwner: "document",
    ownerPrefixes: ["src/domains/document/"],
    anchors: [
      "src/domains/document/session-source.ts:parseDocumentSessionSource",
      "src/domains/document/protocol/import.ts:protocolDocumentToSnapshot",
    ],
  },
  {
    id: "history",
    question: "Where are canvas undo redo history and interaction checkpoints owned?",
    expectedOwner: "canvas",
    ownerPrefixes: ["src/domains/canvas/"],
    anchors: [
      "src/domains/canvas/state/canvasDocument.ts:undoManager",
      "src/domains/canvas/state/canvasDocument.ts:beginCanvasHistoryCheckpoint",
    ],
  },
];
