import * as React from 'react';

import { rx } from './recipes.js';
import { cn } from './utils.js';

type PressableProps = React.ComponentProps<'button'>;

function Pressable({ className, ...props }: PressableProps) {
  return (
    <button
      data-slot="pressable"
      className={cn(
        'cursor-pointer rounded-sm',
        rx.focusRing(),
        'aria-pressed:focus-visible:ring-0',
        className
      )}
      {...props}
    />
  );
}

export { Pressable };
