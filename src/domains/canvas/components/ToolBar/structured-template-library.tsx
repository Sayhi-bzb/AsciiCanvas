"use client";

import type { DragEvent } from "react";
import { cn } from "@/shared/lib/utils";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@/shared/ui/sidebar";
import {
  STRUCTURED_TEMPLATE_MIME,
  STRUCTURED_TEMPLATE_FALLBACK_COLORS,
  STRUCTURED_TEMPLATE_TEXT_COLOR,
  STRUCTURED_TEMPLATES,
  type StructuredTemplateId,
} from "@/domains/canvas/state/helpers/structuredTemplates";

const handleTemplateDragStart =
  (template: { id: StructuredTemplateId }) =>
  (event: DragEvent<HTMLButtonElement>) => {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(STRUCTURED_TEMPLATE_MIME, template.id);

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

export function StructuredTemplateLibrary() {
  return (
    <SidebarGroup className="p-0">
      <SidebarGroupLabel className="px-0">Templates</SidebarGroupLabel>
      <SidebarGroupContent>
        <div className="flex flex-col">
          {STRUCTURED_TEMPLATES.map((template, index) => (
            <div key={template.id}>
              {index > 0 && <div className="h-px bg-border" />}
              <button
                type="button"
                draggable
                onDragStart={handleTemplateDragStart(template)}
                className={cn(
                  "group flex w-full items-center gap-3 bg-transparent px-2 py-1.5 text-left transition-colors",
                  "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
                )}
              >
                <span
                  className="shrink-0 whitespace-pre px-1 font-mono text-[11px] leading-4"
                  style={{
                    color: STRUCTURED_TEMPLATE_TEXT_COLOR,
                    backgroundColor: STRUCTURED_TEMPLATE_FALLBACK_COLORS[0],
                  }}
                >
                  {template.dragPreview}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
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
