import { isFromMinimap } from "./hitTesting";

export const shouldIgnoreMinimapGesture = ({
  event,
  interactionMode,
  hasDragStartGrid,
  isPanning,
}: {
  event: Event | undefined;
  interactionMode: "idle" | string;
  hasDragStartGrid: boolean;
  isPanning: boolean;
}) => {
  if (!isFromMinimap(event)) return false;
  return interactionMode === "idle" && !hasDragStartGrid && !isPanning;
};
