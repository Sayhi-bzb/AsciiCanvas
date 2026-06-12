import type { CanvasSession } from "../interfaces";
import type {
  AnimationCanvasSize,
  AnimationTimeline,
  CanvasMode,
  StructuredNode,
} from "@/shared/types";

export const resolveNextSessionName = (sessions: CanvasSession[]) => {
  let maxIndex = 0;
  sessions.forEach((session) => {
    const match = session.name.match(/^Canvas\s+(\d+)$/i);
    if (!match) return;
    const value = Number(match[1]);
    if (Number.isFinite(value)) {
      maxIndex = Math.max(maxIndex, value);
    }
  });
  return `Canvas ${maxIndex + 1}`;
};

export const createSessionId = (sessions: CanvasSession[]) => {
  const existing = new Set(sessions.map((session) => session.id));
  const next = `canvas-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
  return existing.has(next) ? `${next}-${Math.random().toString(36).slice(2, 5)}` : next;
};

type ActiveSnapshot = {
  mode: CanvasMode;
  scene: StructuredNode[];
  grid: [string, { char: string; color: string }][];
  size?: AnimationCanvasSize;
  timeline?: AnimationTimeline;
};

export const withActiveCanvasSnapshot = (
  sessions: CanvasSession[],
  activeCanvasId: string,
  snapshot: ActiveSnapshot
) => {
  return sessions.map((session) =>
    session.id === activeCanvasId
        ? {
          ...session,
          mode: snapshot.mode,
          scene: snapshot.scene,
          grid: snapshot.grid,
          size: snapshot.mode === "animation" ? snapshot.size : undefined,
          timeline: snapshot.mode === "animation" ? snapshot.timeline : undefined,
        }
      : session
  );
};

export const normalizeSessionMode = (mode: unknown): CanvasMode => {
  if (mode === "structured") return "structured";
  if (mode === "animation") return "animation";
  return "freeform";
};
