import * as React from 'react';

import { cn } from '@/shared/lib/utils';

type KbdProps = React.ComponentProps<'kbd'> & {
  invalid?: boolean;
};

function Kbd({ className, invalid = false, ...props }: KbdProps) {
  return (
    <kbd
      data-slot="kbd"
      data-invalid={invalid || undefined}
      className={cn(
        'pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded-sm bg-kbd-surface px-1 font-sans text-xs font-medium text-muted-foreground select-none',
        'data-[invalid=true]:bg-error/10 data-[invalid=true]:text-error',
        "[&_svg:not([class*='size-'])]:size-3",
        '[[data-slot=tooltip-popup]_&]:h-4 [[data-slot=tooltip-popup]_&]:min-w-4 [[data-slot=tooltip-popup]_&]:bg-tooltip-kbd-surface [[data-slot=tooltip-popup]_&]:text-[10px] [[data-slot=tooltip-popup]_&]:text-tooltip-kbd-foreground',
        className
      )}
      {...props}
    />
  );
}

function KbdGroup({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="kbd-group"
      className={cn('inline-flex items-center gap-1', className)}
      {...props}
    />
  );
}

export { Kbd, KbdGroup };
