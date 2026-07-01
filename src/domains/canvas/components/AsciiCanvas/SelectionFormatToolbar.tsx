import { useMemo } from "react";
import { BoldIcon, ItalicIcon, PaletteIcon, UnderlineIcon } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { useCanvasStore } from "@/domains/canvas/state/canvasStore";
import { gridCellRect } from "@/shared/metrics";
import type { GridMap, SelectionArea } from "@/shared/types";
import { GridManager } from "@/shared/utils/grid";
import { getSelectionBounds } from "@/shared/utils/selection";
import { getStaticGridViewState } from "@/domains/canvas/state/helpers/staticGridModel";
import {
  getStructuredTextCaretPoint,
  getStructuredTextSelectionRange,
  getStructuredTextStylesInRange,
} from "@/shared/utils/structuredTextRanges";
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
    staticGridSelection,
    staticGridEditMode,
    textCursor,
    structuredTextSelection,
    structuredScene,
    brushColor,
    setSelectionTextAttributes,
    setStructuredTextAttributes,
    setStructuredTextColor,
  } = useCanvasStore(
    useShallow((state) => ({
      canvasMode: state.canvasMode,
      grid: state.grid,
      offset: state.offset,
      zoom: state.zoom,
      selections: state.selections,
      staticGridSelection: state.staticGridSelection,
      staticGridEditMode: state.staticGridEditMode,
      textCursor: state.textCursor,
      structuredTextSelection: state.structuredTextSelection,
      structuredScene: state.structuredScene,
      brushColor: state.brushColor,
      setSelectionTextAttributes: state.setSelectionTextAttributes,
      setStructuredTextAttributes: state.setStructuredTextAttributes,
      setStructuredTextColor: state.setStructuredTextColor,
    }))
  );

  const staticGridView = useMemo(
    () =>
      getStaticGridViewState({
        selection: staticGridSelection,
        editMode: staticGridEditMode,
        textCursor,
        selections,
      }),
    [staticGridEditMode, staticGridSelection, textCursor, selections]
  );
  const activeSelections =
    canvasMode === "freeform" ? staticGridView.selectionAreas : selections;

  const selectedCells = useMemo(
    () => getSelectedCells(grid, activeSelections),
    [grid, activeSelections]
  );

  const structuredTextSelectionModel = useMemo(() => {
    if (canvasMode !== "structured") return null;
    const range = getStructuredTextSelectionRange(structuredTextSelection);
    if (!range || !structuredTextSelection) return null;
    const node = structuredScene.find(
      (sceneNode) =>
        sceneNode.id === structuredTextSelection.nodeId &&
        sceneNode.type === "text"
    );
    if (!node || node.type !== "text") return null;
    const styles = getStructuredTextStylesInRange(node, range.start, range.end);
    if (styles.length === 0) return null;
    return { node, range, styles };
  }, [canvasMode, structuredScene, structuredTextSelection]);

  const textValue = useMemo(() => {
    if (canvasMode === "structured") {
      if (!structuredTextSelectionModel) return [];
      return (["bold", "italic", "underline"] as const).filter((attr) =>
        structuredTextSelectionModel.styles.every((style) => !!style.attrs?.[attr])
      );
    }

    if (selectedCells.length === 0) return [];
    return (["bold", "italic", "underline"] as const).filter((attr) =>
      selectedCells.every((cell) => !!cell.attrs?.[attr])
    );
  }, [canvasMode, selectedCells, structuredTextSelectionModel]);

  const style = useMemo(() => {
    if (!containerSize) return null;
    const bounds = canvasMode === "structured"
      ? structuredTextSelectionModel
        ? (() => {
            const startPoint = getStructuredTextCaretPoint(
              structuredTextSelectionModel.node,
              structuredTextSelectionModel.range.start
            );
            const endPoint = getStructuredTextCaretPoint(
              structuredTextSelectionModel.node,
              structuredTextSelectionModel.range.end
            );
            return getUnionBounds([{ start: startPoint, end: endPoint }]);
          })()
        : null
      : activeSelections.length > 0
          ? getUnionBounds(activeSelections)
          : null;
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
  }, [
    activeSelections,
    canvasMode,
    containerSize,
    offset,
    structuredTextSelectionModel,
    zoom,
  ]);

  const hasFormatTarget =
    canvasMode === "structured"
      ? !!structuredTextSelectionModel
      : activeSelections.length > 0 && selectedCells.length > 0;

  if (
    !hasFormatTarget ||
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
        value={textValue}
        variant="outline"
        aria-label="Selection text formatting"
        onValueChange={(nextValue) => {
          const next = new Set(nextValue);
          const attrs = {
            bold: next.has("bold"),
            italic: next.has("italic"),
            underline: next.has("underline"),
          };

          if (canvasMode === "structured") {
            setStructuredTextAttributes(attrs);
            return;
          }

          setSelectionTextAttributes(attrs);
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
        {canvasMode === "structured" && (
          <>
            <button
              type="button"
              aria-label="Apply brush color to selected text"
              title={`Apply brush color to selected text (${brushColor})`}
              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setStructuredTextColor(brushColor)}
            >
              <PaletteIcon className="size-4" style={{ color: brushColor }} />
            </button>
          </>
        )}
      </ToggleGroup>
    </div>
  );
}
