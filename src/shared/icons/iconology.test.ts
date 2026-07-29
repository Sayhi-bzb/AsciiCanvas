import { describe, expect, it } from "vitest";
import {
  Bold,
  BringToFront,
  Camera,
  ChevronDown,
  CaseSensitive,
  ClipboardPaste,
  Code2,
  Component,
  Film,
  Grid2X2,
  Menu,
  MoveDown,
  Play,
  Square,
  MoveUp,
  Omega,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Palette,
  PanelsTopLeft,
  SendToBack,
  Smile,
} from "lucide-react";
import {
  HOST_ICONOLOGY,
  getSidebarToggleIcon,
} from "@/shared/icons/iconology";

describe("Host iconology", () => {
  it("uses literal content icons for Sidebar views and canvas modes", () => {
    expect(HOST_ICONOLOGY.characterView.essentials).toBe(CaseSensitive);
    expect(HOST_ICONOLOGY.characterView.emoji).toBe(Smile);
    expect(HOST_ICONOLOGY.characterView.unicode).toBe(Omega);
    expect(HOST_ICONOLOGY.structuredView.components).toBe(Component);
    expect(HOST_ICONOLOGY.canvasMode.structured).toBe(PanelsTopLeft);
  });

  it("uses verb-specific icons for editor and animation actions", () => {
    expect(HOST_ICONOLOGY.editorAction.paste).toBe(ClipboardPaste);
    expect(HOST_ICONOLOGY.editorAction["snapshot-png"]).toBe(Camera);
    expect(HOST_ICONOLOGY.editorAction["copy-ansi"]).toBe(Code2);
    expect(HOST_ICONOLOGY.animationAction["generate-frames"]).toBe(Film);
    expect(HOST_ICONOLOGY.editorAction["structured-bring-forward"]).toBe(
      MoveUp
    );
    expect(HOST_ICONOLOGY.editorAction["structured-send-backward"]).toBe(
      MoveDown
    );
    expect(HOST_ICONOLOGY.editorAction["structured-bring-to-front"]).toBe(
      BringToFront
    );
    expect(HOST_ICONOLOGY.editorAction["structured-send-to-back"]).toBe(
      SendToBack
    );
  });

  it("centralizes core host controls and affordances", () => {
    expect(HOST_ICONOLOGY.selectionAction.bold).toBe(Bold);
    expect(HOST_ICONOLOGY.colorPalette.ansi16).toBe(Grid2X2);
    expect(HOST_ICONOLOGY.colorPalette.presets).toBe(Palette);
    expect(HOST_ICONOLOGY.shapeTool.box).toBe(Square);
    expect(HOST_ICONOLOGY.animationAction.play).toBe(Play);
    expect(HOST_ICONOLOGY.appMenu.trigger).toBe(Menu);
    expect(HOST_ICONOLOGY.sessionAction.expand).toBe(ChevronDown);
    expect(HOST_ICONOLOGY.chrome["toolbar-submenu"]).toBe(ChevronDown);
  });

  it("resolves panel toggles from both side and state", () => {
    expect(getSidebarToggleIcon("left", true)).toBe(PanelLeftClose);
    expect(getSidebarToggleIcon("left", false)).toBe(PanelLeftOpen);
    expect(getSidebarToggleIcon("right", true)).toBe(PanelRightClose);
    expect(getSidebarToggleIcon("right", false)).toBe(PanelRightOpen);
  });
});
