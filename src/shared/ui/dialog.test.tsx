import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setUiLanguage } from "@/shared/i18n";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";

describe("dialog visual contract", () => {
  afterEach(() => setUiLanguage("en"));

  it("uses the shared flat shell, sections, and host close control", () => {
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

    const content = screen.getByRole("dialog");
    expect(content).toHaveClass(
      "border-0",
      "shadow-dialog",
      "rounded-lg",
      "p-4",
      "gap-4"
    );
    const header = content.querySelector('[data-slot="dialog-header"]');
    expect(header).toHaveClass("pr-12");
    expect(content).toHaveAccessibleDescription("Changes apply to this canvas.");
    expect(header).not.toHaveClass("border-b", "border-accent", "bg-accent/40");
    expect(content.querySelector('[data-slot="dialog-body"]')).toHaveClass(
      "min-w-0"
    );
    const footer = content.querySelector('[data-slot="dialog-footer"]');
    expect(footer).not.toHaveClass("border-t", "border-accent", "bg-accent/25");
    expect(document.querySelector('[data-slot="dialog-overlay"]')).toHaveClass(
      "bg-dialog-overlay"
    );

    const close = screen.getByRole("button", { name: "Close" });
    expect(close).toHaveClass(
      "size-8",
      "border-0",
      "shadow-none",
      "focus-visible:ring-[3px]"
    );
    fireEvent.click(close);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("applies the same shell and sections to alert dialogs", () => {
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

    const content = screen.getByRole("alertdialog");
    expect(content).toHaveClass(
      "border-0",
      "shadow-dialog",
      "rounded-lg",
      "p-4",
      "gap-4"
    );
    const header = content.querySelector('[data-slot="alert-dialog-header"]');
    expect(header).not.toHaveClass(
      "pr-12",
      "border-b",
      "border-accent",
      "bg-accent/40"
    );
    const footer = content.querySelector('[data-slot="alert-dialog-footer"]');
    expect(footer).not.toHaveClass("border-t", "border-accent", "bg-accent/25");
    expect(screen.getByRole("button", { name: "Delete" })).toHaveAttribute(
      "data-tone",
      "danger"
    );
    expect(
      document.querySelector('[data-slot="alert-dialog-overlay"]')
    ).toHaveClass("bg-dialog-overlay");
  });

  it("localizes shared Dialog and Sheet close controls", () => {
    setUiLanguage("zh");
    render(
      <>
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
      </>
    );

    expect(screen.getAllByText("关闭")).toHaveLength(2);
  });
});
