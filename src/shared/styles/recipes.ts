import { cn } from '@/shared/lib/utils';
import type {
  Density,
  ItemVariant,
  Shape,
  Size,
  SurfaceKind,
  Tone,
} from './tokens';

type ControlOptions = {
  tone?: Tone;
  size?: Size;
  shape?: Shape;
  outlined?: boolean;
  active?: boolean;
  pressed?: boolean;
  open?: boolean;
  destructive?: boolean;
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
  density?: Density;
  orientation?: 'horizontal' | 'vertical';
  selected?: boolean;
  muted?: boolean;
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
    'rounded-lg border-0',
    kind === 'embedded' && 'bg-host-surface shadow-none',
    kind === 'floating' && 'bg-host-surface shadow-host',
    kind === 'overlay' && 'bg-overlay-surface shadow-overlay',
    kind === 'transparent' && 'bg-transparent shadow-none',
    animated &&
      'transition-[background-color,box-shadow] duration-200 ease-out motion-reduce:transition-none'
  );
const dialogHeader = 'relative flex flex-col gap-1.5 text-left';

const controlBase =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all outline-none disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-ring/50 focus-visible:ring-[3px] data-[state=open]:bg-accent data-[state=open]:text-accent-foreground data-[state=on]:bg-accent data-[state=on]:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

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

const persistentControlState = 'bg-accent text-foreground';

const menuItemBase = cn(
  'relative flex cursor-default select-none items-center gap-2 rounded-md px-2 outline-none transition-colors',
  'focus:bg-accent focus:text-accent-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground',
  'data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',
  'data-[state=checked]:bg-accent data-[state=checked]:text-foreground',
  'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
  '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=\'size-\'])]:size-4'
);

const controlShape: Record<Shape, string> = {
  auto: 'rounded-md',
  square: 'rounded-lg',
  pill: 'rounded-full',
};

export const rx = {
  dialogOverlay: cn(
    'fixed inset-0 z-(--layer-modal-backdrop) bg-dialog-overlay',
    'data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0'
  ),
  dialogShell: cn(
    'fixed left-1/2 top-1/2 z-(--layer-modal) grid w-full max-w-[calc(100%-2rem)]',
    '-translate-x-1/2 -translate-y-1/2 gap-4 overflow-hidden rounded-lg border-0 bg-dialog-surface p-4 shadow-dialog outline-none sm:max-w-lg',
    'data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
    'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 duration-200'
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
    'z-(--layer-popover) min-w-32 overflow-hidden p-[3px] text-popover-foreground outline-none'
  ),
  dropdownSubPanel: cn(
    surface({ kind: 'overlay' }),
    'z-(--layer-popover) min-w-32 overflow-hidden p-[3px] text-popover-foreground outline-none'
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
      selected && persistentControlState,
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
    joined,
  }: ControlOptions = {}) =>
    cn(
      controlBase,
      controlTone[tone],
      controlSize[size],
      controlShape[shape],
      shape === 'square' && size === 'sm' && 'size-7 px-0',
      shape === 'square' && size === 'xs' && 'size-6 px-0',
      shape === 'square' && size === 'md' && 'size-8 px-0',
      shape === 'square' && size === 'lg' && 'size-9 px-0',
      tone === 'link' && 'h-auto px-0',
      (active || pressed || open) && persistentControlState,
      destructive &&
        'text-destructive hover:bg-destructive-muted hover:text-destructive',
      joined === 'start' && 'rounded-r-none',
      joined === 'middle' && 'rounded-none',
      joined === 'end' && 'rounded-l-none',
      outlined && 'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground'
    ),

  selectableItem: ({
    density = 'compact',
    orientation = 'horizontal',
    selected = false,
    muted = false,
  }: SelectableItemOptions = {}) =>
    cn(
      'inline-flex min-w-0 items-center rounded-md bg-transparent outline-none transition-colors',
      'hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring/50 focus-visible:ring-[3px]',
      'disabled:pointer-events-none disabled:opacity-50',
      density === 'compact' && 'min-h-7 gap-1.5 px-2 text-xs',
      density === 'default' && 'min-h-8 gap-2 px-2.5 text-sm',
      orientation === 'vertical' && 'flex-col items-stretch',
      muted ? 'text-muted-foreground' : 'text-foreground',
      selected && persistentControlState
    ),

  swatchButton: ({ selected = false }: SwatchButtonOptions = {}) =>
    cn(
      'inline-flex size-6 cursor-pointer items-center justify-center rounded-full bg-transparent outline-none',
      'focus-visible:ring-ring/50 focus-visible:ring-[3px]',
      'disabled:pointer-events-none disabled:opacity-50',
      selected && 'ring-2 ring-primary'
    ),

  tabsList: ({ variant = 'default' }: { variant?: 'default' | 'line' } = {}) =>
    cn(
      'group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground',
      'group-data-[orientation=horizontal]/tabs:h-9 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col',
      variant === 'default' ? 'bg-muted' : 'gap-1 rounded-none bg-transparent'
    ),

  tabsTrigger: ({ size = 'default', active = false }: TabTriggerOptions = {}) =>
    cn(
      'relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent px-2 py-1 text-sm font-medium text-muted-foreground transition-all',
      'hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-1 focus-visible:outline-ring',
      'disabled:pointer-events-none disabled:opacity-50 group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start',
      'data-[state=active]:border-tab-active-border data-[state=active]:bg-accent data-[state=active]:text-foreground',
      'group-data-[variant=default]/tabs-list:data-[state=active]:shadow-sm group-data-[variant=line]/tabs-list:data-[state=active]:border-transparent group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent group-data-[variant=line]/tabs-list:data-[state=active]:shadow-none',
      'after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100',
      "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      size === 'icon' &&
        'size-7 flex-none justify-center rounded-lg p-0 hover:bg-accent hover:text-accent-foreground focus-visible:border-transparent focus-visible:outline-0 group-data-[variant=default]/tabs-list:data-[state=active]:shadow-none',
      active && persistentControlState
    ),

  field: ({
    density = 'default',
    invalid = false,
    appearance = 'default',
  }: FieldOptions = {}) =>
    cn(
      'w-full min-w-0 rounded-md transition-colors outline-none',
      density === 'default' && 'h-8 px-2.5 py-1.5 text-xs',
      density === 'compact' && 'h-7 px-2 py-1 text-[11px]',
      appearance === 'default' &&
        'border border-input bg-field-surface shadow-xs focus-visible:ring-ring/50 focus-visible:ring-[3px]',
      appearance === 'quiet' &&
        'border-0 bg-transparent shadow-none focus-visible:ring-1 focus-visible:ring-ring',
      appearance === 'search' &&
        'border-0 bg-search-surface shadow-none focus-visible:ring-1 focus-visible:ring-ring',
      invalid && 'border-destructive aria-invalid:border-destructive'
    ),

  panelText: () => 'text-xs leading-4',
  panelHeading: () => 'text-xs leading-4 font-semibold',
};
