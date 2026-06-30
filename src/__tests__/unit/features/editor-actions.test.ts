import { describe, expect, it, vi, afterEach } from "vitest";
import * as editorCommands from "@/domains/actions/adapters/editorCommands";
import { STRUCTURED_CONTEXT_MENU } from "@/domains/actions/core";
import { editorCheckers, editorHandlers } from "@/domains/actions/core/handlers/editor";
import { useCanvasStore } from "@/domains/canvas/state/canvasStore";

describe("editorHandlers clipboard sources", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("forwards clipboard-event source to runEditorCommand", () => {
    const runEditorCommandSpy = vi
      .spyOn(editorCommands, "runEditorCommand")
      .mockReturnValue(true);

    const managedTextarea = document.createElement("textarea");
    const clipboardEvent = {
      clipboardData: null,
    } as unknown as ClipboardEvent;

    const result = editorHandlers.paste(
      {
        source: "clipboard-event",
        clipboardEvent,
        managedTextarea,
      },
      {
        state: useCanvasStore.getState(),
        setTool: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
      }
    );

    expect(result.succeeded).toBe(true);
    expect(runEditorCommandSpy).toHaveBeenCalledWith(
      "paste",
      expect.objectContaining({
        source: "clipboard-event",
        clipboardEvent,
        managedTextarea,
      })
    );
  });

  it("forwards copy-ansi to runEditorCommand without a shortcut path", () => {
    const runEditorCommandSpy = vi
      .spyOn(editorCommands, "runEditorCommand")
      .mockReturnValue(true);

    const state = {
      ...useCanvasStore.getState(),
      canvasMode: "freeform" as const,
      canCopyOrCut: () => true,
    };

    const result = editorHandlers["copy-ansi"](
      {
        source: "context-menu",
      },
      {
        state,
        setTool: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
      }
    );

    expect(result.succeeded).toBe(true);
    expect(runEditorCommandSpy).toHaveBeenCalledWith(
      "copy-ansi",
      expect.objectContaining({
        source: "context-menu",
      })
    );
  });

  it("disables copy-ansi in structured mode", () => {
    const result = editorHandlers["copy-ansi"](
      { source: "context-menu" },
      {
        state: {
          ...useCanvasStore.getState(),
          canvasMode: "structured" as const,
          canCopyOrCut: () => true,
        },
        setTool: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
      }
    );

    expect(result.succeeded).toBe(false);
    expect(result.reason).toBe("not-supported-in-structured");
  });
});

describe("editorHandlers structured rename", () => {
  const baseState = useCanvasStore.getState();

  it("puts the cursor at the selected box name end", () => {
    const setTextCursor = vi.fn();
    const state = {
      ...baseState,
      canvasMode: "structured" as const,
      selectedStructuredBoxId: "box-1",
      selectedStructuredNodeIds: ["box-1"],
      setTextCursor,
      structuredScene: [
        {
          id: "box-1",
          type: "box" as const,
          order: 1,
          start: { x: 2, y: 3 },
          end: { x: 10, y: 7 },
          name: "API",
          style: { color: "#ffffff" },
        },
      ],
    };

    const result = editorHandlers["structured-rename"](
      { source: "context-menu" },
      {
        state,
        setTool: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
      }
    );

    expect(result.succeeded).toBe(true);
    expect(setTextCursor).toHaveBeenCalledWith({ x: 8, y: 3 });
  });

  it("fails when the selected structured node is a line", () => {
    const state = {
      ...baseState,
      canvasMode: "structured" as const,
      selectedStructuredBoxId: null,
      selectedStructuredNodeIds: ["line-1"],
      structuredScene: [
        {
          id: "line-1",
          type: "line" as const,
          order: 1,
          start: { x: 0, y: 0 },
          end: { x: 4, y: 0 },
          axis: "horizontal" as const,
          style: { color: "#ffffff" },
        },
      ],
    };

    const result = editorHandlers["structured-rename"](
      { source: "context-menu" },
      {
        state,
        setTool: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
      }
    );

    expect(result.succeeded).toBe(false);
    expect(editorCheckers["structured-rename"]?.(state)).toBe(false);
  });

  it("puts the cursor at the selected text end", () => {
    const setTextCursor = vi.fn();
    const state = {
      ...baseState,
      canvasMode: "structured" as const,
      selectedStructuredBoxId: null,
      selectedStructuredNodeIds: ["text-1"],
      setTextCursor,
      structuredScene: [
        {
          id: "text-1",
          type: "text" as const,
          order: 1,
          position: { x: 4, y: 5 },
          text: "接口",
          style: { color: "#ffffff" },
        },
      ],
    };

    const result = editorHandlers["structured-rename"](
      { source: "context-menu" },
      {
        state,
        setTool: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
      }
    );

    expect(result.succeeded).toBe(true);
    expect(setTextCursor).toHaveBeenCalledWith({ x: 8, y: 5 });
    expect(editorCheckers["structured-rename"]?.(state)).toBe(true);
  });
  it("is disabled for boxes too narrow to hold a name", () => {
    const state = {
      ...baseState,
      canvasMode: "structured" as const,
      selectedStructuredBoxId: "box-1",
      selectedStructuredNodeIds: ["box-1"],
      structuredScene: [
        {
          id: "box-1",
          type: "box" as const,
          order: 1,
          start: { x: 0, y: 0 },
          end: { x: 3, y: 2 },
          style: { color: "#ffffff" },
        },
      ],
    };

    expect(editorCheckers["structured-rename"]?.(state)).toBe(false);
  });

  it("shows Rename at the top of the structured context menu", () => {
    expect(STRUCTURED_CONTEXT_MENU[0]).toEqual({
      type: "action",
      id: "structured-rename",
    });
  });
});

