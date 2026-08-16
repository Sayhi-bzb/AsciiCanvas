import * as React from 'react';
import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';

import { cn } from '@/shared/lib/utils';
import { rx } from '@/shared/styles/recipes';
import { usePortalLayer } from '@/shared/ui/portal-layer';

function TooltipProvider({
  delay = 500,
  closeDelay = 0,
  timeout = 300,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delay={delay}
      closeDelay={closeDelay}
      timeout={timeout}
      {...props}
    />
  );
}

type TooltipPositionerProps = React.ComponentProps<typeof TooltipPrimitive.Positioner>;
type TooltipPrimitivePopupProps = React.ComponentProps<typeof TooltipPrimitive.Popup>;

type TooltipPopupProps = Omit<TooltipPrimitivePopupProps, 'className'> &
  Pick<
    TooltipPositionerProps,
    | 'align'
    | 'alignOffset'
    | 'collisionAvoidance'
    | 'collisionBoundary'
    | 'collisionPadding'
    | 'side'
    | 'sideOffset'
    | 'sticky'
  > & {
    className?: string;
  };

function TooltipPopup({
  align,
  alignOffset,
  collisionAvoidance,
  collisionBoundary,
  collisionPadding = 8,
  side = 'top',
  sideOffset = 4,
  sticky,
  className,
  children,
  ...props
}: TooltipPopupProps) {
  const portalLayer = usePortalLayer();
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        data-slot="tooltip-positioner"
        align={align}
        alignOffset={alignOffset}
        collisionAvoidance={collisionAvoidance}
        collisionBoundary={collisionBoundary}
        collisionPadding={collisionPadding}
        side={side}
        sideOffset={sideOffset}
        sticky={sticky}
        className={cn(
          rx.portalLayer({ modal: portalLayer === 'modal' }),
          'max-w-[calc(100vw-1rem)]'
        )}
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-popup"
          role="tooltip"
          className={cn(
            'pointer-events-none w-max max-w-56 origin-(--transform-origin) rounded-md bg-foreground px-2 py-1 text-left text-[11px] leading-tight text-background shadow-sm whitespace-normal break-words transition-[transform,opacity] duration-100 ease-out data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-instant:transition-none data-starting-style:scale-[0.98] data-starting-style:opacity-0 motion-reduce:transition-none',
            className
          )}
          {...props}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;
const TooltipCreateHandle = TooltipPrimitive.createHandle;
type TooltipHandle<Payload> = TooltipPrimitive.Handle<Payload>;

export { Tooltip, TooltipCreateHandle, TooltipPopup, TooltipProvider, TooltipTrigger };
export type { TooltipHandle, TooltipPopupProps };
