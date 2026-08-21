import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';

import { cn } from './utils.js';
import { rx } from './recipes.js';
import type { StatusTone } from './tokens.js';

type StatusTextProps = React.ComponentProps<'span'> & {
  asChild?: boolean;
  tone?: StatusTone;
};

function StatusText({ asChild = false, className, tone = 'neutral', ...props }: StatusTextProps) {
  const Comp = asChild ? Slot : 'span';
  return (
    <Comp
      data-slot="status-text"
      data-tone={tone}
      className={cn(rx.statusText({ tone }), className)}
      {...props}
    />
  );
}

type StatusDotProps = React.ComponentProps<'span'> & {
  tone?: StatusTone;
};

function StatusDot({ className, tone = 'neutral', ...props }: StatusDotProps) {
  return (
    <span
      aria-hidden={props['aria-hidden'] ?? true}
      data-slot="status-dot"
      data-tone={tone}
      className={cn(rx.statusDot({ tone }), className)}
      {...props}
    />
  );
}

export { StatusDot, StatusText };
