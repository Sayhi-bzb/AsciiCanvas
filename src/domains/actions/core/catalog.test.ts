import { describe, expect, it } from "vitest";
import {
  LayerArrowDown,
  LayerArrowUp,
  LayersArrowDown,
  LayersArrowUp,
} from "lucide-react";
import { HOST_ICONOLOGY } from "@/shared/icons/iconology";
import { EDITOR_COMMAND_META, STRUCTURED_CONTEXT_MENU } from "./catalog";

describe("action catalog iconology", () => {
  it("defines memorable, non-conflicting text-formatting shortcuts", () => {
    expect(EDITOR_COMMAND_META["format-bold"].shortcuts).toEqual([["mod", "b"]]);
    expect(EDITOR_COMMAND_META["format-italic"].shortcuts).toEqual([["mod", "i"]]);
    expect(EDITOR_COMMAND_META["format-underline"].shortcuts).toEqual([["mod", "u"]]);
    expect(EDITOR_COMMAND_META["format-strike"].shortcuts).toEqual([
      ["mod", "shift", "x"],
    ]);
    expect(EDITOR_COMMAND_META["format-inverse"].shortcuts).toEqual(["mod+k i"]);
  });

  it("consumes the semantic editor action icons", () => {
    expect(EDITOR_COMMAND_META.paste.icon).toBe(
      HOST_ICONOLOGY.editorAction.paste
    );
    expect(EDITOR_COMMAND_META["copy-ansi"].icon).toBe(
      HOST_ICONOLOGY.editorAction["copy-ansi"]
    );
    expect(EDITOR_COMMAND_META["structured-bring-forward"].icon).toBe(
      LayerArrowUp
    );
    expect(EDITOR_COMMAND_META["structured-send-backward"].icon).toBe(
      LayerArrowDown
    );
    expect(EDITOR_COMMAND_META["structured-bring-to-front"].icon).toBe(
      LayersArrowUp
    );
    expect(EDITOR_COMMAND_META["structured-send-to-back"].icon).toBe(
      LayersArrowDown
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
