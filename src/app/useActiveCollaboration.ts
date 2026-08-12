import { useEffect } from "react";
import {
  useCanvasRuntime,
  useCanvasState,
} from "@/domains/canvas/public";
import { useCollaborationRuntime } from "@/domains/collaboration/public";

export const useActiveCollaboration = () => {
  const canvas = useCanvasRuntime();
  const collaborationRuntime = useCollaborationRuntime();
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
    const document = canvas.queries.getCollaborationDocument(activeCanvasId);
    if (document) void collaborationRuntime.connect(collaboration, document);
    return () => { void collaborationRuntime.disconnect(); };
  }, [activeCanvasId, canvas, collaboration, collaborationRuntime]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      collaborationRuntime.setPresence({ cursor, selection: selections, tool });
    }, 33);
    return () => window.clearTimeout(timer);
  }, [collaborationRuntime, cursor, selections, tool]);
};
