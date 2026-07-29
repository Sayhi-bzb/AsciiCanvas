import type { Point } from "@/shared/types";

type AnimationScheduler = {
  now: () => number;
  requestAnimationFrame: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame: (handle: number) => void;
};

const defaultScheduler = (): AnimationScheduler => ({
  now: () => performance.now(),
  requestAnimationFrame: (callback) => window.requestAnimationFrame(callback),
  cancelAnimationFrame: (handle) => window.cancelAnimationFrame(handle),
});

export const createMinimapCameraAnimator = ({
  setOffset,
  scheduler = defaultScheduler(),
}: {
  setOffset: (updater: (previous: Point) => Point) => void;
  scheduler?: AnimationScheduler;
}) => {
  let frame: number | null = null;

  const cancel = () => {
    if (frame === null) return;
    scheduler.cancelAnimationFrame(frame);
    frame = null;
  };

  const jumpTo = (target: Point) => {
    cancel();
    setOffset(() => target);
  };

  const animateTo = (target: Point, duration: number) => {
    cancel();
    let origin: Point = target;
    setOffset((previous) => {
      origin = previous;
      return previous;
    });
    if (duration <= 0 || (origin.x === target.x && origin.y === target.y)) {
      setOffset(() => target);
      return;
    }

    const startedAt = scheduler.now();
    const tick: FrameRequestCallback = (timestamp) => {
      const progress = Math.min(Math.max((timestamp - startedAt) / duration, 0), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setOffset(() => ({
        x: origin.x + (target.x - origin.x) * eased,
        y: origin.y + (target.y - origin.y) * eased,
      }));
      if (progress < 1) {
        frame = scheduler.requestAnimationFrame(tick);
      } else {
        frame = null;
      }
    };
    frame = scheduler.requestAnimationFrame(tick);
  };

  return { animateTo, cancel, jumpTo };
};
