import { createElement } from "react";
import {
  Bold,
  BringToFront,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleHelp,
  Camera,
  CaseSensitive,
  Clapperboard,
  ClipboardPaste,
  Code2,
  Component,
  Copy,
  CopyPlus,
  Download,
  Eraser,
  Eye,
  EyeOff,
  Film,
  Github,
  Grid2X2,
  Italic,
  Hand,
  Highlighter,
  LayoutTemplate,
  Layers,
  Languages,
  LineSquiggle,
  Map,
  Menu,
  Minus,
  MoreHorizontal,
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
  Pause,
  Play,
  Plus,
  Repeat,
  Pencil,
  Scissors,
  SendToBack,
  Smile,
  Square,
  SquarePen,
  SquareSplitHorizontal,
  SquareSplitVertical,
  Terminal,
  Trash2,
  Type,
  Underline,
  Upload,
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
  selectionAction: {
    bold: Bold,
    italic: Italic,
    underline: Underline,
    color: Palette,
    "split-horizontal": SquareSplitVertical,
    "split-vertical": SquareSplitHorizontal,
    "delete-divider": Trash2,
  } satisfies IconMap<
    | "bold"
    | "italic"
    | "underline"
    | "color"
    | "split-horizontal"
    | "split-vertical"
    | "delete-divider"
  >,
  colorPalette: {
    ansi16: Grid2X2,
    presets: Palette,
  } satisfies IconMap<"ansi16" | "presets">,
  shapeTool: {
    box: Square,
    splitBox: SquareSplitVertical,
    circle: Circle,
    line: Minus,
    stepline: LineSquiggle,
  } satisfies IconMap<"box" | "splitBox" | "circle" | "line" | "stepline">,
  animationAction: {
    "generate-frames": Film,
    previous: ChevronLeft,
    next: ChevronRight,
    play: Play,
    pause: Pause,
    loop: Repeat,
  } satisfies IconMap<
    | "generate-frames"
    | "previous"
    | "next"
    | "play"
    | "pause"
    | "loop"
  >,
  appMenu: {
    trigger: Menu,
    import: Upload,
    export: Download,
    copy: Copy,
    help: CircleHelp,
    preview: Eye,
    "preview-off": EyeOff,
    github: Github,
    language: Languages,
    minimap: Map,
    clear: Trash2,
  } satisfies IconMap<
    | "trigger"
    | "import"
    | "export"
    | "copy"
    | "help"
    | "preview"
    | "preview-off"
    | "github"
    | "language"
    | "minimap"
    | "clear"
  >,
  sessionAction: {
    expand: ChevronDown,
    more: MoreHorizontal,
    rename: Pencil,
    create: Plus,
    close: Trash2,
  } satisfies IconMap<"expand" | "more" | "rename" | "create" | "close">,
  chrome: {
    "open-right-sidebar": PanelRightOpen,
    "toolbar-submenu": ChevronDown,
  } satisfies IconMap<"open-right-sidebar" | "toolbar-submenu">,
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
