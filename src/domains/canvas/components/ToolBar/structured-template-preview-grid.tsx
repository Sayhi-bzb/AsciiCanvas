import type { StructuredTemplatePreview } from "@/domains/canvas/state/helpers/structuredTemplates";
import { cn } from "@/shared/lib/utils";

type StructuredTemplatePreviewGridProps = {
  preview: StructuredTemplatePreview;
  cellWidth: number;
  cellHeight: number;
  fontSize: number;
  className?: string;
};

export function StructuredTemplatePreviewGrid({
  preview,
  cellWidth,
  cellHeight,
  fontSize,
  className,
}: StructuredTemplatePreviewGridProps) {
  if (preview.width === 0 || preview.height === 0) return null;

  return (
    <div
      data-testid="structured-template-preview-grid"
      className={cn("grid font-mono", className)}
      style={{
        width: `${preview.width * cellWidth}px`,
        height: `${preview.height * cellHeight}px`,
        gridTemplateColumns: `repeat(${preview.width}, ${cellWidth}px)`,
        gridAutoRows: `${cellHeight}px`,
        fontSize: `${fontSize}px`,
        whiteSpace: "pre",
      }}
    >
      {preview.rows.flatMap((row, y) =>
        row.map((cell, x) => (
          <span
            key={`${x}-${y}`}
            style={{
              width: `${cellWidth}px`,
              height: `${cellHeight}px`,
              lineHeight: `${cellHeight}px`,
              color: cell.color,
              backgroundColor: cell.bgColor ?? "transparent",
              fontWeight: cell.attrs?.bold ? 700 : undefined,
              fontStyle: cell.attrs?.italic ? "italic" : undefined,
              textDecoration: cell.attrs?.underline
                ? "underline"
                : cell.attrs?.strike
                  ? "line-through"
                  : undefined,
            }}
          >
            {cell.char}
          </span>
        ))
      )}
    </div>
  );
}
