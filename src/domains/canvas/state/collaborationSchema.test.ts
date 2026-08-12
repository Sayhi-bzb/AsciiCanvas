import { describe, expect, it } from "vitest";
import {
  CANVAS_COLLABORATION_CHANNELS,
  decodeCollaborativeGridCell,
  decodeCollaborativeStructuredComponent,
  decodeCollaborativeStructuredNode,
} from "./collaborationSchema";
import { rebuildGridFromYMap, rebuildSceneFromYMap } from "./helpers/gridHelpers";
import { CanvasDocumentRegistry } from "./CanvasDocumentRegistry";

describe("canvas collaboration schema", () => {
  it("declares durable document channels separately from presence", () => {
    expect(CANVAS_COLLABORATION_CHANNELS.grid.scope).toBe("document");
    expect(CANVAS_COLLABORATION_CHANNELS.scene.scope).toBe("document");
    expect(CANVAS_COLLABORATION_CHANNELS.presence.scope).toBe("presence");
  });

  it("decodes valid grid cells and rejects invalid values", () => {
    expect(decodeCollaborativeGridCell("0,0", { char: "A", color: "#fff" })).toEqual({
      ok: true,
      value: { char: "A", color: "#fff" },
    });
    expect(decodeCollaborativeGridCell("0,0", { char: 1 })).toMatchObject({
      ok: false,
      issue: { channel: "main-grid", key: "0,0" },
    });
    expect(decodeCollaborativeGridCell("not-a-point", { char: "A", color: "#fff" })).toMatchObject({
      ok: false,
      issue: { reason: "Invalid grid coordinate key" },
    });
  });

  it("rejects structured records whose id does not match their Y.Map key", () => {
    expect(
      decodeCollaborativeStructuredNode("node-a", {
        id: "node-b",
        type: "text",
        order: 1,
        position: { x: 0, y: 0 },
        text: "hello",
        style: { color: "#fff" },
      })
    ).toMatchObject({ ok: false, issue: { channel: "structured-scene", key: "node-a" } });
  });

  it("clones valid component collections and rejects malformed roles", () => {
    const source = {
      id: "component-a",
      templateId: "card",
      label: "Card",
      atomIds: ["node-a"],
      roles: { title: ["node-a"] },
    };
    const result = decodeCollaborativeStructuredComponent("component-a", source);
    expect(result).toEqual({ ok: true, value: source });
    expect(result.ok && result.value).not.toBe(source);
    expect(
      decodeCollaborativeStructuredComponent("component-a", { ...source, roles: { title: [1] } })
    ).toMatchObject({ ok: false });
  });

  it("keeps invalid remote records out of the editor projection", () => {
    const id = `invalid-collaboration-${crypto.randomUUID()}`;
    const documents = new CanvasDocumentRegistry(id);
    documents.yMainGrid.set("bad-key", { char: "A", color: "#fff" });
    documents.yStructuredScene.set("node-a", { id: "node-b" } as never);

    expect(rebuildGridFromYMap(documents)).toEqual(new Map());
    expect(rebuildSceneFromYMap(documents)).toEqual([]);
    expect(documents.getIntegrityIssues()).toEqual([
      { channel: "main-grid", key: "bad-key", reason: "Invalid grid coordinate key" },
      { channel: "structured-scene", key: "node-a", reason: "Invalid structured node" },
    ]);
    documents.dispose();
  });
});
