import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { SessionTabs } from "@/domains/sessions/components/SessionTabs";
import { useCanvasStore } from "@/domains/canvas/state/canvasStore";

describe("SessionTabs auto-hide", () => {
  const initialState = useCanvasStore.getState();

  beforeEach(() => {
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
    vi.useRealTimers();
    useCanvasStore.setState(initialState, true);
  });

  const setTwoSessions = () => {
    act(() => {
      useCanvasStore.setState({
        activeCanvasId: "canvas-a",
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

  it("starts collapsed with only the active canvas visible", () => {
    setTwoSessions();

    render(<SessionTabs />);
    const wrapper = document.querySelector('[data-canvas-ui="true"]') as HTMLElement | null;

    expect(screen.getByRole("button", { name: "Expand canvas sessions" })).toBeInTheDocument();
    expect(wrapper?.style.width).toBe("var(--session-tabs-width)");
    expect(wrapper?.style.getPropertyValue("--session-tabs-width")).toContain("clamp(");
    expect(wrapper?.style.getPropertyValue("--session-tabs-width")).not.toBe("16rem");
    expect(screen.getAllByText("Alpha")).toHaveLength(2);
    expect(screen.getByText("Beta").closest("[aria-hidden]")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
  });

  it("expands the full session list on pointer enter", () => {
    setTwoSessions();

    const { container } = render(<SessionTabs />);
    const wrapper = container.querySelector('[data-canvas-ui="true"]') as HTMLElement | null;
    const shell = container.querySelector('[data-canvas-ui="true"] > div');
    expect(shell).not.toBeNull();

    fireEvent.pointerEnter(shell!);

    const expandedWidth = wrapper?.style.getPropertyValue("--session-tabs-width");
    expect(expandedWidth).toContain("clamp(");
    expect(expandedWidth).not.toBe("min(92vw, 820px)");
    expect(screen.getAllByText("Alpha")).toHaveLength(2);
    expect(screen.getByText("Beta").closest("[aria-hidden]")).toHaveAttribute(
      "aria-hidden",
      "false"
    );
    expect(screen.getByLabelText("Close Alpha")).toBeInTheDocument();
  });

  it("keeps the full bar expanded while the create menu is open", async () => {
    setTwoSessions();

    render(<SessionTabs />);

    fireEvent.click(screen.getByLabelText("Create new canvas"));

    expect(await screen.findByText("New Freeform")).toBeInTheDocument();
    expect(screen.getByText("Beta").closest("[aria-hidden]")).toHaveAttribute(
      "aria-hidden",
      "false"
    );
  });

  it("collapses after pointer leave delay", () => {
    vi.useFakeTimers();
    setTwoSessions();

    const { container } = render(<SessionTabs />);
    const shell = container.querySelector('[data-canvas-ui="true"] > div');
    expect(shell).not.toBeNull();

    fireEvent.pointerEnter(shell!);
    expect(screen.getByText("Beta").closest("[aria-hidden]")).toHaveAttribute(
      "aria-hidden",
      "false"
    );

    fireEvent.pointerLeave(shell!);
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByText("Beta").closest("[aria-hidden]")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
  });

  it("consumes shell wheel events so scroll areas underneath do not move", () => {
    setTwoSessions();
    const parentWheel = vi.fn();

    const { container } = render(
      <div onWheel={parentWheel}>
        <SessionTabs />
      </div>
    );
    const shell = container.querySelector('[data-canvas-ui="true"] > div');
    expect(shell).not.toBeNull();

    const wheelEvent = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: 32,
    });

    expect(shell!.dispatchEvent(wheelEvent)).toBe(false);
    expect(wheelEvent.defaultPrevented).toBe(true);
    expect(parentWheel).not.toHaveBeenCalled();
  });

  it("maps wheel movement over expanded tabs to horizontal tab scrolling", () => {
    setTwoSessions();

    const { container } = render(<SessionTabs />);
    const shell = container.querySelector('[data-canvas-ui="true"] > div');
    expect(shell).not.toBeNull();

    fireEvent.pointerEnter(shell!);
    const scroller = container.querySelector(
      '[data-session-tabs-scroll="true"]'
    ) as HTMLElement | null;
    expect(scroller).not.toBeNull();

    Object.defineProperty(scroller!, "clientWidth", {
      configurable: true,
      value: 80,
    });
    Object.defineProperty(scroller!, "scrollWidth", {
      configurable: true,
      value: 240,
    });
    scroller!.scrollLeft = 0;

    const wheelEvent = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: 48,
    });

    expect(scroller!.dispatchEvent(wheelEvent)).toBe(false);
    expect(wheelEvent.defaultPrevented).toBe(true);
    expect(scroller!.scrollLeft).toBe(48);
  });
});
