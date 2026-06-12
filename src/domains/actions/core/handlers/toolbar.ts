import {
  actionFailed,
  actionSucceeded,
} from "../result";
import type {
  ActionContext,
  ActionHandler,
  ActionResult,
  ToolbarActionId,
} from "../types";

// Toolbar action options
type ToolbarOptions = {
  tool: Parameters<ActionContext["setTool"]>[0];
  isShapeGroupActive: boolean;
  lastUsedShape: Parameters<ActionContext["setTool"]>[0];
  onUndo: () => void;
};

// Resolve active toolbar action
export const resolveActiveToolbarAction = (
  tool: Parameters<ActionContext["setTool"]>[0],
  isShapeGroupActive: boolean
): ToolbarActionId => {
  if (isShapeGroupActive) return "shape-group";
  if (tool === "select" || tool === "brush" || tool === "eraser" || tool === "fill") {
    return tool;
  }
  return "brush";
};

// Toolbar action handlers
export const toolbarHandlers: Record<
  ToolbarActionId,
  ActionHandler<ToolbarOptions>
> = {
  select: (_options, context): ActionResult => {
    context.setTool("select");
    return actionSucceeded();
  },

  brush: (_options, context): ActionResult => {
    context.setTool("brush");
    return actionSucceeded();
  },

  "shape-group": (options, context): ActionResult => {
    const newTool = options.isShapeGroupActive
      ? options.tool
      : options.lastUsedShape;
    context.setTool(newTool);
    return actionSucceeded();
  },

  fill: (_options, context): ActionResult => {
    context.setTool("fill");
    return actionSucceeded();
  },

  eraser: (_options, context): ActionResult => {
    context.setTool("eraser");
    return actionSucceeded();
  },

  undo: (options): ActionResult => {
    options.onUndo();
    return actionSucceeded();
  },

  color: (): ActionResult => {
    return actionFailed("submenu-only");
  },
};
