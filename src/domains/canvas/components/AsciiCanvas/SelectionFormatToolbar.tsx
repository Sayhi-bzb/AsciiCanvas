import { useMemo } from "react";
import { BoldIcon, ItalicIcon, PaintBucket, UnderlineIcon } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { useCanvasStore } from "@/domains/canvas/state/canvasStore";
import { gridCellRect } from "@/shared/metrics";
import type { GridMap, SelectionArea } from "@/shared/types";
import { GridManager } from "@/shared/utils/grid";
import { getSelectionBounds } from "@/shared/utils/selection";
import {
  ToggleGroup,
  ToggleGroupItem,
  ToggleGroupSeparator,
} from "@/shared/ui/toggle-group";

type SelectionFormatToolbarProps = {
  containerSize: { width: number; height: number } | undefined;
};

const TOOLBAR_WIDTH = 178;
const TOOLBAR_HEIGHT = 42;
const TOOLBAR_GAP = 8;

const getUnionBounds = (selections: SelectionArea[]) => {
  if (selections.length === 0) return null;
  return selections.reduce(
    (acc, selection) => {
      const bounds = getSelectionBounds(selection);
      return {
        minX: Math.min(acc.minX, bounds.minX),
        maxX: Math.max(acc.maxX, bounds.maxX),
        minY: Math.min(acc.minY, bounds.minY),
        maxY: Math.max(acc.maxY, bounds.maxY),
      };
    },
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    }
  );
};

const getSelectedCells = (grid: GridMap, selections: SelectionArea[]) => {
  const cells = [];
  for (const selection of selections) {
    const { minX, maxX, minY, maxY } = getSelectionBounds(selection);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const cell = grid.get(GridManager.toKey(x, y));
        if (cell) cells.push(cell);
      }
    }
  }
  return cells;
};

export function SelectionFormatToolbar({
  containerSize,
}: SelectionFormatToolbarProps) {
  const {
    canvasMode,
    grid,
    offset,
    zoom,
    selections,
    brushColor,
    setSelectionTextAttributes,
    setSelectionBackgroundColor,
  } = useCanvasStore(
    useShallow((state) => ({
      canvasMode: state.canvasMode,
      grid: state.grid,
      offset: state.offset,
      zoom: state.zoom,
      selections: state.selections,
      brushColor: state.brushColor,
      setSelectionTextAttributes: state.setSelectionTextAttributes,
      setSelectionBackgroundColor: state.setSelectionBackgroundColor,
    }))
  );

  const selectedCells = useMemo(
    () => getSelectedCells(grid, selections),
    [grid, selections]
  );

  const textValue = useMemo(() => {
    if (selectedCells.length === 0) return [];
    return (["bold", "italic", "underline"] as const).filter((attr) =>
      selectedCells.every((cell) => !!cell.attrs?.[attr])
    );
  }, [selectedCells]);

  const hasCurrentBackground = useMemo(() => {
    if (selectedCells.length === 0) return false;
    return selectedCells.every((cell) => cell.bgColor === brushColor);
  }, [brushColor, selectedCells]);

  const toolbarValue = useMemo(
    () => (hasCurrentBackground ? [...textValue, "background"] : textValue),
    [hasCurrentBackground, textValue]
  );

  const style = useMemo(() => {
    if (!containerSize || selections.length === 0) return null;
    const bounds = getUnionBounds(selections);
    if (!bounds) return null;

    const startRect = gridCellRect({ x: bounds.minX, y: bounds.minY }, { offset, zoom });
    const endRect = gridCellRect({ x: bounds.maxX, y: bounds.maxY }, { offset, zoom });
    const selectionLeft = startRect.x;
    const selectionTop = startRect.y;
    const selectionRight = endRect.x + endRect.width;
    const selectionBottom = endRect.y + endRect.height;
    const selectionCenter = (selectionLeft + selectionRight) / 2;
    const left = Math.max(
      8,
      Math.min(containerSize.width - TOOLBAR_WIDTH - 8, selectionCenter - TOOLBAR_WIDTH / 2)
    );
    const topCandidate = selectionTop - TOOLBAR_HEIGHT - TOOLBAR_GAP;
    const top =
      topCandidate >= 8
        ? topCandidate
        : Math.min(containerSize.height - TOOLBAR_HEIGHT - 8, selectionBottom + TOOLBAR_GAP);

    return {
      left,
      top: Math.max(8, top),
    };
  }, [containerSize, offset, selections, zoom]);

  if (
    canvasMode === "structured" ||
    selections.length === 0 ||
    selectedCells.length === 0 ||
    !style
  ) {
    return null;
  }

  return (
    <div
      data-canvas-ui="true"
      className="absolute z-40 pointer-events-auto"
      style={{ left: style.left, top: style.top }}
    >
      <ToggleGroup
        type="multiple"
        value={toolbarValue}
        variant="outline"
        aria-label="Selection text formatting"
        onValueChange={(nextValue) => {
          const next = new Set(nextValue);
          setSelectionTextAttributes({
            bold: next.has("bold"),
            italic: next.has("italic"),
            underline: next.has("underline"),
          });
          setSelectionBackgroundColor(
            next.has("background") ? brushColor : null
          );
        }}
      >
        <ToggleGroupItem aria-label="Toggle bold" title="Bold" value="bold">
          <BoldIcon className="size-4" />
        </ToggleGroupItem>
        <ToggleGroupSeparator />
        <ToggleGroupItem aria-label="Toggle italic" title="Italic" value="italic">
          <ItalicIcon className="size-4" />
        </ToggleGroupItem>
        <ToggleGroupSeparator />
        <ToggleGroupItem
          aria-label="Toggle underline"
          title="Underline"
          value="underline"
        >
          <UnderlineIcon className="size-4" />
        </ToggleGroupItem>
        <ToggleGroupSeparator />
        <ToggleGroupItem
          aria-label="Toggle background fill"
          title="Background fill"
          value="background"
        >
          <PaintBucket className="size-4" style={{ color: brushColor }} />
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
