import { describe, expect, it } from "vitest";
import { HOST_ICONOLOGY } from "@/shared/icons/iconology";
import { EDITOR_COMMAND_META, STRUCTURED_CONTEXT_MENU } from "./catalog";

describe("action catalog iconology", () => {
  it("consumes the semantic editor action icons", () => {
    expect(EDITOR_COMMAND_META.paste.icon).toBe(
      HOST_ICONOLOGY.editorAction.paste
    );
    expect(EDITOR_COMMAND_META["copy-ansi"].icon).toBe(
      HOST_ICONOLOGY.editorAction["copy-ansi"]
    );
    expect(EDITOR_COMMAND_META["structured-bring-forward"].icon).not.toBe(
      EDITOR_COMMAND_META["structured-bring-to-front"].icon
    );
    expect(EDITOR_COMMAND_META["structured-send-backward"].icon).not.toBe(
      EDITOR_COMMAND_META["structured-send-to-back"].icon
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
