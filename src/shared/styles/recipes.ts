import { cn } from '@/shared/lib/utils';
import type { Density, ItemVariant, Shape, Size, SurfaceKind, Tone } from './tokens';

type ControlOptions = {
  tone?: Tone;
  size?: Size;
  shape?: Shape;
  outlined?: boolean;
  active?: boolean;
  pressed?: boolean;
  open?: boolean;
  destructive?: boolean;
  subordinate?: boolean;
  joined?: 'start' | 'middle' | 'end';
};

type SurfaceOptions = {
  kind?: SurfaceKind;
  animated?: boolean;
};

type FieldOptions = {
  density?: Density;
  invalid?: boolean;
  appearance?: 'default' | 'quiet' | 'search';
};

type MenuItemOptions = {
  density?: Density;
  variant?: ItemVariant;
  selected?: boolean;
};

type SelectableItemOptions = {
  orientation?: 'horizontal' | 'vertical';
  selected?: boolean;
  muted?: boolean;
};

type CollectionCardOptions = {
  selected?: boolean;
};

type SwatchButtonOptions = {
  selected?: boolean;
};

type TabTriggerOptions = {
  size?: 'default' | 'icon';
  active?: boolean;
};

const surface = ({ kind = 'embedded', animated = false }: SurfaceOptions = {}) =>
  cn(
    'rounded-surface border-0',
    kind === 'embedded' && 'bg-host-surface shadow-none',
    kind === 'floating' && 'bg-host-surface shadow-host',
    kind === 'overlay' && 'bg-overlay-surface shadow-overlay',
    kind === 'transparent' && 'bg-transparent shadow-none',
    animated &&
      'transition-[background-color,box-shadow] duration-[var(--motion-standard)] ease-out motion-reduce:transition-none'
  );
const dialogHeader = 'relative flex flex-col gap-1.5 text-left';

const controlBase =
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap font-medium transition-[color,background-color,opacity,box-shadow] duration-[var(--motion-fast)] outline-none motion-reduce:transition-none disabled:pointer-events-none disabled:cursor-default disabled:opacity-50 focus-visible:ring-ring/50 focus-visible:ring-2 data-[state=open]:bg-control-open-surface data-[state=open]:text-accent-foreground data-[state=on]:bg-control-pressed-surface data-[state=on]:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

const controlTone: Record<Tone, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
  neutral: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  subtle: 'bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground',
  danger:
    'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-invalid-ring',
  link: 'text-primary underline-offset-4 hover:underline bg-transparent',
};

const controlSize: Record<Size, string> = {
  xs: 'h-6 px-2 text-[11px]',
  sm: 'h-7 px-2.5 text-xs',
  md: 'h-8 px-3 text-xs',
  lg: 'h-9 px-4 text-xs',
};

const openControlState = 'bg-control-open-surface text-foreground';
const pressedControlState =
  'bg-control-pressed-surface text-foreground data-[state=open]:bg-control-pressed-surface data-[state=open]:text-foreground';
const activeControlState =
  'bg-control-active-surface text-foreground data-[state=open]:bg-control-active-surface data-[state=open]:text-foreground';

const menuItemBase = cn(
  'relative flex cursor-pointer select-none items-center gap-2 rounded-item px-2 outline-none transition-colors duration-[var(--motion-fast)] motion-reduce:transition-none',
  'focus:bg-accent focus:text-accent-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground',
  'data-[state=open]:bg-control-open-surface data-[state=open]:text-accent-foreground',
  'data-[state=checked]:bg-control-pressed-surface data-[state=checked]:text-foreground',
  'data-[disabled]:pointer-events-none data-[disabled]:cursor-default data-[disabled]:opacity-50',
  "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
);

const controlShape: Record<Shape, string> = {
  auto: 'rounded-control',
  square: 'rounded-control',
  pill: 'rounded-full',
};

export const rx = {
  dialogOverlay: cn(
    'fixed inset-0 z-(--layer-modal-backdrop) bg-dialog-overlay',
    'data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
    'duration-[var(--motion-slow)] motion-reduce:animate-none'
  ),
  dialogShell: cn(
    'fixed left-1/2 top-1/2 z-(--layer-modal) grid w-full max-w-[calc(100%-2rem)]',
    '-translate-x-1/2 -translate-y-1/2 gap-4 overflow-hidden rounded-surface border-0 bg-dialog-surface p-4 shadow-dialog outline-none sm:max-w-lg',
    'data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
    'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 duration-[var(--motion-slow)] motion-reduce:animate-none'
  ),
  dialogHeader,
  dialogHeaderWithClose: cn(dialogHeader, 'pr-12'),
  dialogBody: 'min-w-0',
  dialogFooter: cn('flex flex-col-reverse gap-2', 'sm:flex-row sm:justify-end'),
  surface,
  contentScrollArea: cn(
    'group/content-scroll-area',
    '[&_[data-slot=scroll-area-scrollbar]]:opacity-0',
    'hover:[&_[data-slot=scroll-area-scrollbar]]:opacity-100',
    'focus-within:[&_[data-slot=scroll-area-scrollbar]]:opacity-100',
    '[&_[data-slot=scroll-area-thumb]]:bg-muted-foreground/25'
  ),
  dropdownPanel: cn(
    surface({ kind: 'overlay' }),
    'min-w-32 overflow-hidden p-[3px] text-popover-foreground outline-none'
  ),
  dropdownSubPanel: cn(
    surface({ kind: 'overlay' }),
    'min-w-32 overflow-hidden p-[3px] text-popover-foreground outline-none'
  ),
  portalLayer: ({ modal = false }: { modal?: boolean } = {}) =>
    modal ? 'z-(--layer-modal-popover)' : 'z-(--layer-popover)',
  overlayContent: ({ density = 'compact' }: { density?: Density } = {}) =>
    density === 'compact' ? 'p-2' : 'p-4',
  overlayMotion: cn(
    'data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
    'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
    'duration-[var(--motion-standard)] motion-reduce:animate-none'
  ),
  menuItem: ({
    density = 'compact',
    variant = 'default',
    selected = false,
  }: MenuItemOptions = {}) =>
    cn(
      menuItemBase,
      density === 'compact' && 'min-h-7 py-1 text-xs',
      density === 'default' && 'min-h-8 py-1.5 text-sm',
      selected && activeControlState,
      variant === 'destructive' &&
        'text-destructive focus:bg-destructive-muted focus:text-destructive data-[highlighted]:bg-destructive-muted data-[highlighted]:text-destructive [&_svg]:text-destructive'
    ),
  menuSeparator: '-mx-1 my-1 h-px bg-border',
  control: ({
    tone = 'primary',
    size = 'md',
    shape = 'auto',
    outlined = false,
    active = false,
    pressed = false,
    open = false,
    destructive = false,
    subordinate = false,
    joined,
  }: ControlOptions = {}) =>
    cn(
      controlBase,
      controlTone[tone],
      controlSize[size],
      controlShape[shape],
      shape === 'square' && size === 'sm' && 'size-7 px-0',
      shape === 'square' && size === 'xs' && "size-6 px-0 [&_svg:not([class*='size-'])]:size-3.5",
      shape === 'square' && size === 'md' && 'size-8 px-0',
      shape === 'square' && size === 'lg' && 'size-9 px-0',
      tone === 'link' && 'h-auto px-0',
      open && openControlState,
      pressed && pressedControlState,
      active && activeControlState,
      subordinate &&
        'opacity-40 hover:opacity-100 data-[active=true]:opacity-100 data-[pressed=true]:opacity-100 data-[open=true]:opacity-100',
      destructive && 'text-destructive hover:bg-destructive-muted hover:text-destructive',
      joined === 'start' && 'rounded-r-none',
      joined === 'middle' && 'rounded-none',
      joined === 'end' && 'rounded-l-none',
      outlined && 'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground'
    ),

  selectableItem: ({
    orientation = 'horizontal',
    selected = false,
    muted = false,
  }: SelectableItemOptions = {}) =>
    cn(
      'inline-flex min-w-0 cursor-pointer items-center rounded-item bg-transparent outline-none transition-colors duration-[var(--motion-fast)] motion-reduce:transition-none',
      'hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring/50 focus-visible:ring-2',
      'disabled:pointer-events-none disabled:cursor-default disabled:opacity-50',
      'min-h-7 gap-1.5 px-2 text-xs leading-4',
      orientation === 'vertical' && 'flex-col items-stretch',
      muted ? 'text-muted-foreground' : 'text-foreground',
      selected && activeControlState
    ),

  collectionCard: ({ selected = false }: CollectionCardOptions = {}) =>
    cn(
      'flex min-w-0 flex-col gap-1 rounded-item bg-transparent p-1 transition-[background-color,box-shadow] duration-[var(--motion-fast)] motion-reduce:transition-none',
      'hover:bg-control-open-surface',
      selected && 'bg-control-active-surface hover:bg-control-active-surface'
    ),

  swatchButton: ({ selected = false }: SwatchButtonOptions = {}) =>
    cn(
      'inline-flex size-6 cursor-pointer items-center justify-center rounded-full bg-transparent outline-none',
      'focus-visible:ring-ring/50 focus-visible:ring-2',
      'disabled:pointer-events-none disabled:cursor-default disabled:opacity-50',
      selected && 'ring-2 ring-primary'
    ),

  tabsList: ({ variant = 'default' }: { variant?: 'default' | 'line' } = {}) =>
    cn(
      'group/tabs-list inline-flex w-fit items-center justify-center rounded-surface p-[3px] text-muted-foreground',
      'group-data-[orientation=horizontal]/tabs:h-9 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col',
      variant === 'default' ? 'bg-muted' : 'gap-1 rounded-none bg-transparent'
    ),

  tabsTrigger: ({ size = 'default', active = false }: TabTriggerOptions = {}) =>
    cn(
      'relative inline-flex h-[calc(100%-1px)] flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-control border border-transparent px-2 py-1 text-sm font-medium text-muted-foreground transition-[color,background-color,box-shadow] duration-[var(--motion-fast)] motion-reduce:transition-none',
      'hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-1 focus-visible:outline-ring',
      'disabled:pointer-events-none disabled:cursor-default disabled:opacity-50 group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start',
      'data-[state=active]:border-tab-active-border data-[state=active]:bg-control-active-surface data-[state=active]:text-foreground',
      'group-data-[variant=default]/tabs-list:data-[state=active]:shadow-sm group-data-[variant=line]/tabs-list:data-[state=active]:border-transparent group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent group-data-[variant=line]/tabs-list:data-[state=active]:shadow-none',
      'after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100',
      "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      size === 'icon' &&
        'size-7 flex-none justify-center rounded-control p-0 hover:bg-accent hover:text-accent-foreground focus-visible:border-transparent focus-visible:outline-0 group-data-[variant=default]/tabs-list:data-[state=active]:shadow-none',
      active && activeControlState
    ),

  field: ({ density = 'default', invalid = false, appearance = 'default' }: FieldOptions = {}) =>
    cn(
      'w-full min-w-0 rounded-control transition-colors duration-[var(--motion-fast)] outline-none motion-reduce:transition-none',
      density === 'default' && 'h-8 px-2.5 py-1.5 text-xs',
      density === 'compact' && 'h-7 px-2 py-1 text-[11px]',
      appearance === 'default' &&
        'border border-input bg-field-surface shadow-xs focus-visible:ring-ring/50 focus-visible:ring-2',
      appearance === 'quiet' &&
        'border-0 bg-transparent shadow-none focus-visible:ring-1 focus-visible:ring-ring',
      appearance === 'search' &&
        'border-0 bg-search-surface shadow-none focus-visible:ring-1 focus-visible:ring-ring',
      invalid && 'border-destructive aria-invalid:border-destructive'
    ),

  panelText: () => 'text-xs leading-4',
  panelHeading: () => 'text-xs leading-4 font-semibold',
};
