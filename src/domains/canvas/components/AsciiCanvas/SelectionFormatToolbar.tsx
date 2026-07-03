import { useCallback, useMemo } from "react";
import {
  BoldIcon,
  ItalicIcon,
  PaletteIcon,
  SquareSplitHorizontal,
  SquareSplitVertical,
  Trash2,
  UnderlineIcon,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { useCanvasStore } from "@/domains/canvas/state/canvasStore";
import { gridCellRect } from "@/shared/metrics";
import type { GridMap, NodeBounds, SelectionArea } from "@/shared/types";
import { GridManager } from "@/shared/utils/grid";
import { getSelectionBounds } from "@/shared/utils/selection";
import { getStructuredNodeBounds } from "@/shared/utils/structured";
import { getStaticGridViewState } from "@/domains/canvas/state/helpers/staticGridModel";
import {
  canSplitStructuredSplitBoxLeaf,
  getStructuredSplitBoxLeafAtPoint,
  isStructuredSplitBoxLineHandle,
} from "@/domains/canvas/state/helpers/structuredBoxEditing";
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
import { useUiI18n } from "@/shared/i18n";

type SelectionFormatToolbarProps = {
  containerSize: { width: number; height: number } | undefined;
};

const FORMAT_TOOLBAR_WIDTH = 178;
const SPLIT_TOOLBAR_WIDTH = 138;
const SHAPE_COLOR_TOOLBAR_WIDTH = 42;
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

const getBoundsFromNodeBounds = (bounds: NodeBounds) => ({
  minX: bounds.x,
  minY: bounds.y,
  maxX: bounds.x + bounds.width - 1,
  maxY: bounds.y + bounds.height - 1,
});

export function SelectionFormatToolbar({
  containerSize,
}: SelectionFormatToolbarProps) {
  const { t } = useUiI18n();
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
    selectedStructuredNodeIds,
    selectedStructuredSplitHandle,
    hoveredGrid,
    structuredContextPoint,
    brushColor,
    setSelectionTextAttributes,
    setStructuredTextAttributes,
    setStructuredTextColor,
    setStructuredNodeCharColor,
    splitStructuredSplitBoxLeaf,
    deleteSelection,
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
      selectedStructuredNodeIds: state.selectedStructuredNodeIds,
      selectedStructuredSplitHandle: state.selectedStructuredSplitHandle,
      hoveredGrid: state.hoveredGrid,
      structuredContextPoint: state.structuredContextPoint,
      brushColor: state.brushColor,
      setSelectionTextAttributes: state.setSelectionTextAttributes,
      setStructuredTextAttributes: state.setStructuredTextAttributes,
      setStructuredTextColor: state.setStructuredTextColor,
      setStructuredNodeCharColor: state.setStructuredNodeCharColor,
      splitStructuredSplitBoxLeaf: state.splitStructuredSplitBoxLeaf,
      deleteSelection: state.deleteSelection,
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

  const splitBoxModel = useMemo(() => {
    if (
      canvasMode !== "structured" ||
      structuredTextSelectionModel ||
      selectedStructuredNodeIds.length !== 1
    ) {
      return null;
    }
    const selectedId = selectedStructuredNodeIds[0];
    const node = structuredScene.find(
      (sceneNode) => sceneNode.id === selectedId && sceneNode.type === "splitBox"
    );
    if (!node || node.type !== "splitBox") return null;

    const activePoint =
      [hoveredGrid, structuredContextPoint].find((point) =>
        point ? !!getStructuredSplitBoxLeafAtPoint(node, point) : false
      ) ?? null;
    const leaf = activePoint
      ? getStructuredSplitBoxLeafAtPoint(node, activePoint)
      : null;
    const dividerSelected =
      selectedStructuredSplitHandle?.nodeId === node.id &&
      isStructuredSplitBoxLineHandle(selectedStructuredSplitHandle.handle);

    return {
      node,
      activePoint,
      canSplitHorizontal:
        !dividerSelected && !!leaf && canSplitStructuredSplitBoxLeaf(leaf, "horizontal"),
      canSplitVertical:
        !dividerSelected && !!leaf && canSplitStructuredSplitBoxLeaf(leaf, "vertical"),
      canDeleteDivider: dividerSelected,
    };
  }, [
    canvasMode,
    hoveredGrid,
    selectedStructuredNodeIds,
    selectedStructuredSplitHandle,
    structuredContextPoint,
    structuredScene,
    structuredTextSelectionModel,
  ]);

  const shapeColorModel = useMemo(() => {
    if (canvasMode !== "structured" || structuredTextSelectionModel) return null;
    const selectedIds = new Set(selectedStructuredNodeIds);
    const nodes = structuredScene.filter(
      (node) =>
        selectedIds.has(node.id) &&
        (node.type === "box" || node.type === "splitBox" || node.type === "line")
    );
    if (nodes.length === 0) return null;
    const bounds = nodes
      .map((node) => getBoundsFromNodeBounds(getStructuredNodeBounds(node)))
      .reduce(
        (acc, bounds) => ({
          minX: Math.min(acc.minX, bounds.minX),
          minY: Math.min(acc.minY, bounds.minY),
          maxX: Math.max(acc.maxX, bounds.maxX),
          maxY: Math.max(acc.maxY, bounds.maxY),
        }),
        {
          minX: Number.POSITIVE_INFINITY,
          minY: Number.POSITIVE_INFINITY,
          maxX: Number.NEGATIVE_INFINITY,
          maxY: Number.NEGATIVE_INFINITY,
        }
      );
    return { nodes, bounds };
  }, [
    canvasMode,
    selectedStructuredNodeIds,
    structuredScene,
    structuredTextSelectionModel,
  ]);

  const formatBounds = useMemo(() => {
    if (canvasMode === "structured") {
      if (!structuredTextSelectionModel) return null;
      const startPoint = getStructuredTextCaretPoint(
        structuredTextSelectionModel.node,
        structuredTextSelectionModel.range.start
      );
      const endPoint = getStructuredTextCaretPoint(
        structuredTextSelectionModel.node,
        structuredTextSelectionModel.range.end
      );
      return getUnionBounds([{ start: startPoint, end: endPoint }]);
    }

    return activeSelections.length > 0 ? getUnionBounds(activeSelections) : null;
  }, [activeSelections, canvasMode, structuredTextSelectionModel]);

  const splitBounds = useMemo(() => {
    if (!splitBoxModel) return null;
    return getBoundsFromNodeBounds(getStructuredNodeBounds(splitBoxModel.node));
  }, [splitBoxModel]);
  const shapeBounds = shapeColorModel?.bounds ?? null;

  const getToolbarStyle = useCallback(
    (bounds: ReturnType<typeof getUnionBounds>, toolbarWidth: number) => {
      if (!containerSize) return null;
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
        Math.min(containerSize.width - toolbarWidth - 8, selectionCenter - toolbarWidth / 2)
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
    },
    [containerSize, offset, zoom]
  );

  const formatStyle = useMemo(
    () => getToolbarStyle(formatBounds, FORMAT_TOOLBAR_WIDTH),
    [formatBounds, getToolbarStyle]
  );
  const splitStyle = useMemo(
    () => getToolbarStyle(splitBounds, SPLIT_TOOLBAR_WIDTH),
    [getToolbarStyle, splitBounds]
  );
  const shapeStyle = useMemo(
    () => getToolbarStyle(shapeBounds, SHAPE_COLOR_TOOLBAR_WIDTH),
    [getToolbarStyle, shapeBounds]
  );

  const hasFormatTarget =
    canvasMode === "structured"
      ? !!structuredTextSelectionModel
      : activeSelections.length > 0 && selectedCells.length > 0;

  if (splitBoxModel && splitStyle && !hasFormatTarget) {
    return (
      <div
        data-canvas-ui="true"
        className="absolute z-40 pointer-events-auto"
        style={{ left: splitStyle.left, top: splitStyle.top }}
      >
        <div
          className="inline-flex h-10 items-center gap-1 rounded-md border bg-background p-1 shadow-sm"
          aria-label={t("selection.splitControls")}
        >
          <button
            type="button"
            aria-label={t("selection.splitHorizontal")}
            title={t("selection.splitHorizontalTitle")}
            disabled={!splitBoxModel.canSplitHorizontal || !splitBoxModel.activePoint}
            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-ring"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              if (!splitBoxModel.activePoint || !splitBoxModel.canSplitHorizontal) return;
              splitStructuredSplitBoxLeaf(
                splitBoxModel.node.id,
                splitBoxModel.activePoint,
                "horizontal"
              );
            }}
          >
            <SquareSplitVertical className="size-4" />
          </button>
          <ToggleGroupSeparator />
          <button
            type="button"
            aria-label={t("selection.splitVertical")}
            title={t("selection.splitVerticalTitle")}
            disabled={!splitBoxModel.canSplitVertical || !splitBoxModel.activePoint}
            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-ring"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              if (!splitBoxModel.activePoint || !splitBoxModel.canSplitVertical) return;
              splitStructuredSplitBoxLeaf(
                splitBoxModel.node.id,
                splitBoxModel.activePoint,
                "vertical"
              );
            }}
          >
            <SquareSplitHorizontal className="size-4" />
          </button>
          <ToggleGroupSeparator />
          <button
            type="button"
            aria-label={t("selection.applyShapeColor")}
            title={t("selection.applyShapeColorTitle", { color: brushColor })}
            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setStructuredNodeCharColor(brushColor)}
          >
            <PaletteIcon className="size-4" style={{ color: brushColor }} />
          </button>
          <ToggleGroupSeparator />
          <button
            type="button"
            aria-label={t("selection.deleteDivider")}
            title={t("selection.deleteDividerTitle")}
            disabled={!splitBoxModel.canDeleteDivider}
            className="inline-flex size-8 items-center justify-center rounded-md text-destructive transition-colors outline-none hover:bg-destructive/10 disabled:pointer-events-none disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-ring"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              if (!splitBoxModel.canDeleteDivider) return;
              deleteSelection();
            }}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  if (shapeColorModel && shapeStyle && !hasFormatTarget) {
    return (
      <div
        data-canvas-ui="true"
        className="absolute z-40 pointer-events-auto"
        style={{ left: shapeStyle.left, top: shapeStyle.top }}
      >
        <div
          className="inline-flex h-10 items-center gap-1 rounded-md border bg-background p-1 shadow-sm"
          aria-label={t("selection.shapeColorControls")}
        >
          <button
            type="button"
            aria-label={t("selection.applyShapeColor")}
            title={t("selection.applyShapeColorTitle", { color: brushColor })}
            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setStructuredNodeCharColor(brushColor)}
          >
            <PaletteIcon className="size-4" style={{ color: brushColor }} />
          </button>
        </div>
      </div>
    );
  }

  if (!hasFormatTarget || !formatStyle) {
    return null;
  }

  return (
    <div
      data-canvas-ui="true"
      className="absolute z-40 pointer-events-auto"
      style={{ left: formatStyle.left, top: formatStyle.top }}
    >
      <ToggleGroup
        type="multiple"
        value={textValue}
        variant="outline"
        aria-label={t("selection.textFormatting")}
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
        <ToggleGroupItem
          aria-label={t("selection.toggleBold")}
          title={t("selection.bold")}
          value="bold"
        >
          <BoldIcon className="size-4" />
        </ToggleGroupItem>
        <ToggleGroupSeparator />
        <ToggleGroupItem
          aria-label={t("selection.toggleItalic")}
          title={t("selection.italic")}
          value="italic"
        >
          <ItalicIcon className="size-4" />
        </ToggleGroupItem>
        <ToggleGroupSeparator />
        <ToggleGroupItem
          aria-label={t("selection.toggleUnderline")}
          title={t("selection.underline")}
          value="underline"
        >
          <UnderlineIcon className="size-4" />
        </ToggleGroupItem>
        <ToggleGroupSeparator />
        {canvasMode === "structured" && (
          <>
            <button
              type="button"
              aria-label={t("selection.applyTextColor")}
              title={t("selection.applyTextColorTitle", { color: brushColor })}
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
