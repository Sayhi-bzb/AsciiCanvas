import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SecurityControl } from './security-control';

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

describe('SecurityControl', () => {
  afterEach(() => {
    cleanup();
  });

  it('leaves viewport positioning to the editor chrome slot', async () => {
    render(<SecurityControl />);
    const host = screen.getByTestId('security-control-host');
    const control = screen.getByTestId('data-security-control');

    expect(host).not.toHaveClass('fixed', 'absolute');
    expect(control).not.toHaveAttribute('title');
    expect(screen.queryByRole('button', { name: 'Help' })).not.toBeInTheDocument();

    fireEvent.focus(control);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Data security');
  });

  it('opens Data security and returns focus to its trigger', async () => {
    render(<SecurityControl />);
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
