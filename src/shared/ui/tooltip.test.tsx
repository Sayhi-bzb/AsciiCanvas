import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  Tooltip,
  TooltipCreateHandle,
  TooltipPopup,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/tooltip";

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
});
