type StructuredTemplatePreviewLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
};

type ResolveStructuredTemplatePreviewLayoutOptions = {
  viewportWidth: number;
  viewportHeight: number;
  columns: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  padding?: number;
  maxScale?: number;
};

export const resolveStructuredTemplatePreviewLayout = ({
  viewportWidth,
  viewportHeight,
  columns,
  rows,
  cellWidth,
  cellHeight,
  padding = 8,
  maxScale = 2,
}: ResolveStructuredTemplatePreviewLayoutOptions): StructuredTemplatePreviewLayout | null => {
  const contentWidth = columns * cellWidth;
  const contentHeight = rows * cellHeight;
  const availableWidth = viewportWidth - padding * 2;
  const availableHeight = viewportHeight - padding * 2;
  if (
    viewportWidth <= 0 ||
    viewportHeight <= 0 ||
    contentWidth <= 0 ||
    contentHeight <= 0 ||
    availableWidth <= 0 ||
    availableHeight <= 0 ||
    maxScale <= 0
  ) {
    return null;
  }

  const scale = Math.min(
    maxScale,
    availableWidth / contentWidth,
    availableHeight / contentHeight
  );
  const width = contentWidth * scale;
  const height = contentHeight * scale;
  return {
    x: (viewportWidth - width) / 2,
    y: (viewportHeight - height) / 2,
    width,
    height,
    scale,
  };
};
