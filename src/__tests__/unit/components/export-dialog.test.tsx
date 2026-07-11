import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { ExportDialog } from "@/domains/export/components/export-dialog";
import { setUiLanguage } from "@/shared/i18n";
import type { CanvasMode } from "@/shared/types";

const defaultProps = {
  grid: new Map(),
  canvasMode: "freeform" as CanvasMode,
  structuredScene: [],
  structuredComponents: [],
  canvasBounds: null,
  animationTimeline: null,
  exportShowGrid: false,
  setExportShowGrid: vi.fn(),
};

describe("ExportDialog layout", () => {
  beforeEach(() => {
    setUiLanguage("en");
  });

  afterEach(() => {
    setUiLanguage("en");
    vi.clearAllMocks();
  });

  const openDialog = (props = defaultProps) => {
    render(<ExportDialog {...props} />);
    fireEvent.click(
      screen.getByRole("button", { name: /^Export (Blueprint|Animation)$/ })
    );
  };

  it("uses a snippet-style format toolbar with shared actions", () => {
    openDialog();

    const tablist = screen.getByRole("tablist", { name: "Export" });
    const actions = screen.getByTestId("export-actions");
    const tabs = within(tablist).getAllByRole("tab");

    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "TXT",
      "JSON",
      "ANSI",
      "PNG",
    ]);
    expect(tablist.parentElement).toContainElement(actions);
    expect(within(actions).getByRole("button", { name: "Copy" })).toHaveClass(
      "size-8"
    );
    expect(within(actions).getByRole("button", { name: "Save" })).toHaveClass(
      "size-8"
    );
    expect(screen.queryByText("plain")).not.toBeInTheDocument();
    expect(screen.queryByText("protocol")).not.toBeInTheDocument();
    expect(screen.queryByText(/lines .* chars/i)).not.toBeInTheDocument();
  });

  it("switches formats with tabs and shows only relevant options", () => {
    openDialog();

    const txtTab = screen.getByRole("tab", { name: "TXT" });
    const jsonTab = screen.getByRole("tab", { name: "JSON" });
    const ansiTab = screen.getByRole("tab", { name: "ANSI" });
    const pngTab = screen.getByRole("tab", { name: "PNG" });

    expect(txtTab).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByTestId("export-options")).not.toBeInTheDocument();

    fireEvent.keyDown(txtTab, { key: "ArrowRight" });
    expect(jsonTab).toHaveAttribute("aria-selected", "true");
    expect(jsonTab).toHaveFocus();

    fireEvent.click(ansiTab);
    expect(screen.getByRole("switch", { name: "Color" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.queryByRole("switch", { name: "Grid" })).not.toBeInTheDocument();

    fireEvent.click(pngTab);
    const gridSwitch = screen.getByRole("switch", { name: "Grid" });
    fireEvent.click(gridSwitch);

    expect(defaultProps.setExportShowGrid).toHaveBeenCalledWith(true);
  });

  it("hides Copy for save-only formats while keeping Save available", () => {
    openDialog({
      ...defaultProps,
      canvasMode: "animation",
    });

    fireEvent.click(screen.getByRole("tab", { name: "GIF" }));

    const actions = screen.getByTestId("export-actions");
    expect(
      within(actions).queryByRole("button", { name: "Copy" })
    ).not.toBeInTheDocument();
    expect(
      within(actions).getByRole("button", { name: "Save" })
    ).toBeInTheDocument();
  });
});
