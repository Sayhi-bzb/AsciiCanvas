"use client";

import {
  CircleHelp,
  Info,
  Keyboard,
  Maximize,
  Mouse,
  Move,
  Type,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

export function HandbookDialog() {
  return (
    <Dialog>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              tone="subtle"
              shape="square"
              size="md"
              className="size-8 text-muted-foreground hover:text-primary"
            >
              <CircleHelp className="size-4" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="left">User Manual</TooltipContent>
      </Tooltip>
      <DialogContent className="sm:max-w-[500px] p-0 gap-0 overflow-hidden">
        <div className="bg-muted/30 p-5 pb-4 border-b">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="size-5 text-primary" />
              <span>User Manual</span>
            </DialogTitle>
          </DialogHeader>
        </div>
        <ScrollArea className="max-h-[65vh] overflow-y-auto">
          <div className="p-5 space-y-6">
            <section className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground/80">
                <Move className="size-4" /> View
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-muted/50 p-2 rounded-md flex justify-between items-center">
                  <span>Pan</span>
                  <div className="flex gap-1 items-center">
                    <kbd className="bg-background px-1.2 py-0.5 rounded border text-[9px] font-mono shadow-sm">
                      Space
                    </kbd>
                    <span className="text-muted-foreground text-[10px]">+</span>
                    <Mouse className="size-3" />
                  </div>
                </div>
                <div className="bg-muted/50 p-2 rounded-md flex justify-between items-center">
                  <span>Zoom</span>
                  <div className="flex gap-1">
                    <kbd className="bg-background px-1.2 py-0.5 rounded border text-[9px] font-mono shadow-sm">
                      Ctrl
                    </kbd>
                    <span className="text-muted-foreground text-[10px]">+</span>
                    <span className="font-mono text-[10px]">Scroll</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2 text-primary">
                <Maximize className="size-4" /> Selection
              </h4>
              <div className="bg-primary/5 border border-primary p-3 rounded-lg text-xs space-y-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="font-bold text-foreground">Anchor Select</p>
                    <p className="text-muted-foreground">
                      Click once, then{" "}
                      <kbd className="font-mono bg-muted px-1 rounded">
                        Shift + Click
                      </kbd>{" "}
                      to select a rectangle.
                    </p>
                  </div>
                </div>
                <div className="flex justify-between items-start border-t border-primary pt-2">
                  <div className="space-y-1">
                    <p className="font-bold text-foreground">Fill</p>
                    <p className="text-muted-foreground">
                      Type{" "}
                      <span className="text-primary font-bold">
                        any character
                      </span>{" "}
                      to fill the current selection.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground/80">
                <Type className="size-4" /> Typing
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-1.5 border-b border-border">
                  <div className="flex flex-col">
                    <span className="font-medium">Smart Newline</span>
                    <span className="text-[10px] text-muted-foreground">
                      Keeps the previous indentation
                    </span>
                  </div>
                  <kbd className="bg-muted px-2 py-0.5 rounded border text-[10px] font-mono">
                    Enter
                  </kbd>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-border">
                  <div className="flex flex-col">
                    <span className="font-medium">Tab</span>
                    <span className="text-[10px] text-muted-foreground">
                      Moves 2 cells to the right
                    </span>
                  </div>
                  <kbd className="bg-muted px-2 py-0.5 rounded border text-[10px] font-mono">
                    Tab
                  </kbd>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground italic">Undo</span>
                  <div className="flex gap-1">
                    <kbd className="bg-muted px-1.5 py-0.5 rounded border text-[10px] font-mono">
                      Ctrl
                    </kbd>
                    <span className="text-muted-foreground">+</span>
                    <kbd className="bg-muted px-1.5 py-0.5 rounded border text-[10px] font-mono">
                      Z
                    </kbd>
                  </div>
                </div>
              </div>
            </section>

            <div className="flex gap-2 p-3 rounded-md bg-accent/50 border border-border">
              <Info className="size-4 text-primary shrink-0" />
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Use the <span className="font-bold underline">Select tool</span>{" "}
                to place the cursor. If a selection is active, typing fills it.
              </p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

