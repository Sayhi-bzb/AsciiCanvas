import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScrollArea } from "@/shared/ui/scroll-area";

describe("ScrollArea", () => {
  it("keeps vertical scrolling as the default", () => {
    const { container } = render(
      <ScrollArea className="h-20">
        <div>Content</div>
      </ScrollArea>
    );

    expect(container.querySelector('[data-slot="scroll-area"]')).toHaveAttribute(
      "data-scrollbars",
      "vertical"
    );
  });

  it("renders both scrollbars and their corner when requested", () => {
    const { container } = render(
      <ScrollArea scrollbars="both" className="size-20">
        <div className="size-40">Content</div>
      </ScrollArea>
    );

    expect(container.querySelector('[data-slot="scroll-area"]')).toHaveAttribute(
      "data-scrollbars",
      "both"
    );
  });
});
