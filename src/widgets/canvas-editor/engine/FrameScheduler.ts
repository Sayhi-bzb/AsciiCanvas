export const CANVAS_FRAME_INVALIDATION = {
  background: 1 << 0,
  scratch: 1 << 1,
  overlay: 1 << 2,
  presentation: 1 << 3,
} as const;

export type CanvasFrameInvalidation = number;

export const CANVAS_FRAME_ALL = Object.values(CANVAS_FRAME_INVALIDATION).reduce(
  (mask, value) => mask | value,
  0
);

type CanvasFrameCallback = (
  timestamp: number,
  invalidation: CanvasFrameInvalidation
) => void;

type AnimationFramePort = {
  requestAnimationFrame: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame: (handle: number) => void;
  now: () => number;
};

const getDefaultAnimationFramePort = (): AnimationFramePort => ({
  requestAnimationFrame: (callback) => window.requestAnimationFrame(callback),
  cancelAnimationFrame: (handle) => window.cancelAnimationFrame(handle),
  now: () => performance.now(),
});

/** Coalesces every canvas subsystem onto one browser animation frame. */
export class CanvasFrameScheduler {
  private readonly port: AnimationFramePort;
  private readonly callbacks = new Map<
    string,
    { callback: CanvasFrameCallback; invalidation: CanvasFrameInvalidation }
  >();
  private frameHandle: number | null = null;
  private disposed = false;

  constructor(port: AnimationFramePort = getDefaultAnimationFramePort()) {
    this.port = port;
  }

  request(
    key: string,
    invalidation: CanvasFrameInvalidation,
    callback: CanvasFrameCallback
  ): void {
    if (this.disposed) return;
    const previous = this.callbacks.get(key);
    this.callbacks.set(key, {
      callback,
      invalidation: (previous?.invalidation ?? 0) | invalidation,
    });
    if (this.frameHandle !== null) return;
    this.frameHandle = this.port.requestAnimationFrame((timestamp) => {
      this.frameHandle = null;
      this.run(timestamp);
    });
  }

  now(): number {
    return this.port.now();
  }

  cancel(key: string): void {
    this.callbacks.delete(key);
    if (this.callbacks.size !== 0 || this.frameHandle === null) return;
    this.port.cancelAnimationFrame(this.frameHandle);
    this.frameHandle = null;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.frameHandle !== null) this.port.cancelAnimationFrame(this.frameHandle);
    this.frameHandle = null;
    this.callbacks.clear();
  }

  private run(timestamp: number): void {
    const callbacks = [...this.callbacks.values()];
    this.callbacks.clear();
    callbacks.forEach(({ callback, invalidation }) =>
      callback(timestamp, invalidation)
    );
  }
}

type RafScheduler = {
  requestAnimationFrame: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame: (handle: number) => void;
};

export const createFrameSchedulerRafAdapter = (
  scheduler: CanvasFrameScheduler,
  scope: string,
  invalidation: CanvasFrameInvalidation
): RafScheduler => {
  let nextHandle = 0;
  const keys = new Map<number, string>();
  return {
    requestAnimationFrame: (callback) => {
      const handle = ++nextHandle;
      const key = `${scope}:${handle}`;
      keys.set(handle, key);
      scheduler.request(key, invalidation, (timestamp) => {
        keys.delete(handle);
        callback(timestamp);
      });
      return handle;
    },
    cancelAnimationFrame: (handle) => {
      const key = keys.get(handle);
      if (!key) return;
      keys.delete(handle);
      scheduler.cancel(key);
    },
  };
};
