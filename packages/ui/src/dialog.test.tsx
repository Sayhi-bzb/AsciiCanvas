import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog.js';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './alert-dialog.js';
import { Sheet, SheetContent, SheetTitle } from './sheet.js';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select.js';
import { UiProvider } from './ui-provider.js';

describe('dialog visual contract', () => {
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('uses the shared flat shell, sections, and host close control', () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>Changes apply to this canvas.</DialogDescription>
          </DialogHeader>
          <DialogBody>Body</DialogBody>
          <DialogFooter>Footer</DialogFooter>
        </DialogContent>
      </Dialog>
    );

    const content = screen.getByRole('dialog');
    expect(content).toHaveClass(
      'border-0',
      'shadow-dialog',
      'rounded-surface',
      'ring-1',
      'ring-surface-ring',
      'p-5',
      'gap-5'
    );
    const header = content.querySelector('[data-slot="dialog-header"]');
    expect(header).toHaveClass('pr-12');
    expect(content).toHaveAccessibleDescription('Changes apply to this canvas.');
    expect(header).not.toHaveClass('border-b', 'border-accent', 'bg-accent/40');
    expect(content.querySelector('[data-slot="dialog-body"]')).toHaveClass('min-w-0');
    const footer = content.querySelector('[data-slot="dialog-footer"]');
    expect(footer).not.toHaveClass('border-t', 'border-accent', 'bg-accent/25');
    expect(document.querySelector('[data-slot="dialog-overlay"]')).toHaveClass('bg-dialog-overlay');

    const close = screen.getByRole('button', { name: 'Close' });
    expect(close).toHaveClass(
      'size-8',
      'rounded-control',
      'hover:bg-accent',
      'focus-visible:ring-2',
      'focus-visible:ring-inset'
    );
    fireEvent.click(close);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('applies the same shell and sections to alert dialogs', () => {
    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction tone="danger">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );

    const content = screen.getByRole('alertdialog');
    expect(content).toHaveClass(
      'border-0',
      'shadow-dialog',
      'rounded-surface',
      'ring-1',
      'ring-surface-ring',
      'p-5',
      'gap-5'
    );
    const header = content.querySelector('[data-slot="alert-dialog-header"]');
    expect(header).not.toHaveClass('pr-12', 'border-b', 'border-accent', 'bg-accent/40');
    const footer = content.querySelector('[data-slot="alert-dialog-footer"]');
    expect(footer).not.toHaveClass('border-t', 'border-accent', 'bg-accent/25');
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveAttribute('data-tone', 'danger');
    expect(document.querySelector('[data-slot="alert-dialog-overlay"]')).toHaveClass(
      'bg-dialog-overlay'
    );
  });

  it('localizes shared Dialog and Sheet close controls', () => {
    render(
      <UiProvider messages={{ dialogClose: '关闭' }}>
        <Dialog open>
          <DialogContent>
            <DialogTitle>Dialog</DialogTitle>
          </DialogContent>
        </Dialog>
        <Sheet open>
          <SheetContent>
            <SheetTitle>Sheet</SheetTitle>
          </SheetContent>
        </Sheet>
      </UiProvider>
    );

    expect(document.querySelectorAll('button[aria-label="关闭"]')).toHaveLength(2);
  });

  it('elevates portaled Select content declared inside a modal surface', () => {
    render(
      <>
        <Select open value="en">
          <SelectTrigger aria-label="Page language">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="en">English</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <Dialog open>
          <DialogContent>
            <DialogTitle>Settings</DialogTitle>
            <Select open value="en">
              <SelectTrigger aria-label="Dialog language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="en">English</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </DialogContent>
        </Dialog>
      </>
    );

    const contents = document.querySelectorAll('[data-slot="select-content"]');
    expect(contents).toHaveLength(2);
    expect(contents[0]).toHaveClass('z-(--layer-popover)');
    expect(contents[1]).toHaveClass('z-(--layer-modal-popover)');
  });
});
