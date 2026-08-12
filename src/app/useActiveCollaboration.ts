import { useEffect } from "react";
import {
  getCanvasCollaborationDocument,
  useEditorStore,
} from "@/domains/canvas/public";
import { collaborationRuntime } from "@/domains/collaboration/public";

export const useActiveCollaboration = () => {
  const activeCanvasId = useEditorStore((state) => state.activeCanvasId);
  const collaboration = useEditorStore((state) =>
    state.canvasSessions.find((session) => session.id === state.activeCanvasId)?.collaboration
  );
  const cursor = useEditorStore((state) => state.hoveredGrid);
  const selections = useEditorStore((state) =>
    state.canvasMode === "structured" ? state.selectedStructuredNodeIds : state.selections
  );
  const tool = useEditorStore((state) => state.tool);

  useEffect(() => {
    if (!collaboration) {
      void collaborationRuntime.disconnect();
      return;
    }
    const document = getCanvasCollaborationDocument(activeCanvasId);
    if (document) void collaborationRuntime.connect(collaboration, document);
    return () => { void collaborationRuntime.disconnect(); };
  }, [activeCanvasId, collaboration]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      collaborationRuntime.setPresence({ cursor, selection: selections, tool });
    }, 33);
    return () => window.clearTimeout(timer);
  }, [cursor, selections, tool]);
};
