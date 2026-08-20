import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyFreeformSnapshotToYMaps,
  useEditorStore,
} from "@/domains/canvas/testing";
import { ShortcutProvider } from "@/shared/shortcuts/dispatcher";
import { useManagedCanvasInput } from "./useManagedCanvasInput";

describe("useManagedCanvasInput", () => {
  const initialState = useEditorStore.getState();

  afterEach(() => {
    useEditorStore.setState(initialState, true);
    applyFreeformSnapshotToYMaps([]);
  });

  it("does not fill a selection from a capture-prevented shortcut", () => {
    const fillSelectionsWithChar = vi.fn();
    const model = {
      ...useEditorStore.getState(),
      textCursor: null,
      selectedStructuredNodeIds: [],
      fillSelectionsWithChar,
    };
    const { result } = renderHook(
      () =>
        useManagedCanvasInput({
          canvasMode: "structured",
          model,
          size: { width: 800, height: 600 },
          onUndo: vi.fn(),
          onRedo: vi.fn(),
        }),
      { wrapper: ShortcutProvider }
    );
    const stopPropagation = vi.fn();

    act(() => {
      result.current.textareaProps.onKeyDown?.({
        defaultPrevented: true,
        stopPropagation,
      } as never);
    });

    expect(stopPropagation).not.toHaveBeenCalled();
    expect(fillSelectionsWithChar).not.toHaveBeenCalled();
  });

  it("keeps consecutive half-width input, including Space, on one advancing grid flow", () => {
    useEditorStore.setState({
      canvasMode: "freeform",
      grid: new Map(),
      textCursor: null,
      staticGridSelection: {
        mode: "cell",
        activeCell: { x: 4, y: 3 },
        anchorCell: { x: 4, y: 3 },
        primaryRange: { start: { x: 4, y: 3 }, end: { x: 4, y: 3 } },
        additionalRanges: [],
      },
      staticGridEditMode: "navigate",
      staticGridInputFlow: null,
    });
    const model = { ...useEditorStore.getState() };
    const { result } = renderHook(
      () =>
        useManagedCanvasInput({
          canvasMode: "freeform",
          model,
          size: { width: 800, height: 600 },
        }),
      { wrapper: ShortcutProvider }
    );

    act(() => {
      result.current.textareaProps.onInput?.({
        currentTarget: { value: "A" },
      } as never);
      result.current.textareaProps.onInput?.({
        currentTarget: { value: " " },
      } as never);
      result.current.textareaProps.onInput?.({
        currentTarget: { value: "B" },
      } as never);
    });

    expect(useEditorStore.getState().grid).toEqual(
      new Map([
        ["4,3", { char: "A", color: "#000000" }],
        ["5,3", { char: " ", color: "#000000" }],
        ["6,3", { char: "B", color: "#000000" }],
      ])
    );
    expect(useEditorStore.getState().textCursor).toEqual({ x: 7, y: 3 });
    expect(useEditorStore.getState().staticGridSelection.activeCell).toEqual({ x: 7, y: 3 });
  });

  it("continues the same grid flow when composition is followed by half-width input", () => {
    useEditorStore.setState({
      canvasMode: "freeform",
      grid: new Map(),
      textCursor: null,
      staticGridSelection: {
        mode: "cell",
        activeCell: { x: 2, y: 1 },
        anchorCell: { x: 2, y: 1 },
        primaryRange: { start: { x: 2, y: 1 }, end: { x: 2, y: 1 } },
        additionalRanges: [],
      },
      staticGridEditMode: "navigate",
      staticGridInputFlow: null,
    });
    const model = { ...useEditorStore.getState() };
    const { result } = renderHook(
      () =>
        useManagedCanvasInput({
          canvasMode: "freeform",
          model,
          size: { width: 800, height: 600 },
        }),
      { wrapper: ShortcutProvider }
    );

    act(() => {
      result.current.textareaProps.onCompositionStart?.();
      result.current.textareaProps.onInput?.({
        currentTarget: { value: "你" },
      } as never);
    });
    expect(useEditorStore.getState().grid).toEqual(new Map());

    act(() => {
      result.current.textareaProps.onCompositionEnd?.({ data: "你" } as never);
      result.current.textareaProps.onInput?.({
        currentTarget: { value: "A" },
      } as never);
    });

    expect(useEditorStore.getState().grid).toEqual(
      new Map([
        ["2,1", { char: "你", color: "#000000" }],
        ["4,1", { char: "A", color: "#000000" }],
      ])
    );
    expect(useEditorStore.getState().textCursor).toEqual({ x: 5, y: 1 });
  });

  it("suppresses a delayed terminal input after compositionend", async () => {
    useEditorStore.setState({
      canvasMode: "freeform",
      grid: new Map(),
      textCursor: null,
      staticGridSelection: {
        mode: "cell",
        activeCell: { x: 2, y: 1 },
        anchorCell: { x: 2, y: 1 },
        primaryRange: { start: { x: 2, y: 1 }, end: { x: 2, y: 1 } },
        additionalRanges: [],
      },
      staticGridEditMode: "navigate",
      staticGridInputFlow: null,
    });
    const { result } = renderHook(
      () => useManagedCanvasInput({
        canvasMode: "freeform",
        model: { ...useEditorStore.getState() },
        size: { width: 800, height: 600 },
      }),
      { wrapper: ShortcutProvider }
    );

    act(() => {
      result.current.textareaProps.onCompositionStart?.();
      result.current.textareaProps.onCompositionEnd?.({
        data: "你",
        currentTarget: { value: "你" },
      } as never);
    });
    await Promise.resolve();
    act(() => {
      result.current.textareaProps.onInput?.({
        currentTarget: { value: "你" },
        nativeEvent: {
          data: "你",
          isComposing: false,
          inputType: "insertFromComposition",
        },
      } as never);
    });

    expect(useEditorStore.getState().grid).toEqual(
      new Map([["2,1", { char: "你", color: "#000000" }]])
    );
    expect(useEditorStore.getState().textCursor).toEqual({ x: 4, y: 1 });
  });

  it("accepts the same text as a new input after a real keydown", () => {
    useEditorStore.setState({
      canvasMode: "freeform",
      grid: new Map(),
      textCursor: null,
      staticGridSelection: {
        mode: "cell",
        activeCell: { x: 2, y: 1 },
        anchorCell: { x: 2, y: 1 },
        primaryRange: { start: { x: 2, y: 1 }, end: { x: 2, y: 1 } },
        additionalRanges: [],
      },
      staticGridEditMode: "navigate",
      staticGridInputFlow: null,
    });
    const { result } = renderHook(
      () => useManagedCanvasInput({
        canvasMode: "freeform",
        model: { ...useEditorStore.getState() },
        size: { width: 800, height: 600 },
      }),
      { wrapper: ShortcutProvider }
    );

    act(() => {
      result.current.textareaProps.onCompositionStart?.();
      result.current.textareaProps.onCompositionEnd?.({
        data: "你",
        currentTarget: { value: "你" },
      } as never);
      result.current.textareaProps.onKeyDown?.({
        defaultPrevented: false,
        key: "Unidentified",
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: false,
      } as never);
      result.current.textareaProps.onInput?.({
        currentTarget: { value: "你" },
        nativeEvent: {
          data: "你",
          isComposing: false,
          inputType: "insertText",
        },
      } as never);
    });

    expect(useEditorStore.getState().grid).toEqual(new Map([
      ["2,1", { char: "你", color: "#000000" }],
      ["4,1", { char: "你", color: "#000000" }],
    ]));
    expect(useEditorStore.getState().textCursor).toEqual({ x: 6, y: 1 });
  });
});
