"use client";

import type { DragEvent } from "react";
import { cn } from "@/shared/lib/utils";
import {
  SidebarGroup,
  SidebarGroupContent,
} from "@/shared/ui/sidebar";
import {
  buildStructuredTemplatePreview,
  STRUCTURED_TEMPLATE_MIME,
  STRUCTURED_TEMPLATES,
  setActiveStructuredTemplateDragId,
  type StructuredTemplateId,
} from "@/domains/canvas/state/helpers/structuredTemplates";
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

type StructuredTemplateLibraryProps = {
  query?: string;
};

export function StructuredTemplateLibrary({
  query = "",
}: StructuredTemplateLibraryProps) {
  const normalizedQuery = query.trim().toLowerCase();
  const templates = normalizedQuery
    ? STRUCTURED_TEMPLATES.filter((template) =>
        template.label.toLowerCase().includes(normalizedQuery)
      )
    : STRUCTURED_TEMPLATES;
  const sortedTemplates = sortTemplatesByLabel(templates);

  return (
    <SidebarGroup className="p-0">
      <SidebarGroupContent>
        <div className="flex flex-col">
          {sortedTemplates.length === 0 && (
            <div className="px-2 py-4 text-xs text-muted-foreground">
              No components found
            </div>
          )}
          {sortedTemplates.map((template, index) => (
            <div key={template.id}>
              {index > 0 && <div className="h-px bg-border" />}
              <button
                type="button"
                draggable
                onDragStart={handleTemplateDragStart(template)}
                onDragEnd={() => setActiveStructuredTemplateDragId(null)}
                className={cn(
                  "group flex w-full items-center gap-3 bg-transparent px-2 py-1.5 text-left transition-colors",
                  "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
                )}
              >
                <div
                  data-testid="structured-template-preview-viewport"
                  className="flex h-12 w-24 shrink-0 items-center overflow-hidden"
                >
                  <StructuredTemplatePreviewGrid
                    preview={buildStructuredTemplatePreview(template.id)}
                    cellWidth={5}
                    cellHeight={9}
                    fontSize={8}
                    className="text-foreground"
                  />
                </div>
                <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                  {template.label}
                </span>
              </button>
            </div>
          ))}
        </div>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
