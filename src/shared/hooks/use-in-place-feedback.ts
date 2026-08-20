import { useCallback, useEffect, useRef, useState } from "react";
import type { FeedbackStatus } from "@/shared/styles/tokens";

type InPlaceFeedbackOperationResult<T> =
  | boolean
  | { success: boolean; target?: T };

export type InPlaceFeedback<T> = {
  target: T;
  status: FeedbackStatus;
};

type InPlaceFeedbackOptions = {
  successDurationMs?: number;
  errorDurationMs?: number;
  warningDurationMs?: number;
};

const DEFAULT_SUCCESS_DURATION_MS = 600;
const DEFAULT_ERROR_DURATION_MS = 1200;
const DEFAULT_WARNING_DURATION_MS = 3000;

export function useInPlaceFeedback<T>({
  successDurationMs = DEFAULT_SUCCESS_DURATION_MS,
  errorDurationMs = DEFAULT_ERROR_DURATION_MS,
  warningDurationMs = DEFAULT_WARNING_DURATION_MS,
}: InPlaceFeedbackOptions = {}) {
  const [feedback, setFeedback] = useState<InPlaceFeedback<T> | null>(null);
  const requestIdRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPending = useCallback(() => {
    requestIdRef.current += 1;
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const clear = useCallback(() => {
    cancelPending();
    setFeedback(null);
  }, [cancelPending]);

  useEffect(() => cancelPending, [cancelPending]);

  const publish = useCallback(
    (
      requestId: number,
      target: T,
      status: FeedbackStatus,
      durationMs?: number
    ) => {
      setFeedback({ target, status });
      const defaultDuration =
        status === "success"
          ? successDurationMs
          : status === "error"
            ? errorDurationMs
            : warningDurationMs;
      timeoutRef.current = setTimeout(() => {
        if (requestId === requestIdRef.current) setFeedback(null);
        timeoutRef.current = null;
      }, durationMs ?? defaultDuration);
    },
    [errorDurationMs, successDurationMs, warningDurationMs]
  );

  const show = useCallback(
    (target: T, status: FeedbackStatus, durationMs?: number) => {
      const requestId = requestIdRef.current + 1;
      clear();
      requestIdRef.current = requestId;
      publish(requestId, target, status, durationMs);
      return status;
    },
    [clear, publish]
  );

  const run = useCallback(
    async (
      target: T,
      operation: () =>
        | InPlaceFeedbackOperationResult<T>
        | Promise<InPlaceFeedbackOperationResult<T>>
    ) => {
      const requestId = requestIdRef.current + 1;
      clear();
      requestIdRef.current = requestId;

      let result: InPlaceFeedbackOperationResult<T> = false;
      try {
        result = await operation();
      } catch {
        result = false;
      }
      if (requestId !== requestIdRef.current) return null;

      const succeeded = typeof result === "boolean" ? result : result.success;
      const feedbackTarget =
        typeof result === "boolean" ? target : (result.target ?? target);
      const status: FeedbackStatus = succeeded ? "success" : "error";
      publish(requestId, feedbackTarget, status);
      return status;
    },
    [clear, publish]
  );

  return { feedback, run, show, clear };
}
