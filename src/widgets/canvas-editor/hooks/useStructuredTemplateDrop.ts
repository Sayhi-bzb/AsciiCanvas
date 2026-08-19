import { useEffect, useRef, useState, type DragEvent, type RefObject } from "react";
import type { Point } from "@/shared/types";
import type { CanvasMode } from "@/domains/sessions/public";
import { GridManager } from "@/shared/utils/grid";
import { gridCellRect } from "@/shared/metrics";
import { normalizeScene } from "@/domains/structured-content/public";
import {
  buildStructuredTemplate,
  getActiveStructuredTemplateDragId,
  getStructuredTemplatePreview,
  isStructuredTemplateId,
  setActiveStructuredTemplateDragId,
  STRUCTURED_TEMPLATE_MIME,
  STRUCTURED_TEMPLATES,
  type StructuredTemplateId,
} from "@/domains/structured-content/public";
import type { CanvasEditorModel } from "./canvasModels";

type StructuredTemplatePreviewState = {
  templateId: StructuredTemplateId;
  position: Point;
};

type UseStructuredTemplateDropOptions = {
  canvasMode: CanvasMode;
  containerRef: RefObject<HTMLDivElement | null>;
  model: CanvasEditorModel;
  enabled?: boolean;
};

export const useStructuredTemplateDrop = ({
  canvasMode,
  containerRef,
  model,
  enabled = true,
}: UseStructuredTemplateDropOptions) => {
  const [preview, setPreviewState] =
    useState<StructuredTemplatePreviewState | null>(null);
  const previewRef = useRef<StructuredTemplatePreviewState | null>(null);
  const pendingPreviewRef = useRef<StructuredTemplatePreviewState | null>(null);
  const previewRafRef = useRef<number | null>(null);

  const cancelPreviewFrame = () => {
    if (previewRafRef.current === null) return;
    window.cancelAnimationFrame(previewRafRef.current);
    previewRafRef.current = null;
  };

  const commitPreview = (next: StructuredTemplatePreviewState | null) => {
    pendingPreviewRef.current = next;
    previewRef.current = next;
    setPreviewState((current) => {
      if (
        current?.templateId === next?.templateId &&
        current?.position.x === next?.position.x &&
        current?.position.y === next?.position.y
      ) {
        return current;
      }
      return next;
    });
  };

  const schedulePreview = (next: StructuredTemplatePreviewState) => {
    const pending = pendingPreviewRef.current;
    if (
      pending?.templateId === next.templateId &&
      pending.position.x === next.position.x &&
      pending.position.y === next.position.y
    ) {
      return;
    }

    pendingPreviewRef.current = next;
    if (previewRafRef.current !== null) return;
    previewRafRef.current = window.requestAnimationFrame(() => {
      previewRafRef.current = null;
      commitPreview(pendingPreviewRef.current);
    });
  };

  const clearPreview = () => {
    cancelPreviewFrame();
    commitPreview(null);
  };

  useEffect(() => () => cancelPreviewFrame(), []);

  const hasTemplateData = (dataTransfer: DataTransfer) =>
    Array.from(dataTransfer.types).includes(STRUCTURED_TEMPLATE_MIME);

  const getDragPoint = (event: DragEvent<HTMLDivElement>): Point | null => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return GridManager.screenToGrid(
      event.clientX - rect.left,
      event.clientY - rect.top,
      model.offset.x,
      model.offset.y,
      model.zoom
    );
  };

  const getTemplateId = (
    dataTransfer: DataTransfer
  ): StructuredTemplateId | null => {
    const templateId = dataTransfer.getData(STRUCTURED_TEMPLATE_MIME);
    if (isStructuredTemplateId(templateId)) return templateId;
    return hasTemplateData(dataTransfer)
      ? getActiveStructuredTemplateDragId()
      : null;
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!enabled) return;
    if (canvasMode !== "structured" || !hasTemplateData(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    const templateId = getTemplateId(event.dataTransfer);
    const position = getDragPoint(event);
    if (templateId && position) schedulePreview({ templateId, position });
  };

  const onDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!enabled) return;
    if (canvasMode !== "structured") return;
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }
    clearPreview();
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!enabled) return;
    if (canvasMode !== "structured") return;
    const templateId = getTemplateId(event.dataTransfer);
    if (!templateId) {
      clearPreview();
      setActiveStructuredTemplateDragId(null);
      return;
    }

    event.preventDefault();
    const latest = pendingPreviewRef.current ?? previewRef.current;
    const point =
      latest?.templateId === templateId ? latest.position : getDragPoint(event);
    if (!point) {
      clearPreview();
      setActiveStructuredTemplateDragId(null);
      return;
    }

    clearPreview();
    setActiveStructuredTemplateDragId(null);
    const { nodes, components } = buildStructuredTemplate(templateId, point, {
      brushColor: model.brushColor,
      startOrder: model.getNextStructuredOrder(),
    });
    if (nodes.length === 0) return;

    model.applyStructuredScene(
      [...model.structuredScene, ...nodes],
      true,
      [...model.structuredComponents, ...components]
    );
    model.setSelectedStructuredNodeIds(
      normalizeScene(nodes).map((node) => node.id)
    );
    model.setEditingStructuredTextNodeId(null);
    model.setStructuredTextSelection(null);
    model.setTextCursor(null);
    model.setStructuredGridFocus(null);
    model.clearSelections();
  };

  const definition = preview
    ? STRUCTURED_TEMPLATES.find((template) => template.id === preview.templateId)
    : null;
  const cellRect =
    preview && definition
      ? gridCellRect(preview.position, { offset: model.offset, zoom: model.zoom })
      : null;
  const grid = definition ? getStructuredTemplatePreview(definition.id) : null;

  return {
    surfaceProps: { onDragOver, onDragLeave, onDrop },
    preview: definition && cellRect && grid ? { cellRect, grid } : null,
  };
};

export type StructuredTemplateDropResult = ReturnType<typeof useStructuredTemplateDrop>;
