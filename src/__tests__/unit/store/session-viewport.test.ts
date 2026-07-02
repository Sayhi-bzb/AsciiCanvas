import { afterEach, describe, expect, it } from "vitest";
import { useCanvasStore } from "@/domains/canvas/state/canvasStore";
import { applyFreeformSnapshotToYMaps } from "@/domains/canvas/state/helpers/gridHelpers";
import { DEFAULT_SESSION_ID } from "@/domains/canvas/state/helpers/storeUtils";

const initialState = useCanvasStore.getState();

const createClipboardEventCapture = () => {
  const data = new Map<string, string>();
  return {
    data,
    event: {
      preventDefault: () => {},
      clipboardData: {
        setData: (type: string, value: string) => data.set(type, value),
      },
    } as unknown as ClipboardEvent,
  };
};

const dataTransferFromCapture = (data: Map<string, string>) =>
  ({
    getData: (type: string) => data.get(type) ?? "",
  }) as unknown as DataTransfer;

describe("canvas session viewport state", () => {
  afterEach(() => {
    useCanvasStore.setState(
      {
        ...initialState,
        offset: { x: 0, y: 0 },
        zoom: 1,
        activeCanvasHasSavedViewport: false,
        grid: new Map(),
        canvasSessions: initialState.canvasSessions.map((session) =>
          session.id === DEFAULT_SESSION_ID
            ? { ...session, grid: [], viewport: undefined }
            : session
        ),
      },
      true
    );
    applyFreeformSnapshotToYMaps([]);
  });

  it("saves and restores offset and zoom per canvas session", () => {
    const store = useCanvasStore.getState();
    store.setOffset(() => ({ x: 10, y: 20 }));
    store.setZoom(() => 2);

    store.createCanvasSession("freeform");
    const secondCanvasId = useCanvasStore.getState().activeCanvasId;

    expect(useCanvasStore.getState().offset).toEqual({ x: 0, y: 0 });
    expect(useCanvasStore.getState().zoom).toBe(1);
    expect(useCanvasStore.getState().activeCanvasHasSavedViewport).toBe(false);

    useCanvasStore.getState().setOffset(() => ({ x: 100, y: 200 }));
    useCanvasStore.getState().setZoom(() => 3);
    useCanvasStore.getState().switchCanvasSession(DEFAULT_SESSION_ID);

    expect(useCanvasStore.getState().offset).toEqual({ x: 10, y: 20 });
    expect(useCanvasStore.getState().zoom).toBe(2);
    expect(useCanvasStore.getState().activeCanvasHasSavedViewport).toBe(true);

    useCanvasStore.getState().setOffset(() => ({ x: 11, y: 22 }));
    useCanvasStore.getState().setZoom(() => 1.5);
    useCanvasStore.getState().switchCanvasSession(secondCanvasId);

    expect(useCanvasStore.getState().offset).toEqual({ x: 100, y: 200 });
    expect(useCanvasStore.getState().zoom).toBe(3);
    expect(useCanvasStore.getState().activeCanvasHasSavedViewport).toBe(true);
  });
  it("creates and activates an empty structured session", () => {
    useCanvasStore.getState().createCanvasSession("structured");

    const state = useCanvasStore.getState();
    const activeSession = state.canvasSessions.find(
      (session) => session.id === state.activeCanvasId
    );

    expect(activeSession?.mode).toBe("structured");
    expect(state.canvasMode).toBe("structured");
    expect(state.structuredScene).toEqual([]);
    expect(state.grid.size).toBe(0);
  });
  it("updates selected structured boxes through the store", () => {
    useCanvasStore.getState().createCanvasSession("structured");
    useCanvasStore.getState().applyStructuredScene(
      [
        {
          id: "box-1",
          type: "box",
          order: 1,
          start: { x: 0, y: 0 },
          end: { x: 2, y: 2 },
          style: { color: "#ffffff" },
        },
      ],
      false
    );

    useCanvasStore.getState().updateStructuredBox("box-1", (node) => ({
      ...node,
      start: { x: 3, y: 4 },
      end: { x: 5, y: 6 },
    }));

    const state = useCanvasStore.getState();
    expect(state.selectedStructuredBoxId).toBe("box-1");
    expect(state.structuredScene[0]).toMatchObject({
      start: { x: 3, y: 4 },
      end: { x: 5, y: 6 },
    });
    expect(state.grid.size).toBeGreaterThan(0);
  });
  it("deletes selected structured nodes", () => {
    useCanvasStore.getState().createCanvasSession("structured");
    useCanvasStore.getState().applyStructuredScene(
      [
        {
          id: "box-1",
          type: "box",
          order: 1,
          start: { x: 0, y: 0 },
          end: { x: 2, y: 2 },
          style: { color: "#ffffff" },
        },
        {
          id: "line-1",
          type: "line",
          order: 2,
          start: { x: 4, y: 0 },
          end: { x: 8, y: 0 },
          axis: "horizontal",
          style: { color: "#ffffff" },
        },
      ],
      false
    );

    useCanvasStore.getState().setSelectedStructuredNodeIds(["box-1", "line-1"]);
    useCanvasStore.getState().deleteSelection();

    const state = useCanvasStore.getState();
    expect(state.structuredScene).toEqual([]);
    expect(state.selectedStructuredNodeIds).toEqual([]);
    expect(state.selectedStructuredBoxId).toBeNull();
  });

  it("tracks structured grid focus independently from structured node selection", () => {
    useCanvasStore.getState().createCanvasSession("structured");

    useCanvasStore.getState().setStructuredGridFocus({ x: 4, y: 5 });
    expect(useCanvasStore.getState().structuredGridFocus).toEqual({ x: 4, y: 5 });
    expect(useCanvasStore.getState().textCursor).toBeNull();

    useCanvasStore.getState().moveStructuredGridFocus(2, -3);
    expect(useCanvasStore.getState().structuredGridFocus).toEqual({ x: 6, y: 2 });

    useCanvasStore.getState().clearInteractionState();
    expect(useCanvasStore.getState().structuredGridFocus).toBeNull();
  });

  it("reorders and duplicates selected structured nodes through the store", () => {
    useCanvasStore.getState().createCanvasSession("structured");
    useCanvasStore.getState().applyStructuredScene(
      [
        {
          id: "box-1",
          type: "box",
          order: 1,
          start: { x: 0, y: 0 },
          end: { x: 2, y: 2 },
          style: { color: "#ffffff" },
        },
        {
          id: "line-1",
          type: "line",
          order: 2,
          start: { x: 4, y: 0 },
          end: { x: 8, y: 0 },
          axis: "horizontal",
          style: { color: "#ffffff" },
        },
      ],
      false
    );

    useCanvasStore.getState().setSelectedStructuredNodeIds(["box-1"]);
    useCanvasStore.getState().reorderStructuredSelection("front");

    expect(
      [...useCanvasStore.getState().structuredScene]
        .sort((a, b) => a.order - b.order)
        .map((node) => node.id)
    ).toEqual(["line-1", "box-1"]);

    const duplicatedIds = useCanvasStore.getState().duplicateStructuredSelection();
    const state = useCanvasStore.getState();
    expect(duplicatedIds).toHaveLength(1);
    expect(state.selectedStructuredNodeIds).toEqual(duplicatedIds);
    expect(state.structuredScene).toHaveLength(3);
    expect(state.structuredScene.find((node) => node.id === duplicatedIds[0])).toMatchObject({
      type: "box",
      start: { x: 1, y: 1 },
      end: { x: 3, y: 3 },
    });
  });

  it("copies structured nodes and pastes them back as structured elements", async () => {
    useCanvasStore.getState().createCanvasSession("structured");
    useCanvasStore.getState().applyStructuredScene(
      [
        {
          id: "box-1",
          type: "box",
          order: 1,
          start: { x: 2, y: 3 },
          end: { x: 6, y: 5 },
          style: { color: "#ffffff" },
        },
        {
          id: "text-1",
          type: "text",
          order: 2,
          position: { x: 3, y: 4 },
          text: "Hi",
          style: { color: "#000000" },
        },
      ],
      false
    );
    useCanvasStore.getState().setSelectedStructuredNodeIds(["box-1", "text-1"]);
    const capture = createClipboardEventCapture();

    await useCanvasStore.getState().copySelection({ event: capture.event });
    useCanvasStore.getState().setTextCursor({ x: 10, y: 10 });
    useCanvasStore.getState().setStructuredGridFocus({ x: 12, y: 8 });
    await useCanvasStore.getState().pasteFromClipboard({
      eventDataTransfer: dataTransferFromCapture(capture.data),
    });

    const state = useCanvasStore.getState();
    expect(state.structuredScene).toHaveLength(4);
    const pasted = state.structuredScene.filter((node) =>
      state.selectedStructuredNodeIds.includes(node.id)
    );
    expect(pasted.map((node) => node.type)).toEqual(["box", "text"]);
    expect(pasted[0]).toMatchObject({
      type: "box",
      start: { x: 12, y: 8 },
      end: { x: 16, y: 10 },
    });
    expect(pasted[1]).toMatchObject({
      type: "text",
      position: { x: 13, y: 9 },
      text: "Hi",
    });
    expect(state.structuredGridFocus).toBeNull();
    expect(pasted.map((node) => node.id)).not.toContain("box-1");
    expect(pasted.map((node) => node.id)).not.toContain("text-1");
  });

  it("pastes structured clipboard content into freeform as surface cells", async () => {
    useCanvasStore.getState().createCanvasSession("structured");
    useCanvasStore.getState().applyStructuredScene(
      [
        {
          id: "box-1",
          type: "box",
          order: 1,
          start: { x: 2, y: 3 },
          end: { x: 6, y: 5 },
          style: { color: "#111111" },
        },
        {
          id: "text-1",
          type: "text",
          order: 2,
          position: { x: 3, y: 4 },
          text: "Hi",
          style: { color: "#ffffff" },
        },
      ],
      false
    );
    useCanvasStore.getState().setSelectedStructuredNodeIds(["box-1"]);
    const capture = createClipboardEventCapture();

    await useCanvasStore.getState().copySelection({ event: capture.event });
    useCanvasStore.getState().createCanvasSession("freeform");
    useCanvasStore.getState().setTextCursor({ x: 0, y: 0 });
    await useCanvasStore.getState().pasteFromClipboard({
      eventDataTransfer: dataTransferFromCapture(capture.data),
    });

    const state = useCanvasStore.getState();
    expect(state.canvasMode).toBe("freeform");
    expect(state.structuredScene).toEqual([]);
    expect(state.grid.get("0,0")).toMatchObject({
      char: "╭",
      color: "#111111",
    });
    expect(state.grid.get("1,1")).toMatchObject({
      char: "H",
      color: "#ffffff",
    });
    expect(state.grid.get("2,1")).toMatchObject({
      char: "i",
      color: "#ffffff",
    });
  });

  it("creates structured background blocks with the brush color as fill", () => {
    useCanvasStore.getState().createCanvasSession("structured");
    useCanvasStore.setState({ brushColor: "#334155" });

    useCanvasStore
      .getState()
      .commitStructuredShape("bg", { x: 1, y: 2 }, { x: 3, y: 4 });

    const state = useCanvasStore.getState();
    expect(state.structuredScene[0]).toMatchObject({
      type: "bg",
      start: { x: 1, y: 2 },
      end: { x: 3, y: 4 },
      style: { color: "#000000", bgColor: "#334155" },
    });
    expect(state.selectedStructuredNodeIds).toEqual([state.structuredScene[0].id]);
    expect(state.grid.get("1,2")).toEqual({
      char: " ",
      color: "#000000",
      bgColor: "#334155",
    });
    expect(state.grid.get("3,4")).toEqual({
      char: " ",
      color: "#000000",
      bgColor: "#334155",
    });
  });

  it("creates split boxes as structured shape nodes", () => {
    useCanvasStore.getState().createCanvasSession("structured");
    useCanvasStore.setState({ brushColor: "#334155" });

    useCanvasStore
      .getState()
      .commitStructuredShape("splitBox", { x: 0, y: 0 }, { x: 10, y: 4 });

    const state = useCanvasStore.getState();
    expect(state.structuredScene[0]).toMatchObject({
      type: "splitBox",
      start: { x: 0, y: 0 },
      end: { x: 10, y: 4 },
      verticalSplitRatio: 0.36,
      topSplitRatio: 0.25,
      bottomSplitRatio: 0.75,
      style: { color: "#334155" },
    });
    expect(state.selectedStructuredNodeIds).toEqual([state.structuredScene[0].id]);
    expect(state.grid.get("0,0")).toMatchObject({ char: "╭", color: "#334155" });
    expect(state.grid.get("4,1")).toMatchObject({ char: "┬", color: "#334155" });
    expect(state.grid.get("4,3")).toMatchObject({ char: "┴", color: "#334155" });
  });

  it("fills freeform background rectangles without erasing existing cells", () => {
    useCanvasStore.setState({
      canvasMode: "freeform",
      brushColor: "#334155",
    });
    applyFreeformSnapshotToYMaps([
      ["1,1", { char: "A", color: "#ffffff", attrs: { bold: true } }],
    ]);

    useCanvasStore
      .getState()
      .updateScratchForShape("bg", { x: 0, y: 0 }, { x: 1, y: 1 });
    useCanvasStore.getState().commitScratch();

    const grid = useCanvasStore.getState().grid;
    expect(grid.get("0,0")).toEqual({
      char: " ",
      color: "#000000",
      bgColor: "#334155",
    });
    expect(grid.get("1,1")).toEqual({
      char: "A",
      color: "#ffffff",
      bgColor: "#334155",
      attrs: { bold: true },
    });
  });

  it("formats selected structured text ranges", () => {
    useCanvasStore.getState().createCanvasSession("structured");
    useCanvasStore.getState().applyStructuredScene(
      [
        {
          id: "text-1",
          type: "text",
          order: 1,
          position: { x: 1, y: 2 },
          text: "Label",
          style: { color: "#ffffff" },
        },
        {
          id: "text-2",
          type: "text",
          order: 2,
          position: { x: 1, y: 4 },
          text: "Value",
          style: { color: "#ffffff", attrs: { italic: true } },
        },
      ],
      false
    );

    useCanvasStore.getState().setSelectedStructuredNodeIds(["text-1"]);
    useCanvasStore.getState().setEditingStructuredTextNodeId("text-1");
    useCanvasStore
      .getState()
      .setStructuredTextSelection({ nodeId: "text-1", anchor: 1, focus: 4 });
    useCanvasStore.getState().setStructuredTextAttributes({
      bold: true,
      italic: false,
      underline: true,
    });
    useCanvasStore.getState().setStructuredTextBackgroundColor("#123456");

    expect(useCanvasStore.getState().structuredScene).toMatchObject([
      {
        id: "text-1",
        styleRanges: [
          {
            start: 1,
            end: 4,
            style: {
              bgColor: "#123456",
              attrs: { bold: true, underline: true },
            },
          },
        ],
      },
      {
        id: "text-2",
        style: { color: "#ffffff", attrs: { italic: true } },
      },
    ]);

    useCanvasStore.getState().setStructuredTextAttributes({
      bold: false,
      underline: false,
    });
    useCanvasStore.getState().setStructuredTextBackgroundColor(null);

    expect(useCanvasStore.getState().structuredScene[0]).toMatchObject({
      id: "text-1",
      style: { color: "#ffffff" },
    });
    const formattedNode = useCanvasStore.getState().structuredScene[0];
    expect(formattedNode.type).toBe("text");
    if (formattedNode.type === "text") {
      expect(formattedNode.styleRanges).toBeUndefined();
    }
  });

  it("colors selected structured text ranges without changing text content", () => {
    useCanvasStore.getState().createCanvasSession("structured");
    useCanvasStore.getState().applyStructuredScene(
      [
        {
          id: "text-1",
          type: "text",
          order: 1,
          position: { x: 1, y: 2 },
          text: "Label",
          style: { color: "#ffffff" },
          styleRanges: [
            {
              start: 1,
              end: 4,
              style: { attrs: { bold: true }, bgColor: "#111111" },
            },
          ],
        },
      ],
      false
    );

    useCanvasStore.getState().setStructuredTextSelection({
      nodeId: "text-1",
      anchor: 1,
      focus: 4,
    });
    useCanvasStore.getState().setStructuredTextColor("#ef4444");
    useCanvasStore.getState().setStructuredTextColor("#22c55e");

    expect(useCanvasStore.getState().structuredScene[0]).toMatchObject({
      id: "text-1",
      text: "Label",
      styleRanges: [
        {
          start: 1,
          end: 4,
          style: {
            color: "#22c55e",
            bgColor: "#111111",
            attrs: { bold: true },
          },
        },
      ],
    });
  });

  it("does not format mixed structured selections", () => {
    useCanvasStore.getState().createCanvasSession("structured");
    useCanvasStore.getState().applyStructuredScene(
      [
        {
          id: "text-1",
          type: "text",
          order: 1,
          position: { x: 1, y: 2 },
          text: "Label",
          style: { color: "#ffffff" },
        },
        {
          id: "box-1",
          type: "box",
          order: 2,
          start: { x: 0, y: 0 },
          end: { x: 4, y: 4 },
          style: { color: "#ffffff" },
        },
      ],
      false
    );

    useCanvasStore.getState().setSelectedStructuredNodeIds(["text-1", "box-1"]);
    useCanvasStore.getState().setStructuredTextAttributes({ bold: true });
    useCanvasStore.getState().setStructuredTextBackgroundColor("#123456");

    expect(useCanvasStore.getState().structuredScene[0]).toMatchObject({
      id: "text-1",
      style: { color: "#ffffff" },
    });
    expect(useCanvasStore.getState().structuredScene[0].style.attrs).toBeUndefined();
    expect(useCanvasStore.getState().structuredScene[0].style.bgColor).toBeUndefined();
  });

  it("fills selected structured text ranges with the brush character", () => {
    useCanvasStore.getState().createCanvasSession("structured");
    useCanvasStore.getState().applyStructuredScene(
      [
        {
          id: "text-1",
          type: "text",
          order: 1,
          position: { x: 1, y: 2 },
          text: "Label",
          style: { color: "#ffffff" },
          styleRanges: [
            {
              start: 1,
              end: 4,
              style: { attrs: { bold: true } },
            },
          ],
        },
      ],
      false
    );

    useCanvasStore.getState().setStructuredTextSelection({
      nodeId: "text-1",
      anchor: 1,
      focus: 4,
    });
    useCanvasStore.getState().fillStructuredTextSelectionWithChar("#");

    expect(useCanvasStore.getState().structuredScene[0]).toMatchObject({
      id: "text-1",
      text: "L###l",
      styleRanges: [
        {
          start: 1,
          end: 4,
          style: { attrs: { bold: true } },
        },
      ],
    });
  });

  it("allows freeform bg fill but falls back from unsupported tools per session mode", () => {
    useCanvasStore.getState().createCanvasSession("structured");
    const structuredSessionId = useCanvasStore.getState().activeCanvasId;

    useCanvasStore.getState().setTool("text");
    expect(useCanvasStore.getState().tool).toBe("text");
    useCanvasStore.getState().setTool("bg");
    expect(useCanvasStore.getState().tool).toBe("bg");

    useCanvasStore.getState().createCanvasSession("freeform");
    expect(useCanvasStore.getState().canvasMode).toBe("freeform");
    expect(useCanvasStore.getState().tool).toBe("bg");

    useCanvasStore.getState().createCanvasSession("animation");
    expect(useCanvasStore.getState().canvasMode).toBe("animation");
    expect(useCanvasStore.getState().tool).toBe("brush");

    useCanvasStore.getState().switchCanvasSession(structuredSessionId);
    expect(useCanvasStore.getState().canvasMode).toBe("structured");
    expect(useCanvasStore.getState().tool).toBe("select");
  });
});
