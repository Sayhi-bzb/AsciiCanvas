import { createElement } from "react";
import {
  BringToFront,
  Camera,
  CaseSensitive,
  Clapperboard,
  ClipboardPaste,
  Code2,
  Component,
  Copy,
  CopyPlus,
  Eraser,
  Film,
  Hand,
  Highlighter,
  LayoutTemplate,
  Layers,
  LineSquiggle,
  MousePointer2,
  MoveDown,
  MoveUp,
  Omega,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  PaintbrushVertical,
  PanelsTopLeft,
  Pencil,
  Scissors,
  SendToBack,
  Smile,
  SquarePen,
  SquareSplitHorizontal,
  SquareSplitVertical,
  Terminal,
  Trash2,
  Type,
  Undo2,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

type IconMap<Key extends string> = Record<Key, LucideIcon>;

export const HOST_ICONOLOGY = {
  canvasMode: {
    freeform: Pencil,
    structured: PanelsTopLeft,
    animation: Clapperboard,
  } satisfies IconMap<"freeform" | "structured" | "animation">,
  characterView: {
    essentials: CaseSensitive,
    nerd: Terminal,
    emoji: Smile,
    unicode: Omega,
  } satisfies IconMap<"essentials" | "nerd" | "emoji" | "unicode">,
  structuredView: {
    template: LayoutTemplate,
    components: Component,
  } satisfies IconMap<"template" | "components">,
  editorAction: {
    copy: Copy,
    "copy-rich": Palette,
    "copy-ansi": Code2,
    cut: Scissors,
    paste: ClipboardPaste,
    "snapshot-png": Camera,
    "delete-selection": Trash2,
    "structured-rename": SquarePen,
    "structured-bring-forward": MoveUp,
    "structured-send-backward": MoveDown,
    "structured-bring-to-front": BringToFront,
    "structured-send-to-back": SendToBack,
    "structured-duplicate": CopyPlus,
    "structured-copy-hierarchy": Copy,
    "structured-split-horizontal": SquareSplitVertical,
    "structured-split-vertical": SquareSplitHorizontal,
    "structured-delete-divider": Trash2,
    "structured-layer-menu": Layers,
  } satisfies IconMap<
    | "copy"
    | "copy-rich"
    | "copy-ansi"
    | "cut"
    | "paste"
    | "snapshot-png"
    | "delete-selection"
    | "structured-rename"
    | "structured-bring-forward"
    | "structured-send-backward"
    | "structured-bring-to-front"
    | "structured-send-to-back"
    | "structured-duplicate"
    | "structured-copy-hierarchy"
    | "structured-split-horizontal"
    | "structured-split-vertical"
    | "structured-delete-divider"
    | "structured-layer-menu"
  >,
  toolbarAction: {
    select: MousePointer2,
    text: Type,
    brush: Pencil,
    "shape-group": LineSquiggle,
    bg: Highlighter,
    fill: PaintbrushVertical,
    eraser: Eraser,
    undo: Undo2,
    color: Palette,
    pan: Hand,
  } satisfies IconMap<
    | "select"
    | "text"
    | "brush"
    | "shape-group"
    | "bg"
    | "fill"
    | "eraser"
    | "undo"
    | "color"
    | "pan"
  >,
  animationAction: {
    "generate-frames": Film,
  } satisfies IconMap<"generate-frames">,
  chrome: {
    "open-right-sidebar": PanelRightOpen,
  } satisfies IconMap<"open-right-sidebar">,
} as const;

export function getSidebarToggleIcon(
  side: "left" | "right",
  isOpen: boolean
): LucideIcon {
  if (side === "right") {
    return isOpen ? PanelRightClose : PanelRightOpen;
  }
  return isOpen ? PanelLeftClose : PanelLeftOpen;
}

export function SidebarToggleIcon({
  side,
  isOpen,
  ...props
}: LucideProps & {
  side: "left" | "right";
  isOpen: boolean;
}) {
  if (side === "right") {
    return isOpen
      ? createElement(PanelRightClose, props)
      : createElement(PanelRightOpen, props);
  }
  return isOpen
    ? createElement(PanelLeftClose, props)
    : createElement(PanelLeftOpen, props);
}
