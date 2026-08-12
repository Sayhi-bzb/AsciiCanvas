import { useEffect } from "react";
import {
  canvasQueries,
  useCanvasState,
} from "@/domains/canvas/public";
import { collaborationRuntime } from "@/domains/collaboration/public";

export const useActiveCollaboration = () => {
  const activeCanvasId = useCanvasState((state) => state.activeCanvasId);
  const collaboration = useCanvasState((state) =>
    state.canvasSessions.find((session) => session.id === state.activeCanvasId)?.collaboration
  );
  const cursor = useCanvasState((state) => state.hoveredGrid);
  const selections = useCanvasState((state) =>
    state.canvasMode === "structured" ? state.selectedStructuredNodeIds : state.selections
  );
  const tool = useCanvasState((state) => state.tool);

  useEffect(() => {
    if (!collaboration) {
      void collaborationRuntime.disconnect();
      return;
    }
    const document = canvasQueries.getCollaborationDocument(activeCanvasId);
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
