import type { AnimationCanvasSize, AnimationTimeline } from "@/shared/types";
import { exportAnimationFrameToAnsi } from "./text";

const ASCIINEMA_VERSION = 2;
const DEFAULT_CAST_TERM = "xterm-256color";

type CastHeader = {
  version: number;
  width: number;
  height: number;
  timestamp?: number;
  env?: Record<string, string>;
};

export const exportAnimationToCast = (
  size: AnimationCanvasSize,
  timeline: AnimationTimeline,
  options?: {
    includeColor?: boolean;
    timestamp?: number;
  }
) => {
  const fps = Math.max(1, timeline.fps);
  const header: CastHeader = {
    version: ASCIINEMA_VERSION,
    width: size.width,
    height: size.height,
    timestamp: options?.timestamp ?? Math.floor(Date.now() / 1000),
    env: { TERM: DEFAULT_CAST_TERM },
  };
  const lines = [JSON.stringify(header)];

  timeline.frames.forEach((frame, index) => {
    const time = Number((index / fps).toFixed(6));
    lines.push(
      JSON.stringify([
        time,
        "o",
        `\r${exportAnimationFrameToAnsi(size, frame.grid, {
          includeColor: options?.includeColor,
        })}`,
      ])
    );
  });

  lines.push(
    JSON.stringify([Number((timeline.frames.length / fps).toFixed(6)), "o", ""])
  );
  return `${lines.join("\n")}\n`;
};
