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
});
