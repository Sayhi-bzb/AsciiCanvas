import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { SidebarRight } from "@/widgets/toolbar/sidebar-right";
import { useEditorStore } from "@/domains/canvas/public";
import { useLibraryStore } from "@/domains/character-library/public";
import { SidebarProvider } from "@/shared/ui/sidebar";
import {
  STRUCTURED_COMPONENT_TEMPLATES,
  STRUCTURED_PAGE_TEMPLATES,
  getActiveStructuredTemplateDragId,
  getStructuredTemplatePreview,
  setActiveStructuredTemplateDragId,
} from "@/domains/structured-content/public";
import { setUiLanguage } from "@/shared/i18n";

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
  const initialState = useEditorStore.getState();
  const initialLibraryState = useLibraryStore.getState();

  beforeEach(() => {
    setUiLanguage("en");
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
    setUiLanguage("en");
    useEditorStore.setState(initialState, true);
    useLibraryStore.setState(initialLibraryState, true);
  });

  it("shows structured templates instead of the character library in structured mode", () => {
    useEditorStore.setState({ canvasMode: "structured" });

    const { container } = render(
      <SidebarProvider>
        <SidebarRight />
      </SidebarProvider>
    );
    const content = container.querySelector('[data-slot="sidebar-content"]');
    const header = container.querySelector('[data-slot="sidebar-header"]');
    const footer = container.querySelector('[data-slot="sidebar-footer"]');
    const sidebarInner = container.querySelector('[data-slot="sidebar-inner"]');
    const group = container.querySelector('[data-slot="sidebar-group"]');
    const scrollArea = container.querySelector('[data-slot="scroll-area"]');
    const scrollViewport = container.querySelector(
      '[data-slot="scroll-area-viewport"]'
    );
    const button = screen.getByRole("button", { name: /button/i });
    const search = screen.getByRole("searchbox", {
      name: "Search structured library",
    });

    expect(header).not.toHaveTextContent("Template");
    expect(header).not.toHaveTextContent("Components");
    expect(header).not.toHaveClass("border-b");
    expect(footer).not.toHaveClass("border-t");
    expect(sidebarInner).toHaveClass(
      "group-data-[variant=floating]:border-0",
      "group-data-[variant=floating]:bg-muted",
      "group-data-[variant=floating]:shadow-none"
    );
    expect(header).toContainElement(search);
    expect(search).toHaveClass("border-0", "bg-accent/60");
    expect(content).not.toContainElement(search);
    expect(content).toHaveClass("min-h-0", "overflow-hidden");
    expect(content).not.toHaveClass("overflow-y-auto");
    expect(content?.querySelectorAll('[data-slot="scroll-area"]')).toHaveLength(1);
    expect(scrollArea).toHaveClass("min-h-0", "overflow-hidden");
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
    expect(scrollViewport).not.toContainElement(
      screen.getByRole("tab", { name: "Components" })
    );
    expect(screen.getByRole("tab", { name: "Components" })).toHaveClass(
      "bg-accent",
      "rounded-md"
    );
    expect(
      screen.queryByTestId("structured-sidebar-active-tab-line")
    ).not.toBeInTheDocument();
    expect(button).toBeInTheDocument();
    const templateItems = Array.from(
      group?.querySelectorAll('button[draggable="true"]') ?? []
    );
    const sortedTemplates = sortTemplateLabels(STRUCTURED_COMPONENT_TEMPLATES);
    expect(templateItems).toHaveLength(STRUCTURED_COMPONENT_TEMPLATES.length);
    const templateSeparators = group?.querySelectorAll(
      '[data-slot="structured-template-separator"]'
    );
    expect(templateSeparators).toHaveLength(0);
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
      expect(viewport).toHaveClass(
        "h-12",
        "w-24",
        "items-start",
        "justify-start",
        "overflow-hidden"
      );
      expect(preview?.tagName).toBe("CANVAS");
      expect(preview).toHaveStyle({
        width: `${expectedPreview.width * 5}px`,
        height: `${expectedPreview.height * 9}px`,
      });
      expect(item).toHaveTextContent(template.label);
      expect(item).toHaveClass("rounded-md");
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
    expect(screen.queryByRole("button", { name: /amibios/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /safari/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /file tree/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /timeline/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /snippet/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /terminal/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /phone/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Nerd Icons")).not.toBeInTheDocument();
  });

  it("aligns footer actions and keeps GitHub on the far right", () => {
    const { container } = render(
      <SidebarProvider>
        <SidebarRight />
      </SidebarProvider>
    );
    const actions = screen.getByTestId("sidebar-footer-actions");
    const github = screen.getByTestId("sidebar-footer-github");
    const actionButtons = actions.querySelectorAll("button");
    const githubButton = screen.getByRole("button", {
      name: "Open Source Code",
    });

    expect(actions).toHaveClass("grid-cols-7", "gap-1");
    expect(actionButtons).toHaveLength(7);
    actionButtons.forEach((button) => expect(button).toHaveClass("size-8"));
    expect(actions).toContainElement(
      screen.getByRole("button", { name: "UI language" })
    );
    expect(github).toContainElement(githubButton);
    expect(githubButton).toHaveClass("size-8");
    expect(
      actions.compareDocumentPosition(github) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(container.querySelector('[data-slot="sidebar-footer"]')).toContainElement(
      github
    );
  });

  it("opens minimap as a borderless footer popover and closes it with Escape", () => {
    useEditorStore.setState({ canvasMode: "freeform" });
    useLibraryStore.setState({ loadMainPacks: vi.fn() });
    const contextSpy = vi.spyOn(
      HTMLCanvasElement.prototype,
      "getContext"
    ).mockReturnValue({
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      setTransform: vi.fn(),
      strokeRect: vi.fn(),
      imageSmoothingEnabled: true,
    } as unknown as CanvasRenderingContext2D);
    const rafSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        callback(0);
        return 1;
      });

    render(
      <SidebarProvider>
        <SidebarRight containerSize={{ width: 1000, height: 700 }} />
      </SidebarProvider>
    );

    const trigger = screen.getByRole("button", { name: "Minimap" });
    expect(trigger).toHaveAttribute("data-state", "closed");
    fireEvent.click(trigger);

    const canvas = screen.getByLabelText("Canvas minimap");
    const content = canvas.closest('[data-slot="popover-content"]');
    expect(content).toHaveClass("border-0", "p-0", "shadow-none");
    expect(content).not.toHaveTextContent("Overview");
    expect(
      screen.queryByRole("button", { name: "Collapse overview panel" })
    ).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("data-state", "open");

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByLabelText("Canvas minimap")).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("data-state", "closed");

    contextSpy.mockRestore();
    rafSpy.mockRestore();
  });

  it("stacks footer actions with GitHub last when collapsed", () => {
    render(
      <SidebarProvider defaultOpen={false}>
        <SidebarRight />
      </SidebarProvider>
    );

    expect(screen.getByTestId("sidebar-footer-actions")).toHaveClass(
      "grid-cols-1"
    );
    expect(screen.getByTestId("sidebar-footer-github")).toHaveClass("mt-1");
  });

  it("switches icon-only character views and preserves scoped search", async () => {
    useEditorStore.setState({ canvasMode: "freeform" });
    useLibraryStore.setState({
      loadMainPacks: vi.fn(),
      packs: {
        essentials: [{ id: "ascii", label: "ASCII", entries: [] }],
        nerd: [{ id: "icons", label: "Icons", entries: [] }],
        emoji: [{ id: "faces", label: "Faces", entries: [] }],
      },
      packStatus: { essentials: "ready", nerd: "ready", emoji: "ready" },
      searchQueries: { essentials: "", nerd: "", emoji: "" },
      searchResults: { essentials: [], nerd: [], emoji: [] },
    });

    render(
      <SidebarProvider>
        <SidebarRight />
      </SidebarProvider>
    );

    const rail = screen.getByTestId("character-view-rail-vertical");
    const tabs = screen.getAllByRole("tab");
    expect(rail).toHaveClass("bg-muted", "p-[3px]");
    expect(rail.parentElement).not.toHaveClass("border-r", "border-b");
    expect(tabs.map((tab) => tab.getAttribute("aria-label"))).toEqual([
      "Essentials",
      "Nerd Icons",
      "Emoji",
      "Unicode",
    ]);
    expect(screen.getByRole("tab", { name: "Essentials" })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    fireEvent.click(screen.getByRole("tab", { name: "Nerd Icons" }));
    expect(screen.getByRole("tabpanel", { name: "Nerd Icons characters" }))
      .toBeInTheDocument();
    const search = screen.getByRole("searchbox", { name: "Search characters" });
    fireEvent.change(search, { target: { value: "folder" } });
    await waitFor(() =>
      expect(useLibraryStore.getState().searchQueries.nerd).toBe("folder")
    );

    fireEvent.click(screen.getByRole("tab", { name: "Emoji" }));
    expect(screen.getByRole("searchbox", { name: "Search characters" }))
      .toHaveValue("");
    fireEvent.click(screen.getByRole("tab", { name: "Nerd Icons" }));
    expect(screen.getByRole("searchbox", { name: "Search characters" }))
      .toHaveValue("folder");
  });

  it("keeps the character view rail when collapsed and expands selected view", () => {
    useEditorStore.setState({ canvasMode: "freeform" });
    useLibraryStore.setState({ loadMainPacks: vi.fn() });

    render(
      <SidebarProvider defaultOpen={false}>
        <SidebarRight />
      </SidebarProvider>
    );

    const header = document.querySelector(
      '[data-slot="sidebar-header"]'
    );
    const trigger = screen.getByRole("button", { name: "Toggle Sidebar" });
    expect(header).toHaveClass(
      "h-12",
      "flex-row",
      "py-2",
      "px-[9px]",
      "transition-[padding]"
    );
    expect(header).not.toHaveClass("py-4", "transition-all");
    expect(trigger).toHaveClass("ml-auto");
    expect(screen.getByTestId("character-view-rail-vertical"))
      .toBeInTheDocument();
    expect(
      screen.queryByRole("searchbox", { name: "Search characters" })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Emoji" }));

    expect(screen.getByRole("tab", { name: "Emoji" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("tabpanel", { name: "Emoji characters" }))
      .toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search characters" }))
      .toBeInTheDocument();
    expect(header).toHaveClass("h-12", "flex-row", "py-2", "px-3");
    expect(header).not.toHaveClass("py-4");
  });

  it("shows animation frames in the right sidebar without replacing its footer", () => {
    useEditorStore.setState({
      canvasMode: "animation",
      canvasBounds: { width: 80, height: 25 },
      animationTimeline: {
        frames: [{ id: "frame-1", name: "Opening", grid: [] }],
        currentFrameId: "frame-1",
        fps: 10,
        loop: true,
        onionSkin: {
          enabled: true,
          backwardLayers: 2,
          forwardLayers: 2,
          opacityFalloff: [0.5, 0.3, 0.1],
        },
      },
    });

    render(
      <SidebarProvider>
        <SidebarRight />
      </SidebarProvider>
    );

    expect(screen.getByText("Frames", { selector: "span" })).toBeInTheDocument();
    const framesTab = screen.getByRole("button", { name: "frames" });
    expect(framesTab).toHaveClass("bg-accent", "text-foreground");
    expect(framesTab.parentElement).toHaveClass("bg-muted", "p-[3px]");
    expect(screen.getByRole("button", { name: "effects" })).toBeInTheDocument();
    expect(screen.getByText("Opening")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Select Frame 1: Opening" })
    ).toHaveClass("bg-accent", "text-foreground");
    expect(
      screen.getByRole("button", { name: "Select Frame 1: Opening" })
    ).not.toHaveClass("ring-1");
    expect(
      screen.getByRole("button", { name: "Add frame after current" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-footer-actions")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-footer-actions")).toHaveClass(
      "grid-cols-6"
    );
    expect(
      screen.queryByRole("button", { name: "Minimap" })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Nerd Icons")).not.toBeInTheDocument();
  });

  it("switches structured sidebar tabs between templates and components", () => {
    useEditorStore.setState({ canvasMode: "structured" });

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
    expect(screen.getByRole("button", { name: /amibios/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /safari/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /file tree/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /timeline/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /snippet/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /terminal/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /phone/i })).toBeInTheDocument();
    expect(STRUCTURED_PAGE_TEMPLATES.map((template) => template.id)).toEqual([
      "amibios",
      "spotify",
      "safari",
      "filetree",
      "timeline",
      "snippet",
      "terminal",
      "phone",
    ]);
    expect(screen.queryByRole("button", { name: /button/i })).not.toBeInTheDocument();
    expect(screen.queryByText("No templates found")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Components" }));

    expect(screen.getByRole("tab", { name: "Components" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("button", { name: /button/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /amibios/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /safari/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /file tree/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /timeline/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /snippet/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /terminal/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /phone/i })).not.toBeInTheDocument();
  });

  it("filters structured components from the main header search", () => {
    useEditorStore.setState({ canvasMode: "structured" });

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
    useEditorStore.setState({ canvasMode: "freeform" });

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
    useEditorStore.setState({ canvasMode: "structured" });

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

  it("toggles operation UI labels to Chinese without changing template labels", () => {
    useEditorStore.setState({ canvasMode: "structured" });

    render(
      <SidebarProvider>
        <SidebarRight />
      </SidebarProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "UI language" }));

    expect(screen.getByRole("searchbox", { name: "搜索结构库" })).toHaveAttribute(
      "placeholder",
      "搜索"
    );
    expect(screen.getByRole("tab", { name: "模板" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "组件" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /button/i })).toBeInTheDocument();
    expect(window.localStorage.getItem("ascii-canvas-ui-language")).toBe("zh");
  });

  it("uses a transparent drag image for structured templates", () => {
    useEditorStore.setState({
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
