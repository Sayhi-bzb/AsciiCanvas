import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CanvasBreadcrumb } from "@/widgets/session-tabs/CanvasBreadcrumb";
import { useEditorStore } from "@/domains/canvas/public";
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

  const openMenu = () => {
    fireEvent.pointerDown(screen.getByRole("button", { name: "Select canvas" }), {
      button: 0,
      ctrlKey: false,
    });
  };

  const openSubmenu = async (name: string) => {
    const trigger = screen.getByRole("menuitem", { name });
    fireEvent.pointerMove(trigger, { pointerType: "mouse" });
    await waitFor(() => expect(trigger).toHaveAttribute("data-state", "open"));
  };

  it("renders an uncontained active-canvas breadcrumb and switches directly", async () => {
    setTwoSessions();
    const { container } = render(<CanvasBreadcrumb />);

    const trigger = screen.getByRole("button", { name: "Select canvas" });
    expect(trigger).toHaveClass("bg-transparent");
    expect(trigger).not.toHaveClass("border", "shadow");
    expect(trigger).toHaveTextContent("Alpha");
    expect(container.querySelector('[data-canvas-breadcrumb-host="true"]')).toBeInTheDocument();

    openMenu();
    const alpha = await screen.findByRole("menuitem", { name: /^Alpha$/ });
    const beta = screen.getByRole("menuitem", { name: /^Beta$/ });
    expect(alpha).toHaveAttribute("aria-current", "page");
    expect(beta).not.toHaveAttribute("aria-current");

    fireEvent.click(beta);

    expect(useEditorStore.getState().activeCanvasId).toBe("canvas-b");
    expect(trigger).toHaveTextContent("Beta");
    expect(screen.queryByRole("menu", { name: "Select canvas" })).not.toBeInTheDocument();
  });

  it("renames inline and closes a canvas through its row action submenu", async () => {
    setTwoSessions();
    render(<CanvasBreadcrumb />);

    openMenu();
    const menu = screen.getByRole("menu", { name: "Select canvas" });
    vi.spyOn(menu, "getBoundingClientRect").mockReturnValue({
      width: 176,
    } as DOMRect);
    await openSubmenu("Manage Beta");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Rename" }));

    const nameInput = await screen.findByLabelText("Canvas name");
    expect(menu.style.width).toBe("176px");
    expect(screen.getByRole("menu", { name: "Select canvas" })).toBeInTheDocument();
    expect(nameInput).toHaveFocus();
    expect(nameInput).toHaveValue("Beta");
    expect(nameInput).toHaveClass("bg-transparent", "border-0", "shadow-none");
    fireEvent.change(nameInput, { target: { value: "Discarded" } });
    fireEvent.keyDown(nameInput, { key: "Escape" });
    expect(menu.style.width).toBe("");
    expect(screen.getByRole("menu", { name: "Select canvas" })).toBeInTheDocument();
    expect(
      useEditorStore.getState().canvasSessions.find((session) => session.id === "canvas-b")
        ?.name
    ).toBe("Beta");

    await openSubmenu("Manage Beta");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Rename" }));
    const renamedInput = await screen.findByLabelText("Canvas name");
    expect(menu.style.width).toBe("176px");
    fireEvent.change(renamedInput, { target: { value: "  Gamma  " } });
    fireEvent.keyDown(renamedInput, { key: "Enter" });
    expect(menu.style.width).toBe("");

    expect(
      useEditorStore.getState().canvasSessions.find((session) => session.id === "canvas-b")
        ?.name
    ).toBe("Gamma");

    await openSubmenu("Manage Gamma");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Rename" }));
    const blurredInput = await screen.findByLabelText("Canvas name");
    expect(menu.style.width).toBe("176px");
    fireEvent.change(blurredInput, { target: { value: "  Delta  " } });
    fireEvent.blur(blurredInput);
    expect(menu.style.width).toBe("");
    expect(
      useEditorStore.getState().canvasSessions.find((session) => session.id === "canvas-b")
        ?.name
    ).toBe("Delta");

    await openSubmenu("Manage Delta");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Close" }));
    expect(await screen.findByRole("heading", { name: "Delete This Canvas?" })).toBeInTheDocument();
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
    fireEvent.pointerDown(screen.getByRole("button", { name: "选择画布" }), {
      button: 0,
      ctrlKey: false,
    });
    expect(await screen.findByRole("menuitem", { name: /^Beta$/ })).toBeInTheDocument();
    await openSubmenu("管理 Beta");
    expect(await screen.findByRole("menuitem", { name: "重命名" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "关闭" })).toBeInTheDocument();
  });
});
