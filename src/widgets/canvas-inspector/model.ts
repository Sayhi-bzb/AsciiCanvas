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
  | { visible: false }
  | {
      visible: true;
      mode: "freeform";
      activeColor: string;
      canvasPickDestination: "foreground" | "background";
      hasSelection: boolean;
    }
  | {
      visible: true;
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
  hasFreeformSelection,
  structuredScene,
  selectedStructuredNodeIds,
  structuredTextSelection,
}: {
  canvasMode: CanvasMode;
  tool: ToolType;
  brushColor: string;
  brushBackgroundColor: string;
  hasFreeformSelection: boolean;
  structuredScene: StructuredNode[];
  selectedStructuredNodeIds: string[];
  structuredTextSelection: StructuredTextSelection | null;
}): CanvasInspectorModel => {
  if (canvasMode === "slide") return { visible: false };

  if (canvasMode === "freeform") {
    const isBackgroundTool = tool === "bg";
    return {
      visible: true,
      mode: "freeform",
      activeColor: isBackgroundTool ? brushBackgroundColor : brushColor,
      canvasPickDestination: isBackgroundTool ? "background" : "foreground",
      hasSelection: hasFreeformSelection,
    };
  }

  const structured = deriveStructuredInspectorModel({
    brushColor,
    scene: structuredScene,
    selectedIds: selectedStructuredNodeIds,
    textSelection: structuredTextSelection,
  });
  return {
    visible: true,
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
