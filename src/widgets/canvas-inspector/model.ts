import type { ToolType } from "@/domains/canvas/public";
import type { CanvasMode } from "@/domains/sessions/public";
import type {
  StructuredNode,
  StructuredTextSelection,
} from "@/domains/structured-content/public";
import { deriveStructuredInspectorModel } from "./structured-model";

type StructuredInspectorModel = ReturnType<
  typeof deriveStructuredInspectorModel
>;

type CanvasInspectorModel =
  | {
      mode: "grid";
      activeColor: string;
      canvasPickDestination: "foreground" | "background";
      hasSelection: boolean;
    }
  | {
      mode: "structured";
      activeColor: string;
      canvasPickDestination: "foreground";
      structured: StructuredInspectorModel;
    };

export const deriveCanvasInspectorModel = ({
  canvasMode,
  tool,
  brushColor,
  brushBackgroundColor,
  hasGridSelection,
  structuredScene,
  selectedStructuredNodeIds,
  structuredTextSelection,
}: {
  canvasMode: CanvasMode;
  tool: ToolType;
  brushColor: string;
  brushBackgroundColor: string;
  hasGridSelection: boolean;
  structuredScene: StructuredNode[];
  selectedStructuredNodeIds: string[];
  structuredTextSelection: StructuredTextSelection | null;
}): CanvasInspectorModel => {
  if (canvasMode !== "structured") {
    const isBackgroundTool = tool === "bg";
    return {
      mode: "grid",
      activeColor: isBackgroundTool ? brushBackgroundColor : brushColor,
      canvasPickDestination: isBackgroundTool ? "background" : "foreground",
      hasSelection: hasGridSelection,
    };
  }

  const structured = deriveStructuredInspectorModel({
    brushColor,
    scene: structuredScene,
    selectedIds: selectedStructuredNodeIds,
    textSelection: structuredTextSelection,
  });
  return {
    mode: "structured",
    activeColor:
      structured.primaryColor.kind === "value" &&
      structured.primaryColor.value
        ? structured.primaryColor.value
        : brushColor,
    canvasPickDestination: "foreground",
    structured,
  };
};
