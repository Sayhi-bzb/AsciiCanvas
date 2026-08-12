import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import {
  initializeCanvasTesting,
  testingCanvasRuntime,
} from '@/domains/canvas/testing';
import { createSelectionCommandFactory, createEditorCommandsExtension } from '@/domains/actions/public';
import { parseDocumentSessionSource } from '@/domains/document/public';
import { configureCanvasRuntimeFallbackForTesting } from '@/domains/canvas/react';
import { createCollaborationRuntime } from '@/domains/collaboration/public';
import { configureCollaborationRuntimeFallbackForTesting } from '@/domains/collaboration/react';
import { configureEditorRuntimeFallbackForTesting } from '@/domains/editor/react';
import {
  createCanvasEditorExtension,
  createCanvasEditorRuntime,
} from '@/domains/editor/public';
import { CanvasEngineRuntime } from '@/widgets/canvas-editor/engine/CanvasEngineRuntime';
import { configureCanvasEngineRuntimeFallbackForTesting } from '@/widgets/canvas-editor/engine/useCanvasEngineRuntime';

initializeCanvasTesting({
  selectionCommands: (documents) => createSelectionCommandFactory({
    getActiveDocumentId: documents.getActiveDocumentId,
  }),
  parseSessionSource: parseDocumentSessionSource,
});
configureCanvasRuntimeFallbackForTesting(testingCanvasRuntime);

const editor = createCanvasEditorRuntime({
  state: {
    get: testingCanvasRuntime.getState,
    subscribe: testingCanvasRuntime.subscribe,
  },
  history: testingCanvasRuntime.commands.history,
  transactions: { run: testingCanvasRuntime.commands.history.transact },
  onToolChange: testingCanvasRuntime.commands.tools.set,
});
editor
  .registerExtension(createCanvasEditorExtension(editor.interactionPort))
  .registerExtension(createEditorCommandsExtension(testingCanvasRuntime))
  .start(editor.getState().tool);
configureEditorRuntimeFallbackForTesting(editor);

const collaboration = createCollaborationRuntime();
configureCollaborationRuntimeFallbackForTesting(collaboration);

const engine = new CanvasEngineRuntime({
  getViewport: () => {
    const state = testingCanvasRuntime.getState();
    return { offset: state.offset, zoom: state.zoom };
  },
  setViewport: testingCanvasRuntime.commands.viewport.setViewport,
});
configureCanvasEngineRuntimeFallbackForTesting(engine);

afterEach(() => {
  cleanup();
});
