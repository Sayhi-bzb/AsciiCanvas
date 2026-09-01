import { useCallback, useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useBlackboardRuntime } from "@/domains/blackboard/public";
import { isBlackboardRoute } from "./blackboardRoute";
import { useCanvasRuntime, useCanvasState } from "@/domains/canvas/public";

type BlackboardModeStatus =
  | { state: "idle" | "current" | "waiting"; message: string }
  | { state: "warning" | "missing"; message: string };

export const useBlackboardWorkspace = ({ enabled = true }: { enabled?: boolean } = {}) => {
  const runtime = useBlackboardRuntime();
  const canvas = useCanvasRuntime();
  const { activeSessionId, activeWorkspaceId } = useCanvasState(useShallow((state) => {
    const session = state.canvasSessions.find(
      (candidate) => candidate.id === state.activeCanvasId,
    );
    return session?.mode === "blackboard"
      ? { activeSessionId: session.id, activeWorkspaceId: session.workspaceId }
      : { activeSessionId: null, activeWorkspaceId: null };
  }));
  const [status, setStatus] = useState<BlackboardModeStatus>({
    state: "idle",
    message: "",
  });
  const [firstFitRevision, setFirstFitRevision] = useState(0);
  const generationRef = useRef(0);
  const fittedSessionsRef = useRef(new Set<string>());

  const project = useCallback(async (sessionId: string, workspaceId: string) => {
    const generation = ++generationRef.current;
    setStatus({ state: "waiting", message: "Compiling" });
    try {
      const compiled = await runtime.compile(workspaceId);
      if (generation !== generationRef.current) return;
      canvas.commands.sessions.replaceBlackboardProjection(
        sessionId,
        compiled.snapshot,
        { title: compiled.title, preserveViewport: true },
      );
      if (!fittedSessionsRef.current.has(sessionId)) {
        fittedSessionsRef.current.add(sessionId);
        setFirstFitRevision((revision) => revision + 1);
      }
      setStatus({
        state: compiled.warnings.length > 0 ? "warning" : "current",
        message: compiled.warnings[0] ?? "Current",
      });
    } catch (error) {
      if (generation !== generationRef.current) return;
      setStatus({
        state: error instanceof Error && error.message.includes("not found")
          ? "missing"
          : "warning",
        message: error instanceof Error ? error.message : "Invalid Blackboard workspace",
      });
    }
  }, [canvas, runtime]);

  useEffect(() => {
    if (!enabled || !activeSessionId || !activeWorkspaceId ||
      activeWorkspaceId === "local-reader") {
      generationRef.current += 1;
      setStatus({ state: "idle", message: "" });
      return;
    }
    void project(activeSessionId, activeWorkspaceId);
    return runtime.repository.subscribe((workspaceId) => {
      if (workspaceId === activeWorkspaceId) {
        void project(activeSessionId, activeWorkspaceId);
      }
    });
  }, [activeSessionId, activeWorkspaceId, enabled, project, runtime]);

  useEffect(() => {
    if (!enabled || !isBlackboardRoute(window.location)) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("reader") === "1") return;
    let disposed = false;
    void (async () => {
      await canvas.ready;
      const requestedId = params.get("workspace")?.trim();
      let source = requestedId
        ? await runtime.repository.readWorkspace(requestedId)
        : null;
      const available = source ? [] : await runtime.repository.listWorkspaces();
      source ??= available[0]
        ? await runtime.repository.readWorkspace(available[0].id)
        : null;
      source ??= await runtime.repository.createWorkspace(
        requestedId ? { id: requestedId } : undefined,
      );
      if (disposed) return;
      const existing = canvas.getState().canvasSessions.find(
        (session) => session.mode === "blackboard" &&
          session.workspaceId === source.workspace.id,
      );
      if (existing) await canvas.commands.sessions.switch(existing.id);
      else canvas.commands.sessions.create("blackboard", {
        blackboardWorkspaceId: source.workspace.id,
        name: source.workspace.title,
      });
      params.set("workspace", source.workspace.id);
      window.history.replaceState(null, "", `/blackboard?${params.toString()}`);
    })();
    return () => { disposed = true; };
  }, [canvas, enabled, runtime]);

  return { status, firstFitRevision };
};
