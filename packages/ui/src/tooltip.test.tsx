import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  Tooltip,
  TooltipCreateHandle,
  TooltipPopup,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip.js";

const TooltipPair = () => {
  const handle = React.useMemo(() => TooltipCreateHandle<string>(), []);

  return (
    <TooltipProvider>
      <TooltipTrigger
        handle={handle}
        payload="First tooltip"
        render={<button type="button" />}
      >
        First trigger
      </TooltipTrigger>
      <TooltipTrigger
        handle={handle}
        payload="Second tooltip"
        render={<button type="button" />}
      >
        Second trigger
      </TooltipTrigger>
      <Tooltip handle={handle}>
        {({ payload }) => <TooltipPopup>{payload}</TooltipPopup>}
      </Tooltip>
    </TooltipProvider>
  );
};

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

  it("shares one popup and switches payload between triggers", () => {
    render(<TooltipPair />);

    const first = screen.getByRole("button", { name: "First trigger" });
    const second = screen.getByRole("button", { name: "Second trigger" });

    fireEvent.focus(first);
    expect(screen.getByRole("tooltip")).toHaveTextContent("First tooltip");
    expect(screen.getAllByRole("tooltip")).toHaveLength(1);

    fireEvent.blur(first);
    fireEvent.focus(second);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Second tooltip");
    expect(screen.getAllByRole("tooltip")).toHaveLength(1);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("provides the compact popup surface without an arrow", () => {
    render(
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger render={<button type="button" />}>
            Details
          </TooltipTrigger>
          <TooltipPopup side="top">
            <span>Compact details</span>
          </TooltipPopup>
        </Tooltip>
      </TooltipProvider>
    );

    const popup = document.querySelector('[data-slot="tooltip-popup"]');
    expect(popup).toHaveClass(
      "max-w-56",
      "px-2",
      "py-1",
      "text-[11px]"
    );
    expect(document.querySelector('[data-slot="tooltip-arrow"]')).toBeNull();
  });

  it("closes an open tooltip when any scroll container moves", () => {
    render(
      <TooltipProvider>
        <div data-testid="scroll-container">
          <Tooltip>
            <TooltipTrigger render={<button type="button" />}>
              Scroll trigger
            </TooltipTrigger>
            <TooltipPopup>Scroll details</TooltipPopup>
          </Tooltip>
        </div>
      </TooltipProvider>
    );

    fireEvent.focus(screen.getByRole("button", { name: "Scroll trigger" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Scroll details");

    fireEvent.scroll(screen.getByTestId("scroll-container"));

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("cancels a delayed tooltip when scrolling before it opens", async () => {
    vi.useFakeTimers();

    render(
      <TooltipProvider delay={500}>
        <div data-testid="scroll-container">
          <Tooltip>
            <TooltipTrigger render={<button type="button" />}>
              Delayed trigger
            </TooltipTrigger>
            <TooltipPopup>Delayed details</TooltipPopup>
          </Tooltip>
        </div>
      </TooltipProvider>
    );

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Delayed trigger" }));
    fireEvent.scroll(screen.getByTestId("scroll-container"));
    await vi.advanceTimersByTimeAsync(500);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
