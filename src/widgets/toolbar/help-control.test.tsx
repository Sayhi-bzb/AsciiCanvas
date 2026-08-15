import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HelpControl } from './help-control';

vi.mock('@/widgets/dialogs/handbook-dialog', () => ({
  HandbookDialog: ({
    open,
    onOpenChange,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <div role="dialog" aria-label="Help">
        <button onClick={() => onOpenChange(false)}>Close help</button>
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
    cleanup();
  });

  it('leaves viewport positioning to the editor chrome slot', () => {
    render(<HelpControl />);
    const host = screen.getByTestId('help-control-host');
    expect(host).not.toHaveClass('fixed', 'absolute');
    expect(host).toHaveClass('flex', 'gap-1');
    expect(host.lastElementChild).toBe(screen.getByTestId('help-control'));
  });

  it('opens the Handbook and reflects its active state', async () => {
    render(<HelpControl />);
    const control = screen.getByRole('button', { name: 'Help' });
    expect(control).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(control);
    expect(await screen.findByRole('dialog', { name: 'Help' })).toBeInTheDocument();
    expect(control).toHaveAttribute('aria-expanded', 'true');
    expect(control).toHaveClass('bg-control-open-surface');

    fireEvent.click(screen.getByRole('button', { name: 'Close help' }));
    expect(screen.queryByRole('dialog', { name: 'Help' })).not.toBeInTheDocument();
    expect(control).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => expect(control).toHaveFocus());
  });

  it('opens Data security and returns focus to the Guard control', async () => {
    render(<HelpControl />);
    const control = screen.getByRole('button', { name: 'Data security' });
    expect(control).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(control);
    expect(await screen.findByRole('dialog', { name: 'Data security' })).toBeInTheDocument();
    expect(control).toHaveAttribute('aria-expanded', 'true');
    expect(control).toHaveClass('bg-control-open-surface');

    fireEvent.click(screen.getByRole('button', { name: 'Close security' }));
    expect(screen.queryByRole('dialog', { name: 'Data security' })).not.toBeInTheDocument();
    expect(control).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => expect(control).toHaveFocus());
  });
});
