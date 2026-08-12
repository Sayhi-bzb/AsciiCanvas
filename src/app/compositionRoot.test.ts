import { afterEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  createApplicationEditorHost,
  type ApplicationEditorHost,
} from "./compositionRoot";

const hosts: ApplicationEditorHost[] = [];
const createHost = () => {
  const host = createApplicationEditorHost();
  hosts.push(host);
  return host;
};

afterEach(async () => {
  await Promise.all(hosts.splice(0).map((host) => host.dispose()));
});

describe("ApplicationEditorHost", () => {
  it("isolates canvas state, history, commands, and editor tools by instance", () => {
    const first = createHost();
    const second = createHost();
    first.canvas.commands.grid.replace([]);
    second.canvas.commands.grid.replace([]);

    first.canvas.commands.interaction.setTextCursor({ x: 0, y: 0 });
    first.canvas.commands.text.write("A");
    first.editor.setCurrentTool("brush");

    expect(first.canvas.getState().grid.get("0,0")?.char).toBe("A");
    expect(first.canvas.getState().canUndo).toBe(true);
    expect(first.editor.getCurrentToolId()).toBe("brush");
    expect(second.canvas.getState().grid).toEqual(new Map());
    expect(second.canvas.getState().canUndo).toBe(false);
    expect(second.editor.getCurrentToolId()).toBe("select");

    expect(first.canvas.commands.history.undo()).toBe(true);
    expect(first.canvas.getState().grid).toEqual(new Map());
    expect(second.canvas.getState().grid).toEqual(new Map());
  });

  it("preserves remote Yjs content when the same instance edits next", () => {
    const host = createHost();
    host.canvas.commands.grid.replace([]);
    const documentId = host.canvas.queries.getActiveDocumentId();
    const local = host.canvas.queries.getCollaborationDocument(documentId)!;
    const remote = new Y.Doc();
    Y.applyUpdate(remote, Y.encodeStateAsUpdate(local));
    remote.getMap("main-grid").set("0,0", {
      char: "R",
      color: "#ffffff",
    });

    Y.applyUpdate(local, Y.encodeStateAsUpdate(remote));
    host.canvas.commands.interaction.setTextCursor({ x: 1, y: 0 });
    host.canvas.commands.text.write("L");

    expect(Object.fromEntries(host.canvas.getState().grid)).toMatchObject({
      "0,0": { char: "R", color: "#ffffff" },
      "1,0": { char: "L" },
    });
  });

  it("rejects an empty persistence namespace", () => {
    expect(() =>
      createApplicationEditorHost({
        canvasPersistence: { storage: localStorage, key: "" },
      })
    ).toThrow("Canvas persistence requires a non-empty instance key");
  });
});
