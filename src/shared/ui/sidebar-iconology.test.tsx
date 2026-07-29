import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SidebarProvider,
  SidebarTrigger,
} from "@/shared/ui/sidebar";

describe("SidebarTrigger iconology", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
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

  it("shows close then open for a right Sidebar", () => {
    render(
      <SidebarProvider defaultOpen>
        <SidebarTrigger side="right" />
      </SidebarProvider>
    );

    const trigger = screen.getByRole("button", { name: "Toggle Sidebar" });
    expect(trigger.querySelector(".lucide-panel-right-close")).toBeTruthy();

    fireEvent.click(trigger);

    expect(trigger.querySelector(".lucide-panel-right-open")).toBeTruthy();
  });
});
