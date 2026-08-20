import { createElement } from 'react';
import { GitHubMarkIcon } from './github-mark-icon';
import {
  ArrowRight,
  Bold,
  ChevronDown,
  Circle,
  CircleHelp,
  Camera,
  CaseSensitive,
  ClipboardPaste,
  ChevronLeft,
  ChevronRight,
  Code2,
  Component,
  Contrast,
  Copy,
  CopyPlus,
  Download,
  Eraser,
  Grid2X2,
  Italic,
  Hand,
  Highlighter,
  LayoutTemplate,
  LayerArrowDown,
  LayerArrowUp,
  Layers,
  LayersArrowDown,
  LayersArrowUp,
  Languages,
  Keyboard,
  LineSquiggle,
  Map,
  Menu,
  Minus,
  MoreHorizontal,
  MousePointer2,
  Omega,
  Palette,
  Presentation,
  Sparkles,
  RotateCcw,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  PaintbrushVertical,
  PanelsTopLeft,
  Plus,
  Pencil,
  Play,
  Scissors,
  Settings2,
  ShieldCheck,
  Smile,
  Square,
  SquarePen,
  SquareSplitHorizontal,
  SquareSplitVertical,
  Star,
  Strikethrough,
  Terminal,
  Trash2,
  Type,
  Underline,
  Upload,
  Undo2,
  Users,
  X,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react';

type IconMap<Key extends string> = Record<Key, LucideIcon>;

export const HOST_ICONOLOGY = {
  canvasMode: {
    freeform: Pencil,
    structured: PanelsTopLeft,
    slide: Presentation,
    ai: Sparkles,
  } satisfies IconMap<'freeform' | 'structured' | 'slide' | 'ai'>,
  characterView: {
    essentials: CaseSensitive,
    nerd: Terminal,
    emoji: Smile,
    unicode: Omega,
  } satisfies IconMap<'essentials' | 'nerd' | 'emoji' | 'unicode'>,
  structuredView: {
    template: LayoutTemplate,
    components: Component,
  } satisfies IconMap<'template' | 'components'>,
  editorAction: {
    copy: Copy,
    'copy-rich': Palette,
    'copy-ansi': Code2,
    cut: Scissors,
    paste: ClipboardPaste,
    'snapshot-png': Camera,
    'delete-selection': Trash2,
    'structured-rename': SquarePen,
    'structured-bring-forward': LayerArrowUp,
    'structured-send-backward': LayerArrowDown,
    'structured-bring-to-front': LayersArrowUp,
    'structured-send-to-back': LayersArrowDown,
    'structured-duplicate': CopyPlus,
    'structured-copy-hierarchy': Copy,
    'structured-split-horizontal': SquareSplitVertical,
    'structured-split-vertical': SquareSplitHorizontal,
    'structured-delete-divider': Trash2,
    'structured-layer-menu': Layers,
  } satisfies IconMap<
    | 'copy'
    | 'copy-rich'
    | 'copy-ansi'
    | 'cut'
    | 'paste'
    | 'snapshot-png'
    | 'delete-selection'
    | 'structured-rename'
    | 'structured-bring-forward'
    | 'structured-send-backward'
    | 'structured-bring-to-front'
    | 'structured-send-to-back'
    | 'structured-duplicate'
    | 'structured-copy-hierarchy'
    | 'structured-split-horizontal'
    | 'structured-split-vertical'
    | 'structured-delete-divider'
    | 'structured-layer-menu'
  >,
  toolbarAction: {
    select: MousePointer2,
    text: Type,
    brush: Pencil,
    'shape-group': LineSquiggle,
    bg: Highlighter,
    fill: PaintbrushVertical,
    eraser: Eraser,
    undo: Undo2,
    pan: Hand,
  } satisfies IconMap<
    | 'select'
    | 'text'
    | 'brush'
    | 'shape-group'
    | 'bg'
    | 'fill'
    | 'eraser'
    | 'undo'
    | 'pan'
  >,
  zoomAction: {
    out: Minus,
    in: Plus,
  } satisfies IconMap<'out' | 'in'>,
  viewportAction: {
    grid: Grid2X2,
    minimap: Map,
    security: ShieldCheck,
    help: CircleHelp,
  } satisfies IconMap<'grid' | 'minimap' | 'security' | 'help'>,
  selectionAction: {
    bold: Bold,
    italic: Italic,
    underline: Underline,
    strike: Strikethrough,
    inverse: Contrast,
    color: Palette,
    'split-horizontal': SquareSplitVertical,
    'split-vertical': SquareSplitHorizontal,
    'delete-divider': Trash2,
  } satisfies IconMap<
    | 'bold'
    | 'italic'
    | 'underline'
    | 'strike'
    | 'inverse'
    | 'color'
    | 'split-horizontal'
    | 'split-vertical'
    | 'delete-divider'
  >,
  colorPalette: {
    ansi16: Grid2X2,
    presets: Palette,
    restoreDefault: RotateCcw,
  } satisfies IconMap<'ansi16' | 'presets' | 'restoreDefault'>,
  shapeTool: {
    box: Square,
    splitBox: SquareSplitVertical,
    circle: Circle,
    line: Minus,
    arrowLine: ArrowRight,
    stepline: LineSquiggle,
  } satisfies IconMap<'box' | 'splitBox' | 'circle' | 'line' | 'arrowLine' | 'stepline'>,
  appMenu: {
    trigger: Menu,
    import: Upload,
    export: Download,
    copy: Copy,
    github: GitHubMarkIcon,
    githubStar: Star,
    language: Languages,
    shortcuts: Keyboard,
    settings: Settings2,
    clear: Trash2,
  } satisfies IconMap<
    | 'trigger'
    | 'import'
    | 'export'
    | 'copy'
    | 'github'
    | 'githubStar'
    | 'language'
    | 'shortcuts'
    | 'settings'
    | 'clear'
  >,
  slideAction: {
    play: Play,
    previous: ChevronLeft,
    next: ChevronRight,
    close: X,
    configure: Settings2,
  } satisfies IconMap<'play' | 'previous' | 'next' | 'close' | 'configure'>,
  sessionAction: {
    expand: ChevronDown,
    more: MoreHorizontal,
    rename: Pencil,
    create: Plus,
    close: Trash2,
    collaboration: Users,
  } satisfies IconMap<'expand' | 'more' | 'rename' | 'create' | 'close' | 'collaboration'>,
  chrome: {
    'open-right-sidebar': PanelRightOpen,
    'toolbar-submenu': ChevronDown,
  } satisfies IconMap<'open-right-sidebar' | 'toolbar-submenu'>,
} as const;

export function SidebarToggleIcon({
  side,
  isOpen,
  ...props
}: LucideProps & {
  side: 'left' | 'right';
  isOpen: boolean;
}) {
  if (side === 'right') {
    return isOpen ? createElement(PanelRightClose, props) : createElement(PanelRightOpen, props);
  }
  return isOpen ? createElement(PanelLeftClose, props) : createElement(PanelLeftOpen, props);
}
