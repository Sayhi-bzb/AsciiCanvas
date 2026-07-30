import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setUiLanguage } from "@/shared/i18n";
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

  afterEach(() => setUiLanguage("en"));

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

  it("localizes the Sidebar trigger accessible name", () => {
    setUiLanguage("zh");
    render(
      <SidebarProvider defaultOpen>
        <SidebarTrigger side="right" />
      </SidebarProvider>
    );

    expect(screen.getByRole("button", { name: "切换侧栏" })).toBeInTheDocument();
  });
});
