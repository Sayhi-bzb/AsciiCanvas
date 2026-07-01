import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import { SidebarRight } from "@/domains/canvas/components/ToolBar/sidebar-right";
import { useCanvasStore } from "@/domains/canvas/state/canvasStore";
import { SidebarProvider } from "@/shared/ui/sidebar";

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
    const group = container.querySelector('[data-slot="sidebar-group"]');
    const button = screen.getByRole("button", { name: /button/i });

    expect(screen.getByText("Templates")).toBeInTheDocument();
    expect(button).toBeInTheDocument();
    const preview = button.querySelector("span");
    expect(preview?.textContent).toBe(" BUTTON ");
    expect(screen.queryByText("[BUTTON]")).not.toBeInTheDocument();
    expect(content).toHaveClass("p-2");
    expect(group).toHaveClass("p-0");
    expect(button).toHaveClass("items-center", "gap-3");
    expect(screen.queryByText("Nerd Icons")).not.toBeInTheDocument();
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

    expect(setDragImage).toHaveBeenCalledTimes(1);
    const dragImage = setDragImage.mock.calls[0][0] as HTMLElement;
    expect(dragImage.textContent).toBe("");
    expect(dragImage.style.width).toBe("1px");
    expect(dragImage.style.height).toBe("1px");
    expect(dragImage.style.opacity).toBe("0");
  });
});
