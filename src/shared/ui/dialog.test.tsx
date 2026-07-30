import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  Dialog,
  DialogBody,
  DialogContent,
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

describe("dialog visual contract", () => {
  it("uses the shared flat shell, sections, and host close control", () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>
          <DialogBody>Body</DialogBody>
          <DialogFooter>Footer</DialogFooter>
        </DialogContent>
      </Dialog>
    );

    const content = screen.getByRole("dialog");
    expect(content).toHaveClass("border-0", "shadow-none", "rounded-lg", "p-0");
    expect(content.querySelector('[data-slot="dialog-header"]')).toHaveClass(
      "border-accent",
      "bg-accent/40"
    );
    expect(content.querySelector('[data-slot="dialog-body"]')).toHaveClass("px-4", "py-4");
    expect(content.querySelector('[data-slot="dialog-footer"]')).toHaveClass(
      "border-accent",
      "bg-accent/25"
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
            <AlertDialogAction>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );

    const content = screen.getByRole("alertdialog");
    expect(content).toHaveClass("border-0", "shadow-none", "rounded-lg", "p-0");
    expect(content.querySelector('[data-slot="alert-dialog-header"]')).toHaveClass(
      "border-accent",
      "bg-accent/40"
    );
    expect(content.querySelector('[data-slot="alert-dialog-footer"]')).toHaveClass(
      "border-accent",
      "bg-accent/25"
    );
  });
});
