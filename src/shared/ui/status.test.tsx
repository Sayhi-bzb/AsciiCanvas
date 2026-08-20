import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StatusDot, StatusText } from '@/shared/ui/status';

describe('semantic status primitives', () => {
  it('renders status text without owning typography or structure', () => {
    render(
      <StatusText tone="success" asChild>
        <p role="status">Saved</p>
      </StatusText>
    );

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('data-slot', 'status-text');
    expect(status).toHaveAttribute('data-tone', 'success');
    expect(status).toHaveClass('text-success');
  });

  it('renders an aria-hidden semantic status dot', () => {
    const { container } = render(<StatusDot tone="warning" />);
    const dot = container.querySelector('[data-slot="status-dot"]');

    expect(dot).toHaveAttribute('aria-hidden', 'true');
    expect(dot).toHaveAttribute('data-tone', 'warning');
    expect(dot).toHaveClass('bg-warning', 'rounded-full');
  });
});
