import {
  forwardRef,
  useCallback,
  useMemo,
  type ComponentProps,
  type ComponentRef,
  type MouseEvent,
} from "react";
import { useShallow } from "zustand/react/shallow";

import { useCanvasRuntime, useCanvasState } from "@/domains/canvas/public";
import { isStaticGridMode } from "@/domains/sessions/public";
import { gridCellRect } from "@/shared/metrics";
import type { GridMap, NodeBounds, SelectionArea } from "@/shared/types";
import { GridManager } from "@/shared/utils/grid";
import { getSelectionBounds } from "@/shared/utils/selection";
import { getStructuredNodeBounds } from "@/domains/structured-content/public";
import {
  getStaticGridViewState,
} from "@/domains/selection/public";
import {
  canSplitStructuredSplitBoxLeaf,
  getStructuredSplitBoxLeafAtPoint,
  isStructuredSplitBoxLineHandle,
} from "@/domains/structured-content/public";
import {
  getStructuredTextCaretPoint,
  getStructuredTextSelectionRange,
  getStructuredTextStylesInRange,
} from "@/domains/structured-content/public";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/shared/ui/toggle-group";
import { Button, buttonVariants } from "@/shared/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import { cn } from "@/shared/lib/utils";
import { rx } from "@/shared/styles/recipes"
import { HOST_ICONOLOGY } from "@/shared/icons/iconology";

import { useUiI18n } from "@/shared/i18n";
import type { EditorViewportFrame } from "@/widgets/editor-chrome/public";

const BoldIcon = HOST_ICONOLOGY.selectionAction.bold;
const ItalicIcon = HOST_ICONOLOGY.selectionAction.italic;
const UnderlineIcon = HOST_ICONOLOGY.selectionAction.underline;
const SelectionColorIcon = HOST_ICONOLOGY.selectionAction.color;
const SplitHorizontalIcon = HOST_ICONOLOGY.selectionAction["split-horizontal"];
const SplitVerticalIcon = HOST_ICONOLOGY.selectionAction["split-vertical"];
const DeleteDividerIcon = HOST_ICONOLOGY.selectionAction["delete-divider"];

type SelectionFormatToolbarProps = {
  containerSize: { width: number; height: number } | undefined;
  viewportFrame?: EditorViewportFrame;
};

const TOOLBAR_ACTION_SIZE = 32;
const TOOLBAR_ACTION_GAP = 4;
const TOOLBAR_INLINE_PADDING = 6;
const TOOLBAR_HEIGHT = 38;
const TOOLBAR_GAP = 8;

const getToolbarWidth = (actionCount: number) =>
  actionCount * TOOLBAR_ACTION_SIZE +
  Math.max(0, actionCount - 1) * TOOLBAR_ACTION_GAP +
  TOOLBAR_INLINE_PADDING;

const selectionToolbarShellClass = cn(
  rx.toolbarShell,
  "border-0 shadow-host! backdrop-blur-none animate-in fade-in duration-[120ms] motion-reduce:animate-none"
);

const selectionToolbarToggleClass = cn(
  buttonVariants({ tone: "subtle", shape: "square", size: "md" }),
  rx.hostControl,
  "size-8 data-[state=on]:bg-accent data-[state=on]:text-foreground"
);

const preserveCanvasFocus = (event: MouseEvent<HTMLElement>) => {
  event.preventDefault();
};

const TooltipSafeToggleGroupItem = forwardRef<
  ComponentRef<typeof ToggleGroupItem>,
  ComponentProps<typeof ToggleGroupItem> & { "data-state"?: string }
>(({ "data-state": tooltipState, ...props }, ref) => (
  <ToggleGroupItem
    ref={ref}
    data-tooltip-state={tooltipState}
    {...props}
  />
));
TooltipSafeToggleGroupItem.displayName = "TooltipSafeToggleGroupItem";

type SelectionToolbarActionProps = Omit<
  ComponentProps<typeof Button>,
  "tone" | "shape" | "size"
> & {
  tooltip: string;
};

function SelectionToolbarAction({
  tooltip,
  className,
  disabled,
  onMouseDown,
  ...props
}: SelectionToolbarActionProps) {
  const button = (
    <Button
      tone="subtle"
      shape="square"
      size="md"
      disabled={disabled}
      className={cn("size-8", rx.hostControl, className)}
      onMouseDown={(event) => {
        preserveCanvasFocus(event);
        onMouseDown?.(event);
      }}
      {...props}
    />
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {disabled ? <span className="inline-flex">{button}</span> : button}
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

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
  viewportFrame,
}: SelectionFormatToolbarProps) {
  const canvas = useCanvasRuntime();
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
  } = useCanvasState(
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
    }))
  );
  const setSelectionTextAttributes = canvas.commands.selection.setTextAttributes;
  const setStructuredTextAttributes = canvas.commands.structured.setTextAttributes;
  const setStructuredTextColor = canvas.commands.structured.setTextColor;
  const setStructuredNodeCharColor = canvas.commands.structured.setNodeCharColor;
  const splitStructuredSplitBoxLeaf = canvas.commands.structured.splitLeaf;
  const deleteSelection = canvas.commands.selection.delete;

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
    isStaticGridMode(canvasMode) ? staticGridView.selectionAreas : selections;

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
      const usableRect = viewportFrame?.usableRect ?? {
        x: 0,
        y: 0,
        width: containerSize.width,
        height: containerSize.height,
      };
      const minLeft = usableRect.x + 8;
      const maxLeft = Math.max(
        minLeft,
        usableRect.x + usableRect.width - toolbarWidth - 8
      );
      const left = Math.max(
        minLeft,
        Math.min(maxLeft, selectionCenter - toolbarWidth / 2)
      );
      const topCandidate = selectionTop - TOOLBAR_HEIGHT - TOOLBAR_GAP;
      const minTop = usableRect.y + 8;
      const maxTop = Math.max(
        minTop,
        usableRect.y + usableRect.height - TOOLBAR_HEIGHT - 8
      );
      const top =
        topCandidate >= minTop
          ? topCandidate
          : Math.min(maxTop, selectionBottom + TOOLBAR_GAP);

      return {
        left,
        top: Math.max(minTop, Math.min(maxTop, top)),
      };
    },
    [containerSize, offset, viewportFrame?.usableRect, zoom]
  );

  const formatStyle = useMemo(
    () =>
      getToolbarStyle(
        formatBounds,
        getToolbarWidth(canvasMode === "structured" ? 4 : 3)
      ),
    [canvasMode, formatBounds, getToolbarStyle]
  );
  const splitStyle = useMemo(
    () => getToolbarStyle(splitBounds, getToolbarWidth(4)),
    [getToolbarStyle, splitBounds]
  );
  const shapeStyle = useMemo(
    () => getToolbarStyle(shapeBounds, getToolbarWidth(1)),
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
        className="absolute z-(--layer-contextual) pointer-events-auto"
        style={{ left: splitStyle.left, top: splitStyle.top }}
      >
        <div
          role="toolbar"
          data-selection-toolbar="true"
          className={selectionToolbarShellClass}
          aria-label={t("selection.splitControls")}
        >
          <SelectionToolbarAction
            aria-label={t("selection.splitHorizontal")}
            tooltip={t("selection.splitHorizontalTitle")}
            disabled={!splitBoxModel.canSplitHorizontal || !splitBoxModel.activePoint}
            onClick={() => {
              if (!splitBoxModel.activePoint || !splitBoxModel.canSplitHorizontal) return;
              splitStructuredSplitBoxLeaf(
                splitBoxModel.node.id,
                splitBoxModel.activePoint,
                "horizontal"
              );
            }}
          >
            <SplitHorizontalIcon className="size-4" />
          </SelectionToolbarAction>
          <SelectionToolbarAction
            aria-label={t("selection.splitVertical")}
            tooltip={t("selection.splitVerticalTitle")}
            disabled={!splitBoxModel.canSplitVertical || !splitBoxModel.activePoint}
            onClick={() => {
              if (!splitBoxModel.activePoint || !splitBoxModel.canSplitVertical) return;
              splitStructuredSplitBoxLeaf(
                splitBoxModel.node.id,
                splitBoxModel.activePoint,
                "vertical"
              );
            }}
          >
            <SplitVerticalIcon className="size-4" />
          </SelectionToolbarAction>
          <SelectionToolbarAction
            aria-label={t("selection.applyShapeColor")}
            tooltip={t("selection.applyShapeColorTitle", { color: brushColor })}
            onClick={() => setStructuredNodeCharColor(brushColor)}
          >
            <SelectionColorIcon className="size-4" style={{ color: brushColor }} />
          </SelectionToolbarAction>
          <SelectionToolbarAction
            aria-label={t("selection.deleteDivider")}
            tooltip={t("selection.deleteDividerTitle")}
            disabled={!splitBoxModel.canDeleteDivider}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => {
              if (!splitBoxModel.canDeleteDivider) return;
              deleteSelection();
            }}
          >
            <DeleteDividerIcon className="size-4" />
          </SelectionToolbarAction>
        </div>
      </div>
    );
  }

  if (shapeColorModel && shapeStyle && !hasFormatTarget) {
    return (
      <div
        data-canvas-ui="true"
        className="absolute z-(--layer-contextual) pointer-events-auto"
        style={{ left: shapeStyle.left, top: shapeStyle.top }}
      >
        <div
          role="toolbar"
          data-selection-toolbar="true"
          className={selectionToolbarShellClass}
          aria-label={t("selection.shapeColorControls")}
        >
          <SelectionToolbarAction
            aria-label={t("selection.applyShapeColor")}
            tooltip={t("selection.applyShapeColorTitle", { color: brushColor })}
            onClick={() => setStructuredNodeCharColor(brushColor)}
          >
            <SelectionColorIcon className="size-4" style={{ color: brushColor }} />
          </SelectionToolbarAction>
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
      className="absolute z-(--layer-contextual) pointer-events-auto"
      style={{ left: formatStyle.left, top: formatStyle.top }}
    >
      <ToggleGroup
        type="multiple"
        value={textValue}
        role="toolbar"
        data-selection-toolbar="true"
        className={selectionToolbarShellClass}
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
        <Tooltip>
          <TooltipTrigger asChild>
            <TooltipSafeToggleGroupItem
              aria-label={t("selection.toggleBold")}
              value="bold"
              className={selectionToolbarToggleClass}
              onMouseDown={preserveCanvasFocus}
            >
              <BoldIcon className="size-4" />
            </TooltipSafeToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {t("selection.bold")}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <TooltipSafeToggleGroupItem
              aria-label={t("selection.toggleItalic")}
              value="italic"
              className={selectionToolbarToggleClass}
              onMouseDown={preserveCanvasFocus}
            >
              <ItalicIcon className="size-4" />
            </TooltipSafeToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {t("selection.italic")}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <TooltipSafeToggleGroupItem
              aria-label={t("selection.toggleUnderline")}
              value="underline"
              className={selectionToolbarToggleClass}
              onMouseDown={preserveCanvasFocus}
            >
              <UnderlineIcon className="size-4" />
            </TooltipSafeToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {t("selection.underline")}
          </TooltipContent>
        </Tooltip>
        {canvasMode === "structured" && (
          <SelectionToolbarAction
            aria-label={t("selection.applyTextColor")}
            tooltip={t("selection.applyTextColorTitle", { color: brushColor })}
            onClick={() => setStructuredTextColor(brushColor)}
          >
            <SelectionColorIcon className="size-4" style={{ color: brushColor }} />
          </SelectionToolbarAction>
        )}
      </ToggleGroup>
    </div>
  );
}
