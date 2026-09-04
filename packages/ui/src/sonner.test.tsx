import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { toast } from 'sonner';

import { notify } from './notifications.js';
import { Toaster } from './sonner.js';

describe('Toaster semantic status colors', () => {
  afterEach(() => {
    act(() => toast.dismiss());
  });

  it.each([
    ['success', notify.success, 'text-success'],
    ['warning', notify.warning, 'text-warning'],
    ['error', notify.error, 'text-error'],
  ] as const)('colors the %s title and icon through semantic tokens', async (_, publish, color) => {
    render(<Toaster theme="light" />);

    act(() => {
      publish('Status message');
    });

    const title = await screen.findByText('Status message');
    const toastElement = title.closest('[data-sonner-toast]');
    expect(toastElement).toHaveClass(`[&_[data-title]]:${color}`);
    expect(toastElement?.querySelector('[data-icon] svg')).toHaveClass(color);

    await waitFor(() => expect(toastElement).toBeInTheDocument());
  });
});
