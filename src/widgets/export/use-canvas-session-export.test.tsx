import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { testingCanvasRuntime } from "@/domains/canvas/testing";
import { useCanvasSessionExport } from "./use-canvas-session-export";

const { deliverExportDownload, prepareExport } = vi.hoisted(() => ({
  deliverExportDownload: vi.fn(),
  prepareExport: vi.fn(),
}));

vi.mock("@/domains/export/public", () => ({
  deliverExportDownload,
  prepareExport,
}));

describe("useCanvasSessionExport", () => {
  const materialized = {
    id: "canvas-a",
    name: "Alpha",
    mode: "freeform" as const,
    surface: {},
    structuredScene: [],
    structuredComponents: [],
    slideDeck: null,
  };

  beforeEach(() => {
    deliverExportDownload.mockReset();
    prepareExport.mockReset();
    vi.spyOn(testingCanvasRuntime, "materializeSession").mockResolvedValue(
      materialized as never
    );
  });

  it("returns a successful result without owning presentation feedback", async () => {
    prepareExport.mockReturnValue({ ok: true, value: { kind: "text" } });
    deliverExportDownload.mockResolvedValue({ ok: true, value: true });
    const { result } = renderHook(() => useCanvasSessionExport());

    await expect(result.current.save("canvas-a", "chardesk")).resolves.toEqual({ ok: true });
    expect(testingCanvasRuntime.materializeSession).toHaveBeenCalledWith("canvas-a");
    expect(prepareExport).toHaveBeenCalledWith(
      expect.objectContaining({ documentName: "Alpha", canvasMode: "freeform" }),
      "chardesk"
    );
  });

  it("preserves the oversized-image error category for the menu", async () => {
    prepareExport.mockReturnValue({
      ok: false,
      error: { code: "image-too-large" },
    });
    const { result } = renderHook(() => useCanvasSessionExport());

    await expect(result.current.save("canvas-a", "png")).resolves.toEqual({
      ok: false,
      errorCode: "image-too-large",
    });
    expect(deliverExportDownload).not.toHaveBeenCalled();
  });

  it("maps other pipeline failures to the generic save category", async () => {
    prepareExport.mockReturnValue({ ok: true, value: { kind: "text" } });
    deliverExportDownload.mockResolvedValue({
      ok: false,
      error: { code: "download-failed" },
    });
    const { result } = renderHook(() => useCanvasSessionExport());

    await expect(result.current.save("canvas-a", "chardesk")).resolves.toEqual({
      ok: false,
      errorCode: "save-failed",
    });
  });

  it("fails without attempting delivery when the session cannot be materialized", async () => {
    vi.mocked(testingCanvasRuntime.materializeSession).mockResolvedValue(null);
    const { result } = renderHook(() => useCanvasSessionExport());

    await expect(result.current.save("missing", "chardesk")).resolves.toEqual({
      ok: false,
      errorCode: "save-failed",
    });
    expect(prepareExport).not.toHaveBeenCalled();
    expect(deliverExportDownload).not.toHaveBeenCalled();
  });
});
