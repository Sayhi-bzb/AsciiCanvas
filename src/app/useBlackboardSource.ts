import { useEffect, useRef, useState } from "react";
import { useCanvasRuntime } from "@/domains/canvas/public";
import { parseDocumentSessionSource } from "@/domains/document/public";

type BlackboardSourceStatus =
  | { state: "idle" | "current" | "waiting"; message: string }
  | { state: "warning" | "missing" | "disconnected"; message: string };

export const useBlackboardSource = ({ enabled }: { enabled: boolean }) => {
  const canvas = useCanvasRuntime();
  const [status, setStatus] = useState<BlackboardSourceStatus>({
    state: enabled ? "waiting" : "idle",
    message: enabled ? "Waiting for the board" : "",
  });
  const [firstFitRevision, setFirstFitRevision] = useState(0);
  const etagRef = useRef<string | null>(null);
  const hasValidRevisionRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let timer: number | null = null;
    let controller: AbortController | null = null;

    const schedule = () => {
      if (!disposed) timer = window.setTimeout(poll, 500);
    };
    const poll = async () => {
      controller = new AbortController();
      try {
        const response = await fetch("/board", {
          headers: etagRef.current ? { "If-None-Match": etagRef.current } : {},
          signal: controller.signal,
          cache: "no-store",
        });
        if (response.status === 304) {
          setStatus({ state: "current", message: "Current" });
          return;
        }
        if (response.status === 404) {
          setStatus(hasValidRevisionRef.current
            ? { state: "missing", message: "Source missing; showing the last board" }
            : { state: "waiting", message: "Waiting for the board" });
          return;
        }
        if (!response.ok) {
          setStatus({
            state: "disconnected",
            message: `Reader unavailable (${response.status}); showing the last board`,
          });
          return;
        }

        const source = await response.text();
        const sourceName = response.headers.get("X-CharDesk-Source-Name") ?? "board.chardesk";
        const snapshot = await parseDocumentSessionSource(source, { sourceName });
        if (snapshot.mode !== "freeform") {
          throw new Error(`Blackboard requires a freeform snapshot, received ${snapshot.mode}`);
        }
        const preserveViewport = hasValidRevisionRef.current;
        canvas.commands.sessions.replaceSnapshot(
          "blackboard-source",
          snapshot,
          { preserveViewport, resetHistory: true }
        );
        if (!hasValidRevisionRef.current) {
          canvas.commands.sessions.rename(
            "blackboard-source",
            sourceName.replace(/\.chardesk$/i, "") || "Blackboard"
          );
          hasValidRevisionRef.current = true;
          setFirstFitRevision((revision) => revision + 1);
        }
        etagRef.current = response.headers.get("ETag");
        setStatus({ state: "current", message: "Current" });
      } catch (error) {
        if (disposed || controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : "Invalid Blackboard source";
        setStatus(
          error instanceof TypeError
            ? { state: "disconnected", message: "Reader disconnected; showing the last board" }
            : { state: "warning", message }
        );
      } finally {
        schedule();
      }
    };

    void poll();
    return () => {
      disposed = true;
      if (timer !== null) window.clearTimeout(timer);
      controller?.abort();
    };
  }, [canvas, enabled]);

  return { status, firstFitRevision };
};
