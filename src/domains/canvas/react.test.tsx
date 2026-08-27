// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Profiler } from "react";
import {
  CanvasRuntimeProvider,
  useCanvasPersistenceSelector,
  type CanvasPersistenceStatus,
} from "./public";
import { testingCanvasRuntime } from "./testing";

const readyStatus: CanvasPersistenceStatus = {
  phase: "ready",
  restore: { phase: "ready", error: null, temporaryDirty: false },
  save: "saved",
  ownership: "writer",
  error: null,
};

describe("useCanvasPersistenceSelector", () => {
  it("does not rerender when an unrelated persistence field changes", () => {
    let status = readyStatus;
    const onRender = vi.fn();
    const listeners = new Set<() => void>();
    const runtime = {
      ...testingCanvasRuntime,
      getPersistenceSnapshot: () => status,
      subscribePersistence: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
    const Probe = () => {
      const ownership = useCanvasPersistenceSelector(
        (snapshot) => snapshot.ownership
      );
      return <span>{ownership}</span>;
    };

    render(
      <CanvasRuntimeProvider runtime={runtime}>
        <Profiler id="persistence-probe" onRender={onRender}>
          <Probe />
        </Profiler>
      </CanvasRuntimeProvider>
    );
    expect(onRender).toHaveBeenCalledTimes(1);

    act(() => {
      status = { ...status, save: "saving" };
      listeners.forEach((listener) => listener());
    });
    expect(onRender).toHaveBeenCalledTimes(1);

    act(() => {
      status = { ...status, ownership: "reader" };
      listeners.forEach((listener) => listener());
    });
    expect(screen.getByText("reader")).toBeInTheDocument();
    expect(onRender).toHaveBeenCalledTimes(2);
  });
});
