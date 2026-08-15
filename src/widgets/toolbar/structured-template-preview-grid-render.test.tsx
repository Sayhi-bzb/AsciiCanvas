import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StructuredTemplatePreview } from "@/domains/structured-content/public";

const metrics = vi.hoisted(() => ({
  drawCellBackground: vi.fn(),
  drawCellText: vi.fn(),
  prepareCanvasSurface: vi.fn(),
}));

vi.mock("@/shared/metrics", () => ({
  DEFAULT_GRID_RENDER_METRICS: {},
  ...metrics,
  loadRenderFonts: vi.fn(() => new Promise<void>(() => undefined)),
}));

import { StructuredTemplatePreviewGrid } from "./structured-template-preview-grid";

const preview = {
  width: 1,
  height: 1,
  rows: [
    [
      {
        char: "A",
        color: "#111111",
        bgColor: "#eeeeee",
      },
    ],
  ],
} as StructuredTemplatePreview;

describe("StructuredTemplatePreviewGrid rendering modes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      {} as CanvasRenderingContext2D
    );
  });

  it("renders both backgrounds and characters by default", () => {
    const { getByTestId } = render(
      <StructuredTemplatePreviewGrid
        preview={preview}
        cellWidth={8}
        cellHeight={16}
        fontSize={14}
      />
    );

    expect(metrics.drawCellBackground).toHaveBeenCalledOnce();
    expect(metrics.drawCellText).toHaveBeenCalledOnce();
    expect(getByTestId("structured-template-preview-grid")).toHaveAttribute(
      "data-preview-mode",
      "full"
    );
  });

  it("omits cell backgrounds from a characters-only projection", () => {
    const { getByTestId } = render(
      <StructuredTemplatePreviewGrid
        preview={preview}
        cellWidth={8}
        cellHeight={16}
        fontSize={14}
        mode="characters"
      />
    );

    expect(metrics.drawCellBackground).not.toHaveBeenCalled();
    expect(metrics.drawCellText).toHaveBeenCalledOnce();
    expect(getByTestId("structured-template-preview-grid")).toHaveAttribute(
      "data-preview-mode",
      "characters"
    );
  });
});
