import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { rx } from '@/shared/styles/recipes';
import { Pressable } from '@/shared/ui/pressable';

describe('focus ring placement', () => {
  it('keeps compact shared recipes inside their clipping boundary', () => {
    const compactRecipes = [
      rx.control(),
      rx.selectableItem(),
      rx.swatchButton(),
      rx.tabsTrigger(),
      rx.field(),
      rx.field({ appearance: 'quiet' }),
      rx.field({ appearance: 'search' }),
    ];

    for (const className of compactRecipes) {
      expect(className).toContain('focus-visible:ring-inset');
    }
    expect(rx.tabsTrigger()).not.toContain('focus-visible:outline-1');
  });

  it('defaults Pressable to an inset ring and requires an explicit outset ring', () => {
    render(
      <>
        <Pressable>Inset</Pressable>
        <Pressable focusRing="outset">Outset</Pressable>
      </>
    );

    expect(screen.getByRole('button', { name: 'Inset' })).toHaveClass(
      'focus-visible:ring-inset'
    );
    expect(screen.getByRole('button', { name: 'Inset' })).not.toHaveClass(
      'focus-visible:ring-offset-1'
    );
    expect(screen.getByRole('button', { name: 'Outset' })).toHaveClass(
      'focus-visible:ring-offset-1'
    );
    expect(screen.getByRole('button', { name: 'Outset' })).not.toHaveClass(
      'focus-visible:ring-inset'
    );
  });

  it('lets explicit interaction states replace the focus ring', () => {
    const control = rx.control();

    expect(control).toContain('data-[active=true]:focus-visible:ring-0');
    expect(control).toContain('data-[pressed=true]:focus-visible:ring-0');
    expect(control).toContain('data-[open=true]:focus-visible:ring-0');
    expect(control).toContain('data-[state=open]:focus-visible:ring-0');
    expect(control).toContain('data-[state=on]:focus-visible:ring-0');
    expect(rx.selectableItem()).toContain('data-[selected=true]:focus-visible:ring-0');
    expect(rx.tabsTrigger()).toContain('data-[state=active]:focus-visible:ring-0');

    render(<Pressable aria-pressed>Recording</Pressable>);
    expect(screen.getByRole('button', { name: 'Recording' })).toHaveClass(
      'aria-pressed:focus-visible:ring-0'
    );
  });
});
