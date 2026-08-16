import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';

import { cn } from '@/shared/lib/utils';
import { rx } from '@/shared/styles/recipes';
import type { Density } from '@/shared/styles/tokens';
import { usePortalLayer } from '@/shared/ui/portal-layer';

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
          'text-popover-foreground data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-popover-content-transform-origin) outline-hidden',
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverAnchor, PopoverTrigger, PopoverContent };
