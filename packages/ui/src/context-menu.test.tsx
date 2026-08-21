import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "./context-menu";

describe("ContextMenu styling", () => {
  it("uses muted borderless surfaces for root and sub menus", async () => {
    render(
      <ContextMenu>
        <ContextMenuTrigger>Target</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>Action</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuSub>
            <ContextMenuSubTrigger>More</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem>Nested action</ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
        </ContextMenuContent>
      </ContextMenu>
    );

    fireEvent.contextMenu(screen.getByText("Target"));

    const rootMenu = await screen.findByRole("menu");
    expect(screen.getByText("Action")).toHaveClass(
      "min-h-7",
      "rounded-item",
      "px-2",
      "text-xs"
    );
    expect(rootMenu).toHaveClass(
      "bg-overlay-surface",
      "border-0",
      "shadow-overlay",
      "rounded-surface"
    );
    expect(screen.getByRole("separator")).toHaveClass(
      "h-0.5",
      "rounded-full",
      "bg-separator"
    );

    const subTrigger = screen.getByText("More");
    subTrigger.focus();
    fireEvent.keyDown(subTrigger, { key: "ArrowRight" });
    const menus = await screen.findAllByRole("menu");
    const subMenu = menus.find((menu) => menu !== rootMenu);

    expect(subMenu).toHaveClass(
      "bg-overlay-surface",
      "border-0",
      "shadow-overlay",
      "rounded-surface"
    );
  });
});
