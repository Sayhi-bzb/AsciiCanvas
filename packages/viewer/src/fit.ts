type CharDeskFitMetrics = {
  mode: "width" | "contain";
  naturalWidth: number;
  naturalHeight: number;
  availableWidth: number;
  availableHeight: number;
  baseFontSize: number;
  maxFontSize: number;
  minZoom: number;
  maxZoom: number;
};

export const calculateCharDeskFitZoom = ({
  mode,
  naturalWidth,
  naturalHeight,
  availableWidth,
  availableHeight,
  baseFontSize,
  maxFontSize,
  minZoom,
  maxZoom,
}: CharDeskFitMetrics) => {
  const widthZoom = availableWidth / naturalWidth;
  const fontZoom = maxFontSize / baseFontSize;
  const heightZoom =
    mode === "contain" && naturalHeight > 0 && availableHeight > 0
      ? availableHeight / naturalHeight
      : Number.POSITIVE_INFINITY;
  const fitZoom = Math.min(widthZoom, heightZoom, fontZoom);
  return Math.max(minZoom, Math.min(maxZoom, fitZoom));
};
