import { FONT_SIZE } from "@/shared/lib/constants";
import { StructuredTemplatePreviewGrid } from "@/domains/canvas/components/ToolBar/structured-template-preview-grid";
import type { StructuredTemplateDropResult } from "./hooks/useStructuredTemplateDrop";

type StructuredTemplatePreviewOverlayProps = {
  preview: StructuredTemplateDropResult["preview"];
  zoom: number;
};

export const StructuredTemplatePreviewOverlay = ({
  preview,
  zoom,
}: StructuredTemplatePreviewOverlayProps) => {
  if (!preview) return null;
  const { cellRect, grid } = preview;
  return (
    <div
      data-testid="structured-template-preview"
      className="pointer-events-none absolute"
      style={{
        left: `${cellRect.x}px`,
        top: `${cellRect.y}px`,
        width: `${cellRect.width * grid.width}px`,
        height: `${cellRect.height * grid.height}px`,
        zIndex: 20,
      }}
    >
      <StructuredTemplatePreviewGrid
        preview={grid}
        cellWidth={cellRect.width}
        cellHeight={cellRect.height}
        fontSize={FONT_SIZE * zoom}
      />
    </div>
  );
};
