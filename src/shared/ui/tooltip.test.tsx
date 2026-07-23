import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/tooltip";

const TooltipPair = () => (
  <TooltipProvider disableHoverableContent>
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button">First trigger</button>
      </TooltipTrigger>
      <TooltipContent>First tooltip</TooltipContent>
    </Tooltip>
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button">Second trigger</button>
      </TooltipTrigger>
      <TooltipContent>Second tooltip</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

describe("Tooltip", () => {
  beforeAll(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserverMock {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("delays the first hover and accelerates movement within a group", () => {
    vi.useFakeTimers();
    render(<TooltipPair />);

    const first = screen.getByRole("button", { name: "First trigger" });
    const second = screen.getByRole("button", { name: "Second trigger" });

    fireEvent.pointerMove(first, { pointerType: "mouse" });
    act(() => vi.advanceTimersByTime(499));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("tooltip")).toHaveTextContent("First tooltip");

    fireEvent.pointerLeave(first, { pointerType: "mouse" });
    fireEvent.pointerMove(second, { pointerType: "mouse" });
    expect(screen.getByRole("tooltip")).toHaveTextContent("Second tooltip");

    fireEvent.pointerLeave(second, { pointerType: "mouse" });
    act(() => vi.advanceTimersByTime(300));
    fireEvent.pointerMove(first, { pointerType: "mouse" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByRole("tooltip")).toHaveTextContent("First tooltip");
  });

  it("provides bounded multiline content and collision spacing", () => {
    render(
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger asChild>
            <button type="button">Details</button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <span>Title</span>
            <span>Metadata</span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );

    const content = document.querySelector('[data-slot="tooltip-content"]');
    expect(content).toHaveClass(
      "max-w-72",
      "text-left",
      "whitespace-normal",
      "break-words"
    );
  });
});
