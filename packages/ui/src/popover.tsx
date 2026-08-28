import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';

import { cn } from './utils.js';
import { rx } from './recipes.js';
import type { Density } from './tokens.js';
import { usePortalLayer } from './portal-layer.js';

function Popover({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverAnchor({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />;
}

function PopoverContent({
  className,
  align = 'center',
  sideOffset = 4,
  density = 'compact',
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content> & {
  density?: Density;
}) {
  const portalLayer = usePortalLayer();
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          rx.surface({ kind: 'overlay' }),
          rx.overlayContent({ density }),
          rx.overlayMotion,
          rx.portalLayer({ modal: portalLayer === 'modal' }),
          'text-popover-foreground data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1 origin-(--radix-popover-content-transform-origin) outline-hidden',
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverAnchor, PopoverTrigger, PopoverContent };
