import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExportContext } from "@/domains/export/public";
import { useAppMenuExport } from "./use-app-menu-export";

const { deliverExportDownload, prepareExport } = vi.hoisted(() => ({
  deliverExportDownload: vi.fn(),
  prepareExport: vi.fn(),
}));

vi.mock("@/domains/export/public", () => ({
  deliverExportDownload,
  prepareExport,
}));

describe("useAppMenuExport", () => {
  const context = {} as ExportContext;

  beforeEach(() => {
    deliverExportDownload.mockReset();
    prepareExport.mockReset();
  });

  it("returns a successful result without owning presentation feedback", async () => {
    prepareExport.mockReturnValue({ ok: true, value: { kind: "text" } });
    deliverExportDownload.mockResolvedValue({ ok: true, value: true });
    const { result } = renderHook(() => useAppMenuExport(context));

    await expect(result.current.save("chardesk")).resolves.toEqual({ ok: true });
  });

  it("preserves the oversized-image error category for the menu", async () => {
    prepareExport.mockReturnValue({
      ok: false,
      error: { code: "image-too-large" },
    });
    const { result } = renderHook(() => useAppMenuExport(context));

    await expect(result.current.save("png")).resolves.toEqual({
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
    const { result } = renderHook(() => useAppMenuExport(context));

    await expect(result.current.save("chardesk")).resolves.toEqual({
      ok: false,
      errorCode: "save-failed",
    });
  });
});
