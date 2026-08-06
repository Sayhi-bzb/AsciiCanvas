import type { CanvasSession } from "./model";
import type { Point } from "@/shared/types";
import type { CanvasMode } from "./mode";
import type { StructuredComponentInstance, StructuredNode } from "@/domains/structured-content/public";
import type { SlideDeck } from "@/domains/slides/public";

export const resolveNextSessionName = (
  sessions: CanvasSession[],
  mode: CanvasMode = "freeform"
) => {
  const prefix = mode === "slide" ? "Slides" : "Canvas";
  const pattern = new RegExp(`^${prefix}\\s+(\\d+)$`, "i");
  let maxIndex = 0;
  sessions.forEach((session) => {
    const match = session.name.match(pattern);
    if (!match) return;
    const value = Number(match[1]);
    if (Number.isFinite(value)) {
      maxIndex = Math.max(maxIndex, value);
    }
  });
  return `${prefix} ${maxIndex + 1}`;
};

export const createSessionId = (sessions: CanvasSession[]) => {
  const existing = new Set(sessions.map((session) => session.id));
  const next = `canvas-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
  return existing.has(next) ? `${next}-${Math.random().toString(36).slice(2, 5)}` : next;
};

type StaticActiveSnapshot = {
  mode: Exclude<CanvasMode, "slide">;
  scene: StructuredNode[];
  components?: StructuredComponentInstance[];
  grid: [string, { char: string; color: string }][];
  viewport?: { offset: Point; zoom: number };
};

type SlideActiveSnapshot = {
  mode: "slide";
  slideDeck: SlideDeck;
  viewport?: { offset: Point; zoom: number };
};

type ActiveSnapshot = StaticActiveSnapshot | SlideActiveSnapshot;

export const withActiveCanvasSnapshot = (
  sessions: CanvasSession[],
  activeCanvasId: string,
  snapshot: ActiveSnapshot
) => {
  return sessions.map((session): CanvasSession => {
    if (session.id !== activeCanvasId) return session;
    if (snapshot.mode === "slide") {
      return {
        id: session.id,
        name: session.name,
        mode: "slide",
        slideDeck: snapshot.slideDeck,
        scene: [],
        components: [],
        grid: [],
        viewport: snapshot.viewport,
      };
    }
    return {
      ...session,
      mode: snapshot.mode,
      scene: snapshot.scene,
      components: snapshot.components,
      grid: snapshot.grid,
      viewport: snapshot.viewport,
    } as CanvasSession;
  });
};

export const normalizeSessionMode = (mode: unknown): CanvasMode => {
  if (mode === "slide") return "slide";
  if (mode === "structured") return "structured";
  return "freeform";
};
