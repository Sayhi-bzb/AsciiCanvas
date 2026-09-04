import { describe, expect, it } from "vitest";
import { createSlideDeck } from "@/domains/slides/public";
import {
  isSourceBackedCanvasSession,
  type CanvasSession,
} from "./model";

const slideSession = (sourceId?: string): CanvasSession => ({
  id: "deck",
  name: "Deck",
  mode: "slide",
  slideDeck: createSlideDeck({ initialSlideId: "slide-1" }),
  ...(sourceId ? {
    sourceBinding: { kind: "blackboard" as const, provider: "browser-workspace" as const, id: sourceId },
  } : {}),
  scene: [],
  components: [],
  grid: [],
});

describe("isSourceBackedCanvasSession", () => {
  it("distinguishes attached projections from detached editable sessions", () => {
    expect(isSourceBackedCanvasSession({
      id: "board",
      name: "Board",
      mode: "freeform",
      sourceBinding: { kind: "blackboard", provider: "browser-workspace", id: "workspace-1" },
      scene: [],
      components: [],
      grid: [],
    })).toBe(true);
    expect(isSourceBackedCanvasSession(slideSession("workspace-1"))).toBe(true);
    expect(isSourceBackedCanvasSession(slideSession())).toBe(false);
  });
});
