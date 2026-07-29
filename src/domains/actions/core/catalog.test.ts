import { describe, expect, it } from "vitest";
import { HOST_ICONOLOGY } from "@/shared/icons/iconology";
import { ACTION_CATALOG, STRUCTURED_CONTEXT_MENU } from "./catalog";

describe("action catalog iconology", () => {
  it("consumes the semantic editor action icons", () => {
    expect(ACTION_CATALOG.paste.icon).toBe(
      HOST_ICONOLOGY.editorAction.paste
    );
    expect(ACTION_CATALOG["copy-ansi"].icon).toBe(
      HOST_ICONOLOGY.editorAction["copy-ansi"]
    );
    expect(ACTION_CATALOG["structured-bring-forward"].icon).not.toBe(
      ACTION_CATALOG["structured-bring-to-front"].icon
    );
    expect(ACTION_CATALOG["structured-send-backward"].icon).not.toBe(
      ACTION_CATALOG["structured-send-to-back"].icon
    );
  });

  it("uses the semantic layer menu icon", () => {
    const layerMenu = STRUCTURED_CONTEXT_MENU.find(
      (entry) => entry.type === "submenu" && entry.label === "Layer"
    );
    expect(layerMenu?.type).toBe("submenu");
    if (!layerMenu || layerMenu.type !== "submenu") return;
    expect(layerMenu.icon).toBe(
      HOST_ICONOLOGY.editorAction["structured-layer-menu"]
    );
  });
});
