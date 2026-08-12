import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { SidebarRight } from "@/widgets/toolbar/sidebar-right";
import { useEditorStore } from "@/domains/canvas/testing";
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

const sortTemplateLabels = <T extends { id: string; label: string }>(
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
    expect(footer).toBeNull();
    expect(sidebarInner).toHaveClass(
      "border-0",
      "bg-host-surface",
      "shadow-host"
    );
    expect(header).toContainElement(search);
    expect(search).toHaveClass("border-0", "bg-search-surface");
    expect(content).not.toContainElement(search);
    expect(content).toHaveClass("min-h-0", "overflow-hidden");
    expect(content).not.toHaveClass("overflow-y-auto");
    expect(content).toHaveClass("[scrollbar-gutter:auto]");
    expect(content).not.toHaveClass("[scrollbar-gutter:stable]");
    expect(content?.querySelectorAll('[data-slot="scroll-area"]')).toHaveLength(
      1
    );
    expect(scrollArea).toHaveClass("min-h-0", "overflow-hidden");
    expect(content).toHaveClass("p-0");
    expect(content).toHaveClass("pb-12");
    const structuredRail = screen.getByTestId("structured-view-rail-vertical");
    const structuredRailSlot = structuredRail.parentElement;
    const toggleColumn = screen.getByTestId("sidebar-toggle-column");
    const headerContent = screen.getByTestId("sidebar-header-content");
    expect(structuredRail).toHaveAttribute("aria-orientation", "vertical");
    expect(structuredRail).toHaveClass(
      "bg-host-surface",
      "rounded-lg",
      "border-0",
      "shadow-none"
    );
    expect(header).toHaveClass("grid-cols-[minmax(0,1fr)_3rem]", "px-0");
    expect(headerContent).toHaveClass("overflow-hidden", "py-px");
    expect(structuredRailSlot?.parentElement).toHaveClass(
      "grid-cols-[minmax(0,1fr)_3rem]"
    );
    expect(structuredRailSlot).toHaveClass(
      "col-start-2",
      "row-start-1",
      "px-[3px]"
    );
    expect(toggleColumn).toHaveClass("col-start-2", "row-start-1");
    expect(scrollArea).toHaveClass("col-start-1", "row-start-1");
    expect(screen.getByRole("tab", { name: "Template" })).toHaveAttribute(
      "aria-selected",
      "false"
    );
    expect(screen.getByRole("tab", { name: "Components" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(
      screen.getByRole("tabpanel", { name: "Components" })
    ).toBeInTheDocument();
    expect(scrollViewport).not.toContainElement(
      screen.getByRole("tab", { name: "Components" })
    );
    expect(screen.getByRole("tab", { name: "Components" })).toHaveClass(
      "bg-accent",
      "rounded-lg",
      "hover:bg-accent",
      "hover:text-accent-foreground"
    );
    expect(screen.getByRole("tab", { name: "Template" })).toHaveClass(
      "hover:bg-accent",
      "hover:text-accent-foreground"
    );
    expect(
      screen.queryByTestId("structured-sidebar-active-tab-line")
    ).not.toBeInTheDocument();
    expect(button).toHaveAttribute("data-onboarding-template-id", "button");
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
    expect(itemLabels).toEqual(
      sortedTemplates.map((template) => template.label)
    );
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
      expect(item.querySelector(":scope > span:last-child")).not.toHaveClass(
        "font-semibold"
      );
    });
    const buttonIndex = sortedTemplates.findIndex(
      (template) => template.id === "button"
    );
    const buttonPreview = templateItems[buttonIndex].querySelector(
      '[data-testid="structured-template-preview-grid"]'
    );
    expect(buttonPreview?.tagName).toBe("CANVAS");
    expect(group).toHaveClass("p-0");
    expect(button).toHaveClass("items-center", "gap-3");
    expect(
      screen.queryByRole("button", { name: /amibios/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /safari/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /file tree/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /timeline/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /snippet/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /terminal/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /phone/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Nerd Icons")).not.toBeInTheDocument();
  });

  it("does not render the migrated utility footer", () => {
    const { container } = render(
      <SidebarProvider>
        <SidebarRight />
      </SidebarProvider>
    );

    expect(container.querySelector('[data-slot="sidebar-footer"]')).toBeNull();
    expect(
      screen.queryByTestId("sidebar-footer-actions")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Open Source Code" })
    ).not.toBeInTheDocument();
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
    expect(rail).toHaveAttribute("data-onboarding-target", "character-library");
    const railSlot = rail.parentElement;
    const scrollArea = railSlot?.parentElement?.querySelector(
      '[data-slot="scroll-area"]'
    );
    const tabs = screen.getAllByRole("tab");
    expect(rail).toHaveClass("bg-host-surface", "p-[3px]");
    expect(rail.parentElement).not.toHaveClass("border-r", "border-b");
    expect(railSlot?.parentElement).toHaveClass(
      "grid-cols-[minmax(0,1fr)_3rem]"
    );
    expect(railSlot).toHaveClass("col-start-2", "row-start-1", "px-[3px]");
    expect(scrollArea).toHaveClass("col-start-1", "row-start-1");
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
    expect(
      screen.getByRole("tabpanel", { name: "Nerd Icons characters" })
    ).toBeInTheDocument();
    const search = screen.getByRole("searchbox", { name: "Search characters" });
    fireEvent.change(search, { target: { value: "folder" } });
    await waitFor(() =>
      expect(useLibraryStore.getState().searchQueries.nerd).toBe("folder")
    );

    fireEvent.click(screen.getByRole("tab", { name: "Emoji" }));
    expect(
      screen.getByRole("searchbox", { name: "Search characters" })
    ).toHaveValue("");
    fireEvent.click(screen.getByRole("tab", { name: "Nerd Icons" }));
    const restoredSearch = screen.getByRole("searchbox", {
      name: "Search characters",
    });
    expect(restoredSearch).toHaveValue("folder");
    expect(restoredSearch).toHaveClass(
      "[&::-webkit-search-cancel-button]:hidden"
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(restoredSearch).toHaveValue("");
    expect(restoredSearch).toHaveFocus();

    fireEvent.change(restoredSearch, { target: { value: "folder" } });
    fireEvent.keyDown(restoredSearch, { key: "Escape" });
    expect(restoredSearch).toHaveValue("");
    expect(restoredSearch).toHaveFocus();
    expect(
      screen.queryByRole("button", { name: "Clear search" })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Unicode" }));
    const unicodeSearch = screen.getByRole("searchbox", {
      name: "Search characters",
    });
    fireEvent.change(unicodeSearch, { target: { value: "arrow" } });
    expect(
      screen.getByRole("button", { name: "Clear search" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Search all Unicode" })
    ).toBeInTheDocument();
    expect(unicodeSearch).toHaveClass("pr-16");
  });

  it("moves Add slide into the Slides header", () => {
    useEditorStore.setState({
      canvasMode: "slide",
      slideDeck: {
        activeSlideId: "slide-1",
        slides: [
          {
            id: "slide-1",
            name: "Slide 1",
            size: { columns: 100, rows: 27 },
            grid: [],
          },
        ],
      },
    });

    render(
      <SidebarProvider>
        <SidebarRight />
      </SidebarProvider>
    );

    const headerContent = screen.getByTestId("sidebar-header-content");
    const navigator = screen.getByTestId("slide-navigator");
    const addSlide = screen.getByRole("button", { name: "Add slide" });
    const slideViewTabs = within(
      screen.getByTestId("slide-view-rail-vertical")
    ).getAllByRole("tab");

    expect(headerContent).toContainElement(addSlide);
    expect(navigator).not.toContainElement(addSlide);
    expect(within(headerContent).queryByText("Slides", { exact: true })).not.toBeInTheDocument();
    expect(slideViewTabs.map((tab) => tab.getAttribute("aria-label"))).toEqual([
      "Slides",
      "Essentials",
      "Nerd Icons",
      "Emoji",
      "Unicode",
    ]);
    slideViewTabs.forEach((tab) =>
      expect(tab).toHaveAttribute("data-slot", "tooltip-trigger")
    );

    fireEvent.click(addSlide);

    expect(useEditorStore.getState().slideDeck?.slides).toHaveLength(2);
    expect(useEditorStore.getState().slideDeck?.activeSlideId).toBe(
      useEditorStore.getState().slideDeck?.slides[1].id
    );
  });

  it("collapses to only the trigger and preserves the selected character view", () => {
    useEditorStore.setState({ canvasMode: "freeform" });
    useLibraryStore.setState({ loadMainPacks: vi.fn() });

    const { container } = render(
      <SidebarProvider>
        <SidebarRight />
      </SidebarProvider>
    );

    const trigger = screen.getByRole("button", { name: "Toggle Sidebar" });
    const rail = screen.getByTestId("character-view-rail-vertical");
    const headerContent = screen.getByTestId("sidebar-header-content");
    const content = container.querySelector('[data-slot="sidebar-content"]');
    const sidebar = container.querySelector('[data-slot="sidebar"]');
    const inner = container.querySelector('[data-slot="sidebar-inner"]');

    fireEvent.click(screen.getByRole("tab", { name: "Emoji" }));
    expect(screen.getByRole("tab", { name: "Emoji" })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    fireEvent.click(trigger);

    expect(sidebar).toHaveAttribute("data-state", "collapsed");
    expect(sidebar).toHaveAttribute("data-collapsed-appearance", "trigger");
    expect(content).toHaveAttribute("aria-hidden", "true");
    expect(content).toHaveAttribute("inert");
    expect(headerContent).toHaveAttribute("aria-hidden", "true");
    expect(headerContent).toHaveAttribute("inert");
    expect(inner).toHaveClass("bg-transparent!", "shadow-none");
    expect(inner).not.toHaveClass("bg-host-surface", "shadow-host");
    expect(trigger).toHaveClass("size-8", "pointer-events-auto");
    expect(trigger).not.toHaveClass("bg-muted");
    expect(screen.getAllByRole("button")).toEqual([trigger]);
    expect(
      screen.queryByRole("tab", { name: "Emoji" })
    ).not.toBeInTheDocument();

    fireEvent.click(trigger);

    expect(screen.getByTestId("character-view-rail-vertical")).toBe(rail);
    expect(screen.getByRole("tab", { name: "Emoji" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(headerContent).not.toHaveAttribute("aria-hidden");
    expect(headerContent).not.toHaveAttribute("inert");
    expect(
      screen.getByRole("tabpanel", { name: "Emoji characters" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", { name: "Search characters" })
    ).toBeInTheDocument();
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
    expect(
      screen.getByRole("button", { name: /amibios/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /safari/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /file tree/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /timeline/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /snippet/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /terminal/i })
    ).toBeInTheDocument();
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
    expect(
      screen.queryByRole("button", { name: /button/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("No templates found")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Components" }));

    expect(screen.getByRole("tab", { name: "Components" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("button", { name: /button/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /amibios/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /safari/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /file tree/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /timeline/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /snippet/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /terminal/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /phone/i })
    ).not.toBeInTheDocument();
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
    expect(search).toHaveClass(
      "bg-search-surface",
      "border-0",
      "shadow-none",
      "focus-visible:ring-1"
    );
    expect(search).not.toHaveClass("bg-accent/60", "focus-visible:ring-2");
    expect(search).toHaveClass(
      "[&::-webkit-search-cancel-button]:hidden"
    );

    fireEvent.change(search, { target: { value: "badge" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(search).toHaveValue("");
    expect(search).toHaveFocus();

    fireEvent.change(search, { target: { value: "badge" } });
    fireEvent.keyDown(search, { key: "Escape" });
    expect(search).toHaveValue("");
    expect(search).toHaveFocus();

    fireEvent.change(search, { target: { value: "badge" } });

    expect(screen.getByRole("button", { name: /badge/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /button/i })
    ).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "accordion" } });

    expect(
      screen.getByRole("button", { name: /accordion/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /badge/i })
    ).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "status" } });

    expect(screen.getByRole("button", { name: /status/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /accordion/i })
    ).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "calendar" } });

    expect(
      screen.getByRole("button", { name: /calendar/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /status/i })
    ).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "alert" } });

    expect(screen.getByRole("button", { name: /alert/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /calendar/i })
    ).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "switch" } });

    expect(screen.getByRole("button", { name: /switch/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /alert/i })
    ).not.toBeInTheDocument();

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

    expect(
      screen.queryByRole("tab", { name: "Template" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "Components" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("searchbox", { name: "Search structured library" })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("No templates found")).not.toBeInTheDocument();
  });

  it("hides structured controls when collapsed and restores their state", () => {
    useEditorStore.setState({ canvasMode: "structured" });

    const { container } = render(
      <SidebarProvider>
        <SidebarRight />
      </SidebarProvider>
    );

    const rail = screen.getByTestId("structured-view-rail-vertical");
    const trigger = screen.getByRole("button", { name: "Toggle Sidebar" });
    const content = container.querySelector('[data-slot="sidebar-content"]');

    fireEvent.click(screen.getByRole("tab", { name: "Template" }));
    fireEvent.click(trigger);

    expect(content).toHaveAttribute("aria-hidden", "true");
    expect(content).toHaveAttribute("inert");
    expect(screen.getAllByRole("button")).toEqual([trigger]);
    expect(
      screen.queryByRole("tab", { name: "Template" })
    ).not.toBeInTheDocument();

    fireEvent.click(trigger);

    expect(screen.getByTestId("structured-view-rail-vertical")).toBe(rail);
    expect(screen.getByRole("tab", { name: "Template" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(
      screen.getByRole("tabpanel", { name: "Template" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", { name: "Search structured library" })
    ).toBeInTheDocument();
  });

  it("renders localized operation labels without changing template labels", () => {
    useEditorStore.setState({ canvasMode: "structured" });
    setUiLanguage("zh");

    render(
      <SidebarProvider>
        <SidebarRight />
      </SidebarProvider>
    );

    expect(
      screen.getByRole("searchbox", { name: "搜索结构库" })
    ).toHaveAttribute("placeholder", "搜索");
    expect(screen.getByRole("tab", { name: "模板" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "组件" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /button/i })).toBeInTheDocument();
  });

  it("localizes freeform Sidebar Host labels without translating standard terms", () => {
    useEditorStore.setState({ canvasMode: "freeform" });
    setUiLanguage("zh");

    render(
      <SidebarProvider>
        <SidebarRight />
      </SidebarProvider>
    );

    expect(screen.getByRole("tablist", { name: "字符库视图" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "常用" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Nerd Icons" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Emoji" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Unicode" })).toBeInTheDocument();
    expect(screen.getByRole("tabpanel", { name: "常用字符" })).toBeInTheDocument();
    const search = screen.getByRole("searchbox", { name: "搜索字符" });
    expect(search).toHaveAttribute("placeholder", "搜索当前视图");
    expect(search).toHaveClass(
      "bg-search-surface",
      "border-0",
      "shadow-none",
      "focus-visible:ring-1"
    );
    expect(search).not.toHaveClass("bg-accent/60", "focus-visible:ring-2");
    expect(screen.getByRole("button", { name: "切换侧栏" })).toBeInTheDocument();
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
