import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HelpControl } from './help-control';

let isMobile = false;
let openMobile = false;

vi.mock('@/shared/ui/sidebar', () => ({
  useSidebar: () => ({ isMobile, openMobile }),
}));

vi.mock('@/widgets/dialogs/handbook-dialog', () => ({
  HandbookDialog: ({
    open,
    onOpenChange,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <div role="dialog" aria-label="User Manual">
        <button onClick={() => onOpenChange(false)}>Close manual</button>
      </div>
    ) : null,
}));

vi.mock('@/widgets/dialogs/data-security-dialog', () => ({
  DataSecurityDialog: ({
    open,
    onOpenChange,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <div role="dialog" aria-label="Data security">
        <button onClick={() => onOpenChange(false)}>Close security</button>
      </div>
    ) : null,
}));

describe('HelpControl', () => {
  afterEach(() => {
    isMobile = false;
    openMobile = false;
    cleanup();
  });

  it('uses the true viewport corner on desktop', () => {
    render(<HelpControl />);
    const host = screen.getByTestId('help-control-host');
    expect(host).toHaveClass('fixed', 'bottom-3', 'right-3');
    expect(host).not.toHaveClass(
      'right-[calc(24rem+0.75rem)]',
      'right-[4.875rem]'
    );
    expect(host).toHaveClass('flex', 'gap-1');
    expect(host.lastElementChild).toBe(screen.getByTestId('help-control'));
  });

  it('hides while the mobile Sidebar is open', () => {
    isMobile = true;
    const { rerender } = render(<HelpControl />);
    expect(screen.getByTestId('help-control-host')).toHaveClass('right-3');

    openMobile = true;
    rerender(<HelpControl />);
    expect(screen.queryByTestId('help-control-host')).not.toBeInTheDocument();
  });

  it('opens the Handbook and reflects its active state', async () => {
    render(<HelpControl />);
    const control = screen.getByRole('button', { name: 'User Manual' });
    expect(control).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(control);
    expect(await screen.findByRole('dialog', { name: 'User Manual' })).toBeInTheDocument();
    expect(control).toHaveAttribute('aria-pressed', 'true');
    expect(control).toHaveClass('bg-accent');

    fireEvent.click(screen.getByRole('button', { name: 'Close manual' }));
    expect(screen.queryByRole('dialog', { name: 'User Manual' })).not.toBeInTheDocument();
    expect(control).toHaveAttribute('aria-pressed', 'false');
    await waitFor(() => expect(control).toHaveFocus());
  });

  it('opens Data security and returns focus to the Guard control', async () => {
    render(<HelpControl />);
    const control = screen.getByRole('button', { name: 'Data security' });
    expect(control).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(control);
    expect(await screen.findByRole('dialog', { name: 'Data security' })).toBeInTheDocument();
    expect(control).toHaveAttribute('aria-pressed', 'true');
    expect(control).toHaveClass('bg-accent');

    fireEvent.click(screen.getByRole('button', { name: 'Close security' }));
    expect(screen.queryByRole('dialog', { name: 'Data security' })).not.toBeInTheDocument();
    expect(control).toHaveAttribute('aria-pressed', 'false');
    await waitFor(() => expect(control).toHaveFocus());
  });
});
