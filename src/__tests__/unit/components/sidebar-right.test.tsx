import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import { SidebarRight } from "@/domains/canvas/components/ToolBar/sidebar-right";
import { useCanvasStore } from "@/domains/canvas/state/canvasStore";
import { SidebarProvider } from "@/shared/ui/sidebar";
import {
  STRUCTURED_TEMPLATES,
  buildStructuredTemplatePreview,
  getActiveStructuredTemplateDragId,
  setActiveStructuredTemplateDragId,
} from "@/domains/canvas/state/helpers/structuredTemplates";

describe("SidebarRight structured templates", () => {
  const initialState = useCanvasStore.getState();

  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    setActiveStructuredTemplateDragId(null);
    useCanvasStore.setState(initialState, true);
  });

  it("shows structured templates instead of the character library in structured mode", () => {
    useCanvasStore.setState({ canvasMode: "structured" });

    const { container } = render(
      <SidebarProvider>
        <SidebarRight />
      </SidebarProvider>
    );
    const content = container.querySelector('[data-slot="sidebar-content"]');
    const header = container.querySelector('[data-slot="sidebar-header"]');
    const group = container.querySelector('[data-slot="sidebar-group"]');
    const button = screen.getByRole("button", { name: /button/i });
    const search = screen.getByRole("searchbox", {
      name: "Search structured library",
    });

    expect(header).not.toHaveTextContent("Template");
    expect(header).not.toHaveTextContent("Components");
    expect(header).toContainElement(search);
    expect(content).not.toContainElement(search);
    expect(content).toHaveTextContent("Template");
    expect(content).toHaveTextContent("Components");
    expect(screen.getByRole("tab", { name: "Template" })).toHaveAttribute(
      "aria-selected",
      "false"
    );
    expect(screen.getByRole("tab", { name: "Components" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByTestId("structured-sidebar-active-tab-line")).toBeInTheDocument();
    expect(button).toBeInTheDocument();
    const templateItems = Array.from(
      group?.querySelectorAll('button[draggable="true"]') ?? []
    );
    expect(templateItems).toHaveLength(STRUCTURED_TEMPLATES.length);
    STRUCTURED_TEMPLATES.forEach((template, index) => {
      const item = templateItems[index];
      const viewport = item.querySelector(
        '[data-testid="structured-template-preview-viewport"]'
      );
      const preview = item.querySelector(
        '[data-testid="structured-template-preview-grid"]'
      );
      const expectedPreview = buildStructuredTemplatePreview(template.id);
      expect(viewport).toHaveClass("h-12", "w-24", "items-center", "overflow-hidden");
      expect(preview?.textContent).toBe(
        expectedPreview.rows.flat().map((cell) => cell.char).join("")
      );
      expect(preview).toHaveStyle({
        width: `${expectedPreview.width * 5}px`,
        height: `${expectedPreview.height * 9}px`,
      });
      if (template.id === "card") {
        expect(expectedPreview.height * 9).toBeLessThanOrEqual(48);
      }
      expect(item).toHaveTextContent(template.label);
      expect(item.querySelector("span:last-child")).not.toHaveClass("font-semibold");
    });
    const buttonPreview = templateItems[0].querySelector(
      '[data-testid="structured-template-preview-grid"]'
    );
    expect(
      (buttonPreview?.firstElementChild as HTMLElement | null)?.style
        .backgroundColor
    ).toBe("rgb(219, 234, 254)");
    expect(content).toHaveClass("p-2");
    expect(group).toHaveClass("p-0");
    expect(button).toHaveClass("items-center", "gap-3");
    expect(screen.queryByText("Nerd Icons")).not.toBeInTheDocument();
  });

  it("switches structured sidebar tabs between templates and components", () => {
    useCanvasStore.setState({ canvasMode: "structured" });

    render(
      <SidebarProvider>
        <SidebarRight />
      </SidebarProvider>
    );

    expect(screen.getByRole("button", { name: /button/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Template" }));

    expect(screen.getByRole("tab", { name: "Template" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByText("No templates yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /button/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Components" }));

    expect(screen.getByRole("tab", { name: "Components" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("button", { name: /button/i })).toBeInTheDocument();
  });

  it("filters structured components from the main header search", () => {
    useCanvasStore.setState({ canvasMode: "structured" });

    render(
      <SidebarProvider>
        <SidebarRight />
      </SidebarProvider>
    );

    const search = screen.getByRole("searchbox", {
      name: "Search structured library",
    });

    fireEvent.change(search, { target: { value: "badge" } });

    expect(screen.getByRole("button", { name: /badge/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /button/i })).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "missing" } });

    expect(screen.getByText("No components found")).toBeInTheDocument();
  });

  it("keeps the search header outside structured mode", () => {
    useCanvasStore.setState({ canvasMode: "freeform" });

    render(
      <SidebarProvider>
        <SidebarRight />
      </SidebarProvider>
    );

    expect(screen.queryByRole("tab", { name: "Template" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Components" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("searchbox", { name: "Search structured library" })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("No templates yet")).not.toBeInTheDocument();
  });

  it("hides structured search when the sidebar is collapsed", () => {
    useCanvasStore.setState({ canvasMode: "structured" });

    const { container } = render(
      <SidebarProvider defaultOpen={false}>
        <SidebarRight />
      </SidebarProvider>
    );

    const header = container.querySelector('[data-slot="sidebar-header"]');
    expect(
      screen.queryByRole("searchbox", { name: "Search structured library" })
    ).not.toBeInTheDocument();
    expect(header?.querySelector('[data-slot="sidebar-trigger"]')).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Template" })).not.toBeInTheDocument();
  });

  it("uses a transparent drag image for structured templates", () => {
    useCanvasStore.setState({
      canvasMode: "structured",
      brushColor: "#334155",
    });

    render(
      <SidebarProvider>
        <SidebarRight />
      </SidebarProvider>
    );
    const button = screen.getByRole("button", { name: /button/i });
    const setDragImage = vi.fn();
    const dragStartEvent = createEvent.dragStart(button);
    Object.defineProperty(dragStartEvent, "dataTransfer", {
      value: {
        effectAllowed: "none",
        setData: vi.fn(),
        setDragImage,
      },
    });

    fireEvent(button, dragStartEvent);

    expect(getActiveStructuredTemplateDragId()).toBe("button");
    expect(setDragImage).toHaveBeenCalledTimes(1);
    const dragImage = setDragImage.mock.calls[0][0] as HTMLElement;
    expect(dragImage.textContent).toBe("");
    expect(dragImage.style.width).toBe("1px");
    expect(dragImage.style.height).toBe("1px");
    expect(dragImage.style.opacity).toBe("0");

    fireEvent.dragEnd(button);
    expect(getActiveStructuredTemplateDragId()).toBeNull();
  });
});
