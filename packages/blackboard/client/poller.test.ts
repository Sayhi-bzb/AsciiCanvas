// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { pollBlackboard, startBlackboardPolling, type BlackboardView } from "./poller";

const createView = () => ({
  showSource: vi.fn(),
  showUnchanged: vi.fn(),
  showWaiting: vi.fn(),
  showDisconnected: vi.fn(),
}) satisfies BlackboardView;

describe("Blackboard polling", () => {
  it("maps current, unchanged, missing, and failed responses", async () => {
    const view = createView();
    const currentFetch = vi.fn(async () => new Response("board", {
      status: 200,
      headers: { ETag: '"one"' },
    }));
    const state = await pollBlackboard({}, view, currentFetch);
    expect(state).toEqual({ etag: '"one"' });
    expect(view.showSource).toHaveBeenCalledWith("board");

    const unchangedFetch = vi.fn(async () => new Response(null, { status: 304 }));
    await pollBlackboard(state, view, unchangedFetch);
    expect(unchangedFetch).toHaveBeenCalledWith("/board", expect.objectContaining({
      headers: { "If-None-Match": '"one"' },
    }));
    expect(view.showUnchanged).toHaveBeenCalled();

    await expect(pollBlackboard(state, view, vi.fn(async () => new Response(null, { status: 404 })))).resolves.toEqual({});
    expect(view.showWaiting).toHaveBeenCalled();

    await expect(pollBlackboard(state, view, vi.fn(async () => { throw new Error("offline"); }))).resolves.toEqual(state);
    expect(view.showDisconnected).toHaveBeenCalled();
  });

  it("does not overlap scheduled requests", async () => {
    vi.useFakeTimers();
    const view = createView();
    let active = 0;
    let maximum = 0;
    const fetchBoard = vi.fn(async () => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 100));
      active -= 1;
      return new Response(null, { status: 404 });
    });
    const stop = startBlackboardPolling(view, { intervalMs: 500, fetchBoard });
    await vi.advanceTimersByTimeAsync(1_750);
    stop();
    expect(maximum).toBe(1);
    expect(fetchBoard).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });
});
