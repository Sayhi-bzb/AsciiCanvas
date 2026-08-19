import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SidebarProvider,
  SidebarStandard,
} from "@/shared/ui/sidebar";

describe("SidebarStandard scrolling", () => {
  beforeEach(() => {
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

  it("uses the shared ScrollArea by default", () => {
    const { container } = render(
      <SidebarProvider>
        <SidebarStandard>Content</SidebarStandard>
      </SidebarProvider>
    );

    const content = container.querySelector('[data-slot="sidebar-content"]');

    expect(content).not.toHaveAttribute("data-scroll-area");
    expect(content).toHaveClass("group/content-scroll-area");
    expect(
      content?.querySelector('[data-slot="scroll-area-viewport"]')
    ).toBeInTheDocument();
    expect(
      content?.querySelector('[data-slot="sidebar-scroll-content"]')
    ).toHaveTextContent("Content");
    expect(
      content?.querySelector('[data-slot="scroll-area-scrollbar"]')
    ).toBeInTheDocument();
    expect(content).not.toHaveClass("px-2", "py-2");
    expect(
      content?.querySelector('[data-slot="sidebar-scroll-content"]')
    ).toHaveClass("px-2", "py-2");
  });

  it("provides the compact desktop sidebar widths", () => {
    const { container } = render(
      <SidebarProvider>
        <SidebarStandard>Content</SidebarStandard>
      </SidebarProvider>
    );

    expect(container.querySelector('[data-slot="sidebar-wrapper"]')).toHaveStyle({
      "--sidebar-width": "16rem",
      "--sidebar-width-icon": "2.5rem",
    });
  });

  it("supports composite layouts that own their inner scroll area", () => {
    const { container } = render(
      <SidebarProvider>
        <SidebarStandard contentScroll="none">Content</SidebarStandard>
      </SidebarProvider>
    );

    const content = container.querySelector('[data-slot="sidebar-content"]');

    expect(content).toHaveClass("overflow-hidden");
    expect(
      content?.querySelector('[data-slot="scroll-area-viewport"]')
    ).not.toBeInTheDocument();
  });

  it("keeps one toggle in place while switching its sidebar icon", () => {
    const { container } = render(
      <SidebarProvider defaultOpen>
        <SidebarStandard side="right" collapsedAppearance="trigger">
          Content
        </SidebarStandard>
      </SidebarProvider>
    );

    const toggle = screen.getByRole("button", { name: /toggle sidebar/i });
    const surface = container.querySelector('[data-slot="sidebar-container"]');
    expect(toggle.querySelector("svg")).toHaveClass("lucide-panel-right-close");
    expect(surface).toHaveClass(
      "h-full",
      "pointer-events-auto",
      "transition-[height,background-color,box-shadow]",
      "duration-[var(--motion-standard)]",
      "ease-[cubic-bezier(0.22,1,0.36,1)]"
    );

    fireEvent.click(toggle);

    expect(screen.getByRole("button", { name: /toggle sidebar/i })).toBe(toggle);
    expect(toggle.querySelector("svg")).toHaveClass("lucide-panel-right-open");
    expect(container.querySelector('[data-slot="sidebar"]')).toHaveAttribute(
      "data-state",
      "collapsed"
    );
    expect(container.querySelector('[data-slot="sidebar-container"]')).toBe(surface);
    expect(surface).toHaveClass("h-12");
    expect(surface).not.toHaveClass("h-full");
  });
});
