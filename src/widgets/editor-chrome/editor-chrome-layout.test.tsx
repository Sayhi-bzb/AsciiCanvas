import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorChromeLayout, EditorChromeProvider } from "./public";

const renderLayout = (sidebarOpen: boolean) => (
  <EditorChromeProvider>
    <EditorChromeLayout
      sidebarOpen={sidebarOpen}
      canvas={<canvas data-testid="persistent-canvas" />}
      sidebar={<aside data-testid="persistent-sidebar" />}
    />
  </EditorChromeProvider>
);

describe("EditorChromeLayout sidebar", () => {
  afterEach(() => vi.restoreAllMocks());

  it("keeps the canvas and sidebar mounted while the sidebar collapses", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      right: 1400,
      bottom: 900,
      left: 0,
      width: 1400,
      height: 900,
      toJSON: () => ({}),
    });
    const view = render(renderLayout(true));
    const canvas = view.getByTestId("persistent-canvas");
    const sidebar = view.getByTestId("persistent-sidebar");
    const viewport = view.getByTestId("editor-viewport");
    const expandedRegion = view.container.querySelector(
      '[data-editor-chrome-region="side-end"]'
    );

    expect(viewport).toHaveClass("size-full");
    expect(expandedRegion).toHaveClass("w-96", "transition-[width]");
    expect(expandedRegion).toHaveAttribute(
      "data-editor-chrome-reserved",
      "true"
    );

    view.rerender(renderLayout(false));

    const collapsedRegion = view.container.querySelector(
      '[data-editor-chrome-region="side-end"]'
    );
    expect(view.getByTestId("persistent-canvas")).toBe(canvas);
    expect(view.getByTestId("editor-viewport")).toBe(viewport);
    expect(viewport).toHaveClass("size-full");
    expect(view.getByTestId("persistent-sidebar")).toBe(sidebar);
    expect(collapsedRegion).toBe(expandedRegion);
    expect(collapsedRegion).toHaveClass("w-12", "transition-[width]");
    expect(collapsedRegion).toHaveAttribute(
      "data-editor-chrome-reserved",
      "false"
    );
  });
});
