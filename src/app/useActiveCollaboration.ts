import { useEffect, useMemo, useRef } from "react";
import {
  useCanvasRuntime,
  useCanvasState,
} from "@/domains/canvas/public";
import {
  buildCollaborationUrl,
  parseCollaborationUrl,
  sameCollaborationRoom,
  stripCollaborationUrl,
  useCollaborationRuntime,
} from "@/domains/collaboration/public";
import { getStaticGridSelectionAreas } from "@/domains/selection/public";

export const useActiveCollaboration = ({ enabled = true }: { enabled?: boolean } = {}) => {
  const canvas = useCanvasRuntime();
  const collaborationRuntime = useCollaborationRuntime();
  const incomingCollaboration = useMemo(
    () =>
      typeof window === "undefined"
        ? { status: "none" as const }
        : parseCollaborationUrl(),
    []
  );
  const pendingIncomingCollaboration = useRef(
    incomingCollaboration.status === "valid" ? incomingCollaboration.descriptor : null
  );
  const preserveIncomingError = useRef(
    incomingCollaboration.status === "invalid" || incomingCollaboration.status === "unsupported"
  );
  const activeCanvasId = useCanvasState((state) => state.activeCanvasId);
  const collaboration = useCanvasState((state) =>
    state.canvasSessions.find((session) => session.id === state.activeCanvasId)?.collaboration
  );
  const cursor = useCanvasState((state) => state.hoveredGrid);
  const canvasMode = useCanvasState((state) => state.canvasMode);
  const selectedStructuredNodeIds = useCanvasState(
    (state) => state.selectedStructuredNodeIds
  );
  const staticGridSelection = useCanvasState((state) => state.staticGridSelection);
  const grid = useCanvasState((state) => state.grid);
  const selections = useMemo(
    () =>
      canvasMode === "structured"
        ? selectedStructuredNodeIds
        : getStaticGridSelectionAreas(staticGridSelection, grid),
    [canvasMode, grid, selectedStructuredNodeIds, staticGridSelection]
  );
  const tool = useCanvasState((state) => state.tool);
  const joinCollaboration = canvas.commands.sessions.joinCollaboration;

  useEffect(() => {
    if (!enabled) return;
    const incoming = pendingIncomingCollaboration.current;
    if (!incoming) return;
    if (sameCollaborationRoom(collaboration, incoming)) {
      pendingIncomingCollaboration.current = null;
      return;
    }
    joinCollaboration(incoming);
  }, [collaboration, enabled, joinCollaboration]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const incoming = pendingIncomingCollaboration.current;
    if (incoming && !sameCollaborationRoom(collaboration, incoming)) return;
    if (incoming) pendingIncomingCollaboration.current = null;

    if (!collaboration && preserveIncomingError.current) return;
    preserveIncomingError.current = false;
    const nextUrl = collaboration
      ? buildCollaborationUrl(collaboration)
      : stripCollaborationUrl();
    if (nextUrl !== window.location.href) {
      window.history.replaceState(null, "", nextUrl);
    }
  }, [collaboration, enabled]);

  useEffect(() => {
    if (!enabled) {
      void collaborationRuntime.disconnect();
      return;
    }
    if (!collaboration) {
      void collaborationRuntime.disconnect();
      return;
    }
    const document = canvas.queries.getCollaborationDocument(activeCanvasId);
    if (document) void collaborationRuntime.connect(collaboration, document);
    return () => { void collaborationRuntime.disconnect(); };
  }, [activeCanvasId, canvas, collaboration, collaborationRuntime, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(() => {
      collaborationRuntime.setPresence({ cursor, selection: selections, tool });
    }, 33);
    return () => window.clearTimeout(timer);
  }, [collaborationRuntime, cursor, enabled, selections, tool]);
};
