"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { cn } from "@/shared/lib/utils";
import { rx } from "@/shared/styles/recipes";
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

const handleTemplateDragStart =
  (template: { id: StructuredTemplateId }) =>
  (event: DragEvent<HTMLButtonElement>) => {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(STRUCTURED_TEMPLATE_MIME, template.id);
    setActiveStructuredTemplateDragId(template.id);

    const dragImage = document.createElement("div");
    dragImage.style.position = "fixed";
    dragImage.style.left = "-1000px";
    dragImage.style.top = "-1000px";
    dragImage.style.pointerEvents = "none";
    dragImage.style.width = "1px";
    dragImage.style.height = "1px";
    dragImage.style.opacity = "0";
    document.body.appendChild(dragImage);
    event.dataTransfer.setDragImage(dragImage, 0, 0);

    const cleanup = () => dragImage.remove();
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(cleanup);
    } else {
      window.setTimeout(cleanup, 0);
    }
  };

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
  const normalizedQuery = query.trim().toLowerCase();
  const templates = normalizedQuery
    ? sourceTemplates.filter((template) =>
        template.label.toLowerCase().includes(normalizedQuery)
      )
    : sourceTemplates;
  const sortedTemplates = sortTemplatesByLabel(templates);

  return (
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
            <button
              key={template.id}
              data-onboarding-template-id={template.id}
              type="button"
              draggable
              onDragStart={handleTemplateDragStart(template)}
              onDragEnd={() => setActiveStructuredTemplateDragId(null)}
              className={cn(
                rx.hostControl,
                "group flex min-w-0 flex-col items-stretch gap-1 rounded-lg p-1.5 text-center"
              )}
            >
              <div
                data-testid="structured-template-preview-viewport"
                className={cn(
                  rx.thumbnailSurface,
                  "relative aspect-video w-full overflow-hidden"
                )}
              >
                <VisibleStructuredTemplatePreview templateId={template.id} />
              </div>
              <span className="truncate px-1 text-xs text-foreground">
                {template.label}
              </span>
            </button>
          ))}
        </div>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
