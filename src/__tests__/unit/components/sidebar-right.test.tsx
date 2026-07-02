import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import { SidebarRight } from "@/domains/canvas/components/ToolBar/sidebar-right";
import { useCanvasStore } from "@/domains/canvas/state/canvasStore";
import { SidebarProvider } from "@/shared/ui/sidebar";
import {
  STRUCTURED_COMPONENT_TEMPLATES,
  STRUCTURED_PAGE_TEMPLATES,
  getActiveStructuredTemplateDragId,
  getStructuredTemplatePreview,
  setActiveStructuredTemplateDragId,
} from "@/domains/canvas/state/helpers/structuredTemplates";

const sortTemplateLabels = <
  T extends { id: string; label: string },
>(
  templates: T[]
) =>
  [...templates].sort(
    (a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" }) ||
      a.id.localeCompare(b.id)
  );

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
    const sortedTemplates = sortTemplateLabels(STRUCTURED_COMPONENT_TEMPLATES);
    expect(templateItems).toHaveLength(STRUCTURED_COMPONENT_TEMPLATES.length);
    const itemLabels = templateItems.map(
      (item) => item.querySelector(":scope > span:last-child")?.textContent
    );
    expect(itemLabels).toEqual(sortedTemplates.map((template) => template.label));
    sortedTemplates.forEach((template, index) => {
      const item = templateItems[index];
      const viewport = item.querySelector(
        '[data-testid="structured-template-preview-viewport"]'
      );
      const preview = item.querySelector(
        '[data-testid="structured-template-preview-grid"]'
      );
      const expectedPreview = getStructuredTemplatePreview(template.id);
      expect(viewport).toHaveClass("h-12", "w-24", "items-center", "overflow-hidden");
      expect(preview?.tagName).toBe("CANVAS");
      expect(preview).toHaveStyle({
        width: `${expectedPreview.width * 5}px`,
        height: `${expectedPreview.height * 9}px`,
      });
      expect(item).toHaveTextContent(template.label);
      expect(item.querySelector(":scope > span:last-child")).not.toHaveClass("font-semibold");
    });
    const buttonIndex = sortedTemplates.findIndex((template) => template.id === "button");
    const buttonPreview = templateItems[buttonIndex].querySelector(
      '[data-testid="structured-template-preview-grid"]'
    );
    expect(buttonPreview?.tagName).toBe("CANVAS");
    expect(content).toHaveClass("p-2");
    expect(group).toHaveClass("p-0");
    expect(button).toHaveClass("items-center", "gap-3");
    expect(screen.queryByRole("button", { name: /safari/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /file tree/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /timeline/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /snippet/i })).not.toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: /safari/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /file tree/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /timeline/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /snippet/i })).toBeInTheDocument();
    expect(STRUCTURED_PAGE_TEMPLATES.map((template) => template.id)).toEqual([
      "safari",
      "filetree",
      "timeline",
      "snippet",
    ]);
    expect(screen.queryByRole("button", { name: /button/i })).not.toBeInTheDocument();
    expect(screen.queryByText("No templates found")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Components" }));

    expect(screen.getByRole("tab", { name: "Components" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("button", { name: /button/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /safari/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /file tree/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /timeline/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /snippet/i })).not.toBeInTheDocument();
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

    fireEvent.change(search, { target: { value: "accordion" } });

    expect(
      screen.getByRole("button", { name: /accordion/i })
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /badge/i })).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "status" } });

    expect(screen.getByRole("button", { name: /status/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /accordion/i })
    ).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "calendar" } });

    expect(screen.getByRole("button", { name: /calendar/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /status/i })).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "alert" } });

    expect(screen.getByRole("button", { name: /alert/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /calendar/i })).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "switch" } });

    expect(screen.getByRole("button", { name: /switch/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /alert/i })).not.toBeInTheDocument();

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
    expect(screen.queryByText("No templates found")).not.toBeInTheDocument();
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

  it("reuses cached structured template preview data", () => {
    expect(getStructuredTemplatePreview("button")).toBe(
      getStructuredTemplatePreview("button")
    );
  });
});
