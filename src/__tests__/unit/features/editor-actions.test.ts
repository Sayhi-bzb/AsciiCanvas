import { describe, expect, it, vi, afterEach } from "vitest";
import * as editorCommands from "@/domains/actions/adapters/editorCommands";
import { editorHandlers } from "@/domains/actions/core/handlers/editor";
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
