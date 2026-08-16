import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScrollArea, ScrollBar } from '@/shared/ui/scroll-area';

describe('ScrollArea', () => {
  it('renders the native vertical scroll structure', () => {
    const { container } = render(
      <ScrollArea className="h-20 rounded-lg border">
        <div>Content</div>
      </ScrollArea>
    );

    const root = container.querySelector('[data-slot="scroll-area"]');
    expect(root).toHaveClass('h-20', 'rounded-lg', 'border');
    expect(root).not.toHaveAttribute('data-scrollbars');
    expect(root).not.toHaveAttribute('data-scroll-area');
    expect(container.querySelector('[data-slot="scroll-area-viewport"]')).toBeInTheDocument();
    expect(ScrollBar).toBeTypeOf('function');
  });

  it('applies optional layout classes to the viewport and content boundary', () => {
    const { container } = render(
      <ScrollArea viewportClassName="overflow-x-hidden" contentClassName="pr-3">
        <div>Content</div>
      </ScrollArea>
    );

    expect(container.querySelector('[data-slot="scroll-area-viewport"]')).toHaveClass(
      'overflow-x-hidden'
    );
    expect(container.querySelector('[data-slot="scroll-area-content"]')).toHaveClass('pr-3');
  });
});
