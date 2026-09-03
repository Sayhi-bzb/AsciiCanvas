import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { rx } from './recipes.js';
import { Pressable } from './pressable.js';

describe('focus ring placement', () => {
  it('uses one low-contrast inset focus ring across shared recipes', () => {
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
      expect(className).toContain(rx.focusRing());
      expect(className).not.toContain('focus-visible:ring-1');
      expect(className).not.toContain('focus-visible:ring-offset-');
    }
    expect(rx.tabsTrigger()).not.toContain('focus-visible:outline-1');
  });

  it('keeps control feedback geometry stable', () => {
    const control = rx.control();

    expect(control).toContain('transition-[color,background-color,opacity,box-shadow]');
    expect(control).not.toContain('transform');
    expect(control).not.toContain('active:scale-');
  });

  it('uses fade-only motion for transient overlays', () => {
    expect(rx.overlayMotion).toContain('data-[state=open]:fade-in-0');
    expect(rx.overlayMotion).toContain('data-[state=closed]:fade-out-0');
    expect(rx.overlayMotion).toContain('duration-[var(--motion-standard)]');
    expect(rx.overlayMotion).not.toContain('zoom-in');
    expect(rx.overlayMotion).not.toContain('zoom-out');
  });

  it('uses the shared focus ring for Pressable', () => {
    render(<Pressable>Pressable</Pressable>);

    const pressable = screen.getByRole('button', { name: 'Pressable' });
    expect(pressable).toHaveClass(...rx.focusRing().split(' '));
    expect(pressable.className).not.toContain('focus-visible:ring-offset-');
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

  it('keeps operation feedback orthogonal to interaction surfaces', () => {
    const activeSuccess = rx.control({ active: true, feedback: 'success' });
    const selectedError = rx.menuItem({ selected: true, feedback: 'error' });

    expect(activeSuccess).toContain('bg-control-active-surface');
    expect(activeSuccess).toContain('text-success');
    expect(activeSuccess).toContain('hover:text-success');
    expect(selectedError).toContain('bg-control-active-surface');
    expect(selectedError).toContain('text-error');
    expect(selectedError).toContain('data-[highlighted]:text-error');
  });

  it('maps persistent control status to semantic surfaces without changing operation feedback', () => {
    const success = rx.control({ status: 'success' });
    const warning = rx.control({ status: 'warning' });
    const error = rx.control({ status: 'error' });
    const neutral = rx.control({ status: 'neutral' });

    expect(success).toContain('bg-success-muted');
    expect(success).toContain('text-success');
    expect(warning).toContain('bg-warning-muted');
    expect(warning).toContain('text-warning');
    expect(error).toContain('bg-error-muted');
    expect(error).toContain('text-error');
    expect(neutral).toContain('bg-control-active-surface');
    expect(neutral).toContain('text-foreground');
    expect(rx.control({ feedback: 'success' })).not.toContain('bg-success-muted');
  });

  it('maps persistent status text and dots through semantic recipes', () => {
    expect(rx.statusText({ tone: 'success' })).toBe('text-success');
    expect(rx.statusText({ tone: 'warning' })).toBe('text-warning');
    expect(rx.statusText({ tone: 'error' })).toBe('text-error');
    expect(rx.statusDot({ tone: 'success' })).toContain('bg-success');
  });

  it('maps selectable item status to a stronger selected surface', () => {
    expect(rx.selectableItem({ status: 'success' })).toContain('bg-success-muted');
    expect(rx.selectableItem({ status: 'success', selected: true })).toContain(
      'bg-success/20'
    );
    expect(rx.selectableItem()).not.toContain('bg-success-muted');
  });

  it('keeps static menu separators low-contrast, two-pixel, and rounded', () => {
    expect(rx.menuSeparator).toContain('bg-separator');
    expect(rx.menuSeparator).toContain('h-0.5');
    expect(rx.menuSeparator).toContain('rounded-full');
    expect(rx.menuSeparator).not.toContain('h-px');
  });
});
