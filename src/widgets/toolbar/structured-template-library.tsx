"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  SidebarGroup,
  SidebarGroupContent,
} from "@/shared/ui/sidebar";
import {
  getStructuredTemplatePreview,
  STRUCTURED_TEMPLATE_MIME,
  STRUCTURED_COMPONENT_TEMPLATES,
  setActiveStructuredTemplateDragId,
  type StructuredTemplateListItem,
  type StructuredTemplateId,
} from "@/domains/structured-content/public";
import { StructuredTemplatePreviewGrid } from "./structured-template-preview-grid";
import { SelectableItem } from "@/shared/ui/selectable-item";
import { Surface } from "@/shared/ui/surface";

const sortTemplatesByLabel = <
  T extends { id: StructuredTemplateId; label: string },
>(
  templates: T[]
) =>
  [...templates].sort(
    (a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" }) ||
      a.id.localeCompare(b.id)
  );

const FALLBACK_DRAG_PREVIEW_WIDTH = 160;
const FALLBACK_DRAG_PREVIEW_HEIGHT = 90;

type StructuredTemplateDragPreview = {
  templateId: StructuredTemplateId;
  width: number;
  height: number;
  hotspotX: number;
  hotspotY: number;
  clientX: number;
  clientY: number;
  overSidebar: boolean;
};

type PendingDragPreviewPosition = {
  clientX?: number;
  clientY?: number;
  overSidebar: boolean;
};

const clampDragPreviewOffset = (value: number, size: number) =>
  Math.min(Math.max(value, 0), size);

const resolveDragPreviewCoordinate = (value: number, fallback: number) =>
  Number.isFinite(value) ? value : fallback;

const handleTemplateDragStart = (
  event: ReactDragEvent<HTMLButtonElement>,
  template: { id: StructuredTemplateId },
  showDragPreview: (preview: StructuredTemplateDragPreview) => void,
  setNativeDragImage: (dataTransfer: DataTransfer) => void
) => {
  event.dataTransfer.effectAllowed = "copy";
  event.dataTransfer.setData(STRUCTURED_TEMPLATE_MIME, template.id);
  setActiveStructuredTemplateDragId(template.id);

  const previewElement =
    event.currentTarget.querySelector<HTMLElement>(
      '[data-slot="structured-template-preview"]'
    ) ?? event.currentTarget;
  const rect = previewElement.getBoundingClientRect();
  const width = rect.width > 0 ? rect.width : FALLBACK_DRAG_PREVIEW_WIDTH;
  const height = rect.height > 0 ? rect.height : FALLBACK_DRAG_PREVIEW_HEIGHT;
  const clientX = resolveDragPreviewCoordinate(
    event.clientX,
    rect.left + width / 2
  );
  const clientY = resolveDragPreviewCoordinate(
    event.clientY,
    rect.top + height / 2
  );

  showDragPreview({
    templateId: template.id,
    width,
    height,
    hotspotX: clampDragPreviewOffset(clientX - rect.left, width),
    hotspotY: clampDragPreviewOffset(clientY - rect.top, height),
    clientX,
    clientY,
    overSidebar: true,
  });
  setNativeDragImage(event.dataTransfer);
};

function StructuredTemplateDragOverlay({
  preview,
}: {
  preview: StructuredTemplateDragPreview | null;
}) {
  if (!preview || !preview.overSidebar || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      data-slot="structured-template-drag-overlay"
      data-testid="structured-template-drag-overlay"
      className="pointer-events-none fixed left-0 top-0 z-(--layer-drag-preview) overflow-hidden opacity-80 will-change-transform"
      style={{
        width: `${preview.width}px`,
        height: `${preview.height}px`,
        transform: `translate3d(${preview.clientX - preview.hotspotX}px, ${preview.clientY - preview.hotspotY}px, 0)`,
      }}
      aria-hidden="true"
    >
      <StructuredTemplatePreviewGrid
        preview={getStructuredTemplatePreview(preview.templateId)}
        cellWidth={5}
        cellHeight={9}
        fontSize={8}
        fit="contain"
        mode="characters"
        className="text-foreground"
      />
    </div>,
    document.body
  );
}

function VisibleStructuredTemplatePreview({
  templateId,
}: {
  templateId: StructuredTemplateId;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(
    () => typeof IntersectionObserver === "undefined"
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host || visible || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setVisible(true);
        observer.disconnect();
      },
      { rootMargin: "160px 0px" }
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div
      ref={hostRef}
      data-testid="structured-template-preview-lazy-host"
      className="size-full"
    >
      {visible ? (
        <StructuredTemplatePreviewGrid
          preview={getStructuredTemplatePreview(templateId)}
          cellWidth={5}
          cellHeight={9}
          fontSize={8}
          fit="contain"
          className="text-foreground"
        />
      ) : null}
    </div>
  );
}

type StructuredTemplateLibraryProps = {
  templates?: StructuredTemplateListItem[];
  query?: string;
  emptyLabel?: string;
};

export function StructuredTemplateLibrary({
  templates: sourceTemplates = STRUCTURED_COMPONENT_TEMPLATES,
  query = "",
  emptyLabel = "No components found",
}: StructuredTemplateLibraryProps) {
  const [dragPreview, setDragPreview] =
    useState<StructuredTemplateDragPreview | null>(null);
  const pendingDragPositionRef = useRef<PendingDragPreviewPosition | null>(null);
  const dragPreviewFrameRef = useRef<number | null>(null);
  const nativeDragImageRef = useRef<HTMLCanvasElement | null>(null);
  const dragging = dragPreview !== null;
  const normalizedQuery = query.trim().toLowerCase();
  const templates = normalizedQuery
    ? sourceTemplates.filter((template) =>
        template.label.toLowerCase().includes(normalizedQuery)
      )
    : sourceTemplates;
  const sortedTemplates = sortTemplatesByLabel(templates);

  const cancelDragPreviewFrame = useCallback(() => {
    if (dragPreviewFrameRef.current === null) return;
    window.cancelAnimationFrame(dragPreviewFrameRef.current);
    dragPreviewFrameRef.current = null;
  }, []);

  useLayoutEffect(() => {
    const context = nativeDragImageRef.current?.getContext("2d");
    if (!context) return;
    context.fillStyle = "rgba(0, 0, 0, 0.01)";
    context.fillRect(0, 0, 1, 1);
  }, []);

  const setNativeDragImage = useCallback((dataTransfer: DataTransfer) => {
    const dragImage = nativeDragImageRef.current;
    if (!dragImage) return;
    dataTransfer.setDragImage(dragImage, 0, 0);
  }, []);

  const clearDragPreview = useCallback(() => {
    cancelDragPreviewFrame();
    pendingDragPositionRef.current = null;
    setDragPreview(null);
  }, [cancelDragPreviewFrame]);

  const finishTemplateDrag = useCallback(() => {
    clearDragPreview();
    setActiveStructuredTemplateDragId(null);
  }, [clearDragPreview]);

  useEffect(() => {
    if (!dragging) return;

    const handleDocumentDragOver = (event: globalThis.DragEvent) => {
      const target = event.target;
      const overSidebar =
        target instanceof Element &&
        target.closest('[data-slot="sidebar"]') !== null;
      pendingDragPositionRef.current = {
        clientX: Number.isFinite(event.clientX) ? event.clientX : undefined,
        clientY: Number.isFinite(event.clientY) ? event.clientY : undefined,
        overSidebar,
      };
      setDragPreview((current) =>
        current && current.overSidebar !== overSidebar
          ? { ...current, overSidebar }
          : current
      );
      if (dragPreviewFrameRef.current !== null) return;
      dragPreviewFrameRef.current = window.requestAnimationFrame(() => {
        dragPreviewFrameRef.current = null;
        const pending = pendingDragPositionRef.current;
        if (!pending) return;
        setDragPreview((current) =>
          current
            ? {
                ...current,
                clientX: pending.clientX ?? current.clientX,
                clientY: pending.clientY ?? current.clientY,
                overSidebar: pending.overSidebar,
              }
            : null
        );
      });
    };

    const handleDocumentDrop = () => clearDragPreview();
    const handleWindowBlur = () => finishTemplateDrag();
    document.addEventListener("dragover", handleDocumentDragOver, true);
    document.addEventListener("drop", handleDocumentDrop, true);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      document.removeEventListener("dragover", handleDocumentDragOver, true);
      document.removeEventListener("drop", handleDocumentDrop, true);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [clearDragPreview, dragging, finishTemplateDrag]);

  useEffect(
    () => () => {
      cancelDragPreviewFrame();
      setActiveStructuredTemplateDragId(null);
    },
    [cancelDragPreviewFrame]
  );

  return (
    <>
      {typeof document === "undefined"
        ? null
        : createPortal(
            <canvas
              ref={nativeDragImageRef}
              data-slot="native-drag-image"
              width={1}
              height={1}
              className="pointer-events-none fixed left-0 top-0 size-px"
              aria-hidden="true"
            />,
            document.body
          )}
      <SidebarGroup className="p-0">
        <SidebarGroupContent>
          <div
            data-testid="structured-template-grid"
            className="grid grid-cols-1 gap-1 p-1"
          >
            {sortedTemplates.length === 0 && (
              <div className="col-span-full px-2 py-4 text-xs text-muted-foreground">
                {emptyLabel}
              </div>
            )}
            {sortedTemplates.map((template) => (
              <SelectableItem
                key={template.id}
                data-onboarding-template-id={template.id}
                type="button"
                orientation="vertical"
                draggable
                onDragStart={(event) =>
                  handleTemplateDragStart(
                    event,
                    template,
                    setDragPreview,
                    setNativeDragImage
                  )
                }
                onDragEnd={finishTemplateDrag}
                className="group h-auto min-w-0 items-stretch gap-1 p-1.5 text-center"
              >
                <Surface kind="transparent" asChild>
                  <div
                    data-slot="structured-template-preview"
                    data-testid="structured-template-preview-viewport"
                    className="relative aspect-video w-full overflow-hidden"
                  >
                    <VisibleStructuredTemplatePreview templateId={template.id} />
                  </div>
                </Surface>
                <span className="truncate px-1 text-xs text-foreground">
                  {template.label}
                </span>
              </SelectableItem>
            ))}
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
      <StructuredTemplateDragOverlay preview={dragPreview} />
    </>
  );
}
