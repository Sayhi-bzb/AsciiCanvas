import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Table, TableBody, TableRow } from './table';

describe('Table', () => {
  it('keeps horizontal scrolling by default', () => {
    render(
      <Table aria-label="Default table">
        <tbody />
      </Table>
    );

    expect(screen.getByRole('table', { name: 'Default table' }).parentElement).toHaveClass(
      'overflow-x-auto'
    );
  });

  it('allows a composed table to own its overflow policy', () => {
    render(
      <Table aria-label="Fitted table" containerClassName="overflow-x-hidden">
        <tbody />
      </Table>
    );

    const container = screen.getByRole('table', { name: 'Fitted table' }).parentElement;
    expect(container).toHaveClass('overflow-x-hidden');
    expect(container).not.toHaveClass('overflow-x-auto');
  });

  it('keeps table row boundaries one pixel and straight', () => {
    render(
      <Table aria-label="Boundary table">
        <TableBody>
          <TableRow>
            <td>Cell</td>
          </TableRow>
        </TableBody>
      </Table>
    );

    const row = screen.getByRole('row');
    expect(row).toHaveClass('border-b', 'border-separator');
    expect(row).not.toHaveClass('border-2', 'rounded-full');
  });
});
