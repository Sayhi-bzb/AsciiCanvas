import * as React from 'react';

import { cn } from './utils.js';

type PressableProps = React.ComponentProps<'button'> & {
  focusRing?: 'inset' | 'outset';
};

function Pressable({ className, focusRing = 'inset', ...props }: PressableProps) {
  return (
    <button
      data-slot="pressable"
      className={cn(
        'cursor-pointer rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
        focusRing === 'inset' ? 'focus-visible:ring-inset' : 'focus-visible:ring-offset-1',
        'aria-pressed:focus-visible:ring-0',
        className
      )}
      {...props}
    />
  );
}

export { Pressable };
