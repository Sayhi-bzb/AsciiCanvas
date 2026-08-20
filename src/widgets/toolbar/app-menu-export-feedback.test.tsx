import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/domains/canvas/testing";
import { setUiLanguage } from "@/shared/i18n";
import { AppMenu } from "./app-menu";

const { saveExport } = vi.hoisted(() => ({ saveExport: vi.fn() }));

vi.mock("@/widgets/export/use-app-menu-export", () => ({
  useAppMenuExport: () => ({ save: saveExport }),
}));

describe("AppMenu export feedback", () => {
  const initialState = useEditorStore.getState();

  const openPngExport = async () => {
    fireEvent.pointerDown(screen.getByRole("button", { name: "Open menu" }), {
      button: 0,
      ctrlKey: false,
    });
    const exportItem = await screen.findByRole("menuitem", { name: "Export" });
    fireEvent.pointerMove(exportItem, { pointerType: "mouse" });
    await waitFor(() => expect(exportItem).toHaveAttribute("data-state", "open"));
    return screen.findByRole("menuitem", { name: "PNG" });
  };

  beforeEach(() => {
    act(() => setUiLanguage("en"));
    saveExport.mockReset();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ stargazers_count: 0 }),
    }));
    useEditorStore.setState({
      canvasMode: "freeform",
      grid: new Map([["0,0", { char: "A", color: "#fff" }]]),
    });
  });

  afterEach(() => {
    cleanup();
    useEditorStore.setState(initialState, true);
    vi.unstubAllGlobals();
  });

  it("shows export success on the selected format item", async () => {
    saveExport.mockResolvedValue({ ok: true });
    render(<AppMenu />);
    const pngItem = await openPngExport();

    fireEvent.click(pngItem);

    await waitFor(() => {
      expect(pngItem).toHaveAttribute("data-export-feedback", "success");
      expect(pngItem).toHaveAttribute("data-feedback", "success");
      expect(pngItem).toHaveClass("text-success");
    });
    expect(pngItem.querySelector(".lucide-check")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("PNG saved");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps a detailed oversized-image error inside the export submenu", async () => {
    saveExport.mockResolvedValue({ ok: false, errorCode: "image-too-large" });
    render(<AppMenu />);
    const pngItem = await openPngExport();

    fireEvent.click(pngItem);

    await waitFor(() => {
      expect(pngItem).toHaveAttribute("data-export-feedback", "error");
      expect(pngItem).toHaveAttribute("data-feedback", "error");
      expect(pngItem).toHaveClass("text-error");
    });
    expect(pngItem.querySelector(".lucide-x")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The image is too large to export safely."
    );
  });
});
