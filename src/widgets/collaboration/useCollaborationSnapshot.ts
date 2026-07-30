import { useSyncExternalStore } from "react";
import { collaborationRuntime } from "@/domains/collaboration/public";

export const useCollaborationSnapshot = () =>
  useSyncExternalStore(
    collaborationRuntime.subscribe,
    collaborationRuntime.getSnapshot,
    collaborationRuntime.getSnapshot
  );
