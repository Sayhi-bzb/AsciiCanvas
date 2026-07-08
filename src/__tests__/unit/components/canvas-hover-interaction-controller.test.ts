import { describe, expect, it, vi } from "vitest";
import { createHoverInteractionController } from "@/domains/canvas/components/AsciiCanvas/hooks/interaction/preview/hoverInteractionController";
import type { CanvasLinkHit } from "@/domains/canvas/components/AsciiCanvas/hooks/interaction/core/linkHitTesting";

const linkHit: CanvasLinkHit = {
  href: "https://example.com",
  startX: 1,
  endX: 4,
  y: 2,
};

describe("hover interaction controller", () => {
  it("tracks link hover and uses pointer cursor only with modifiers", () => {
    const container = document.createElement("div");
    const setHoveredLink = vi.fn();
    const controller = createHoverInteractionController({
      getContainer: () => container,
      setHoveredLink,
      setHoveredGrid: vi.fn(),
    });

    controller.updateLinkHover(linkHit, { ctrlKey: false, metaKey: false });
    expect(controller.getLinkCandidate()).toBe(linkHit);
    expect(setHoveredLink).toHaveBeenCalledWith(linkHit);
    expect(container.style.cursor).toBe("");

    controller.syncLinkModifierState({ ctrlKey: true, metaKey: false });
    expect(container.style.cursor).toBe("pointer");

    controller.syncLinkModifierState({ ctrlKey: false, metaKey: false });
    expect(container.style.cursor).toBe("");
  });

  it("clears link hover and cursor", () => {
    const container = document.createElement("div");
    const setHoveredLink = vi.fn();
    const controller = createHoverInteractionController({
      getContainer: () => container,
      setHoveredLink,
      setHoveredGrid: vi.fn(),
    });

    controller.updateLinkHover(linkHit, { ctrlKey: true, metaKey: false });
    controller.clearLinkHover();

    expect(controller.getLinkCandidate()).toBeNull();
    expect(setHoveredLink).toHaveBeenLastCalledWith(null);
    expect(container.style.cursor).toBe("");
  });

  it("updates color picker hover with crosshair cursor", () => {
    const container = document.createElement("div");
    const setHoveredGrid = vi.fn();
    const controller = createHoverInteractionController({
      getContainer: () => container,
      setHoveredLink: vi.fn(),
      setHoveredGrid,
    });

    controller.updateColorPickerHover({ x: 3, y: 5 });

    expect(setHoveredGrid).toHaveBeenCalledWith({ x: 3, y: 5 });
    expect(container.style.cursor).toBe("crosshair");
  });
});

