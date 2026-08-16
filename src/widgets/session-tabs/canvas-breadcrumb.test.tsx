import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CanvasBreadcrumb } from "@/widgets/session-tabs/CanvasBreadcrumb";
import { useEditorStore } from "@/domains/canvas/testing";
import { setUiLanguage } from "@/shared/i18n";

describe("CanvasBreadcrumb", () => {
  const initialState = useEditorStore.getState();

  beforeEach(() => {
    setUiLanguage("en");
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    setUiLanguage("en");
    useEditorStore.setState(initialState, true);
  });

  const setTwoSessions = () => {
    act(() => {
      useEditorStore.setState({
        activeCanvasId: "canvas-a",
        canvasMode: "freeform",
        canvasSessions: [
          {
            id: "canvas-a",
            name: "Alpha",
            mode: "freeform",
            scene: [],
            grid: [],
          },
          {
            id: "canvas-b",
            name: "Beta",
            mode: "structured",
            scene: [],
            grid: [],
          },
        ],
      });
    });
  };

  const openPanel = () => {
    fireEvent.click(screen.getByRole("button", { name: "Select canvas" }));
  };

  const openSubmenu = async (name: string) => {
    const trigger = screen.getByRole("menuitem", { name });
    fireEvent.pointerMove(trigger, { pointerType: "mouse" });
    await waitFor(() => expect(trigger).toHaveAttribute("data-state", "open"));
  };

  const openDropdown = async (name: string) => {
    const trigger = screen.getByRole("button", { name });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    await waitFor(() => expect(trigger).toHaveAttribute("data-state", "open"));
  };

  it("renders an uncontained active-canvas breadcrumb and switches directly", async () => {
    setTwoSessions();
    const { container } = render(<CanvasBreadcrumb />);

    const trigger = screen.getByRole("button", { name: "Select canvas" });
    expect(trigger).toHaveClass("bg-transparent");
    expect(trigger).not.toHaveClass("border", "shadow");
    expect(trigger).toHaveTextContent("Alpha");
    expect(trigger).not.toHaveAttribute("title");
    expect(container.querySelector('[data-canvas-breadcrumb-host="true"]')).toBeInTheDocument();

    fireEvent.focus(trigger);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Alpha");
    fireEvent.blur(trigger);

    openPanel();
    const panel = await screen.findByRole("dialog", { name: "Select canvas" });
    const alpha = screen.getByRole("button", { name: /^Alpha$/ });
    const beta = screen.getByRole("button", { name: /^Beta$/ });
    expect(panel).toHaveClass("min-w-44", "shadow-overlay");
    expect(alpha).toHaveAttribute("aria-current", "page");
    expect(beta).not.toHaveAttribute("aria-current");
    expect(alpha).toHaveFocus();
    const manageBeta = screen.getByRole("button", { name: "Manage Beta" });
    expect(manageBeta).not.toHaveAttribute("title");
    fireEvent.focus(manageBeta);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Manage Beta");

    fireEvent.click(beta);

    expect(useEditorStore.getState().activeCanvasId).toBe("canvas-b");
    expect(trigger).toHaveTextContent("Beta");
    expect(screen.queryByRole("dialog", { name: "Select canvas" })).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("exposes stable onboarding targets for creating a Structured Canvas", async () => {
    render(<CanvasBreadcrumb />);

    const trigger = screen.getByRole("button", { name: "Select canvas" });
    expect(trigger).toHaveAttribute("data-onboarding-target", "canvas-selector");

    openPanel();
    const create = screen.getByRole("button", { name: "Create" });
    expect(create).toHaveAttribute("data-onboarding-target", "create-menu");
    await openDropdown("Create");
    expect(screen.getByRole("menuitem", { name: "New Structured" })).toHaveAttribute(
      "data-onboarding-target",
      "create-structured"
    );
  });

  it("uses the slide icon and creates a slide deck with a custom size", async () => {
    render(<CanvasBreadcrumb />);

    const selector = screen.getByRole("button", { name: "Select canvas" });
    openPanel();
    await openDropdown("Create");
    const slidesTrigger = screen.getByRole("menuitem", { name: "New Slides" });
    expect(slidesTrigger.querySelector(".lucide-presentation")).toBeInTheDocument();

    await openSubmenu("New Slides");
    fireEvent.click(screen.getByRole("menuitem", { name: "Custom size…" }));

    expect(await screen.findByRole("heading", { name: "Custom slide size" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Select canvas" })).not.toBeInTheDocument();
    const columns = screen.getByRole("spinbutton", { name: "Columns" });
    const rows = screen.getByRole("spinbutton", { name: "Rows" });
    expect(columns).toHaveValue(100);
    expect(rows).toHaveValue(27);
    expect(columns).toHaveFocus();

    fireEvent.change(columns, { target: { value: "" } });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter positive whole numbers for columns and rows."
    );
    expect(screen.getByRole("button", { name: "Create slides" })).toBeDisabled();

    fireEvent.change(columns, { target: { value: "120" } });
    fireEvent.change(rows, { target: { value: "32" } });
    fireEvent.click(screen.getByRole("button", { name: "Create slides" }));

    await waitFor(() =>
      expect(useEditorStore.getState().slideDeck?.slides[0].size).toEqual({ columns: 120, rows: 32 })
    );
    expect(useEditorStore.getState().canvasMode).toBe("slide");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(selector).toHaveFocus();
  });

  it("cancels custom slide creation and returns focus to the canvas selector", async () => {
    render(<CanvasBreadcrumb />);
    const selector = screen.getByRole("button", { name: "Select canvas" });
    const sessionCount = useEditorStore.getState().canvasSessions.length;

    openPanel();
    await openDropdown("Create");
    await openSubmenu("New Slides");
    fireEvent.click(screen.getByRole("menuitem", { name: "Custom size…" }));
    await screen.findByRole("dialog");
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(useEditorStore.getState().canvasSessions).toHaveLength(sessionCount);
    expect(selector).toHaveFocus();
  });

  it("renames inline and closes a canvas through its row action submenu", async () => {
    setTwoSessions();
    render(<CanvasBreadcrumb />);

    openPanel();
    const panel = screen.getByRole("dialog", { name: "Select canvas" });
    vi.spyOn(panel, "getBoundingClientRect").mockReturnValue({
      width: 176,
    } as DOMRect);
    await openDropdown("Manage Beta");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Rename" }));

    const nameInput = await screen.findByLabelText("Canvas name");
    expect(panel.style.width).toBe("176px");
    expect(screen.getByRole("dialog", { name: "Select canvas" })).toBeInTheDocument();
    expect(nameInput).toHaveFocus();
    expect(nameInput).toHaveValue("Beta");
    expect(nameInput).toHaveClass("bg-transparent", "border-0", "shadow-none");
    fireEvent.change(nameInput, { target: { value: "Discarded" } });
    fireEvent.keyDown(nameInput, { key: "Escape" });
    expect(panel.style.width).toBe("");
    expect(screen.getByRole("dialog", { name: "Select canvas" })).toBeInTheDocument();
    expect(
      useEditorStore.getState().canvasSessions.find((session) => session.id === "canvas-b")
        ?.name
    ).toBe("Beta");

    await openDropdown("Manage Beta");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Rename" }));
    const renamedInput = await screen.findByLabelText("Canvas name");
    expect(panel.style.width).toBe("176px");
    fireEvent.change(renamedInput, { target: { value: "  Gamma  " } });
    fireEvent.keyDown(renamedInput, { key: "Enter" });
    expect(panel.style.width).toBe("");

    expect(
      useEditorStore.getState().canvasSessions.find((session) => session.id === "canvas-b")
        ?.name
    ).toBe("Gamma");

    await openDropdown("Manage Gamma");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Rename" }));
    const blurredInput = await screen.findByLabelText("Canvas name");
    expect(panel.style.width).toBe("176px");
    fireEvent.change(blurredInput, { target: { value: "  Delta  " } });
    fireEvent.blur(blurredInput);
    expect(panel.style.width).toBe("");
    expect(
      useEditorStore.getState().canvasSessions.find((session) => session.id === "canvas-b")
        ?.name
    ).toBe("Delta");

    await openDropdown("Manage Delta");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Close" }));
    expect(await screen.findByRole("heading", { name: "Delete canvas?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(
      useEditorStore.getState().canvasSessions.some((session) => session.id === "canvas-b")
    ).toBe(false);
  });


  it("translates operation UI without translating canvas names", async () => {
    setTwoSessions();
    setUiLanguage("zh");
    render(<CanvasBreadcrumb />);

    expect(screen.getByRole("button", { name: "选择画布" })).toHaveTextContent("Alpha");
    fireEvent.click(screen.getByRole("button", { name: "选择画布" }));
    expect(await screen.findByRole("button", { name: /^Beta$/ })).toBeInTheDocument();
    await openDropdown("管理 Beta");
    expect(await screen.findByRole("menuitem", { name: "重命名" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "关闭" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "选择画布" })).not.toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "选择画布" }));
    await openDropdown("新建");
    await openSubmenu("新建幻灯片");
    expect(screen.getByRole("menuitem", { name: "自定义大小…" })).toBeInTheDocument();
  });
});
