import type { Point, ToolType } from "@/shared/types";
import { getCellOccupancy } from "@/shared/metrics";
import bresenham from "bresenham";
import type {
  InteractionEvent,
  InteractionState,
} from "../core/interactionMachine";

export type DrawingUpdateDecision =
  | {
      type: "scratch";
      points: Array<Point & { char: string }>;
      nextLastGrid: Point;
      nextLastPlacedGrid: Point | null;
    }
  | {
      type: "erase";
      points: Point[];
      nextLastGrid: Point;
      nextLastPlacedGrid: Point | null;
    }
  | { type: "none" };

const shouldPlaceWideChar = ({
  point,
  lastPlacedGrid,
  charWidth,
}: {
  point: Point;
  lastPlacedGrid: Point | null;
  charWidth: number;
}) => {
  if (!lastPlacedGrid) return true;
  const dx = Math.abs(point.x - lastPlacedGrid.x);
  const dy = Math.abs(point.y - lastPlacedGrid.y);
  return dx >= charWidth || dy >= 1;
};

export const resolveDrawingUpdateDecision = ({
  tool,
  brushChar,
  lastGrid,
  currentGrid,
  lastPlacedGrid,
}: {
  tool: ToolType;
  brushChar: string;
  lastGrid: Point | null;
  currentGrid: Point;
  lastPlacedGrid: Point | null;
}): DrawingUpdateDecision => {
  if (
    !lastGrid ||
    (currentGrid.x === lastGrid.x && currentGrid.y === lastGrid.y)
  ) {
    return { type: "none" };
  }

  const points = bresenham(
    lastGrid.x,
    lastGrid.y,
    currentGrid.x,
    currentGrid.y
  );

  if (tool === "brush") {
    const charWidth = getCellOccupancy(brushChar);
    if (charWidth <= 1) {
      return {
        type: "scratch",
        points: points.map((point) => ({ ...point, char: brushChar })),
        nextLastGrid: currentGrid,
        nextLastPlacedGrid: lastPlacedGrid,
      };
    }

    const filteredPoints: Point[] = [];
    let nextLastPlacedGrid = lastPlacedGrid;
    points.forEach((point) => {
      if (
        shouldPlaceWideChar({
          point,
          lastPlacedGrid: nextLastPlacedGrid,
          charWidth,
        })
      ) {
        filteredPoints.push(point);
        nextLastPlacedGrid = point;
      }
    });

    return {
      type: "scratch",
      points: filteredPoints.map((point) => ({ ...point, char: brushChar })),
      nextLastGrid: currentGrid,
      nextLastPlacedGrid,
    };
  }

  if (tool === "eraser") {
    return {
      type: "erase",
      points,
      nextLastGrid: currentGrid,
      nextLastPlacedGrid: lastPlacedGrid,
    };
  }

  return { type: "none" };
};

export type DrawingUpdateExecutor = {
  addScratchPoints: (points: Array<Point & { char: string }>) => void;
  erasePoints: (points: Point[]) => void;
  dispatchInteraction: (event: InteractionEvent) => void;
};

export const createDrawingUpdateHandler = ({
  getBrushChar,
  getInteractionState,
  executor,
}: {
  getBrushChar: () => string;
  getInteractionState: () => InteractionState;
  executor: DrawingUpdateExecutor;
}) => {
  return (currentGrid: Point) => {
    const state = getInteractionState();
    if (state.type !== "drawing") return;
    const decision = resolveDrawingUpdateDecision({
      tool: state.tool,
      brushChar: getBrushChar(),
      lastGrid: state.lastGrid,
      currentGrid,
      lastPlacedGrid: state.lastPlacedGrid,
    });
    if (decision.type === "none") return;

    if (decision.type === "scratch" && decision.points.length > 0) {
      executor.addScratchPoints(decision.points);
    } else if (decision.type === "erase") {
      executor.erasePoints(decision.points);
    }

    executor.dispatchInteraction({
      type: "updateDrawing",
      lastGrid: decision.nextLastGrid,
      lastPlacedGrid: decision.nextLastPlacedGrid,
    });
  };
};
