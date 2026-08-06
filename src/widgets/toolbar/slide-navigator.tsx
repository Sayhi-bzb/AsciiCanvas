"use client";

import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@/domains/canvas/public";
import type { Slide } from "@/domains/slides/public";
import { GridManager } from "@/shared/utils/grid";
import { HOST_ICONOLOGY } from "@/shared/icons/iconology";
import { useUiI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { InlineRenameInput } from "@/shared/ui/inline-rename-input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";

const AddIcon = HOST_ICONOLOGY.sessionAction.create;
const DuplicateIcon = HOST_ICONOLOGY.editorAction["structured-duplicate"];
const DeleteIcon = HOST_ICONOLOGY.sessionAction.close;
const MoveUpIcon = HOST_ICONOLOGY.editorAction["structured-bring-forward"];
const MoveDownIcon = HOST_ICONOLOGY.editorAction["structured-send-backward"];

export function SlideAddButton() {
  const { t } = useUiI18n();
  const addSlide = useEditorStore((state) => state.addSlide);

  return (
    <Button tone="subtle" size="md" className="w-full justify-center gap-2" onClick={addSlide}>
      <AddIcon />
      {t("slide.add")}
    </Button>
  );
}

function SlidePreview({ slide, columns, rows }: { slide: Slide; columns: number; rows: number }) {
  const content = useMemo(() => {
    const previewRows = Math.min(rows, 12);
    const previewColumns = Math.min(columns, 50);
    const lines = Array.from({ length: previewRows }, () => Array.from({ length: previewColumns }, () => " "));
    slide.grid.forEach(([key, cell]) => {
      const { x, y } = GridManager.fromKey(key);
      if (x >= 0 && x < previewColumns && y >= 0 && y < previewRows) lines[y][x] = cell.char;
    });
    return lines.map((line) => line.join("")).join("\n");
  }, [columns, rows, slide.grid]);

  return <pre aria-hidden="true" className="pointer-events-none absolute inset-1 overflow-hidden whitespace-pre font-mono text-[3px] leading-[4px] text-foreground">{content}</pre>;
}

export function SlideNavigator() {
  const { t } = useUiI18n();
  const { slideDeck, duplicateSlide, removeSlide, renameSlide, moveSlide, activateSlide } = useEditorStore(
    useShallow((state) => ({
      slideDeck: state.slideDeck,
      duplicateSlide: state.duplicateSlide,
      removeSlide: state.removeSlide,
      renameSlide: state.renameSlide,
      moveSlide: state.moveSlide,
      activateSlide: state.activateSlide,
    }))
  );
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  if (!slideDeck) return null;
  const pendingSlide = slideDeck.slides.find((slide) => slide.id === pendingDeleteId) ?? null;

  return (
    <div className="p-2" data-testid="slide-navigator">
      <ol className="space-y-2" aria-label={t("slide.sidebar.title")}>
        {slideDeck.slides.map((slide, index) => {
          const active = slide.id === slideDeck.activeSlideId;
          return (
            <li key={slide.id}>
              <div className="min-w-0 rounded-md border bg-background p-1">
                <button
                  type="button"
                  className={cn(
                    "relative block w-full overflow-hidden rounded-sm border bg-white text-left",
                    active ? "border-primary" : "border-transparent"
                  )}
                  style={{ aspectRatio: `${slideDeck.size.columns * 9} / ${slideDeck.size.rows * 19}` }}
                  aria-label={`${index + 1}. ${slide.name}`}
                  aria-current={active ? "page" : undefined}
                  onClick={() => activateSlide(slide.id)}
                >
                  <SlidePreview slide={slide} columns={slideDeck.size.columns} rows={slideDeck.size.rows} />
                </button>
                <div className="mt-1 flex items-center gap-0.5">
                  <InlineRenameInput
                    value={slide.name}
                    aria-label={t("slide.rename")}
                    className="flex-1"
                    onCommit={(name) => renameSlide(slide.id, name)}
                  />
                  <button type="button" className="inline-flex size-6 items-center justify-center rounded hover:bg-accent" aria-label={t("slide.duplicate")} title={t("slide.duplicate")} onClick={() => duplicateSlide(slide.id)}>
                    <DuplicateIcon className="size-3.5" />
                  </button>
                  <button type="button" className="inline-flex size-6 items-center justify-center rounded hover:bg-accent disabled:opacity-30" aria-label={t("slide.moveUp")} title={t("slide.moveUp")} disabled={index === 0} onClick={() => moveSlide(slide.id, index - 1)}>
                    <MoveUpIcon className="size-3.5" />
                  </button>
                  <button type="button" className="inline-flex size-6 items-center justify-center rounded hover:bg-accent disabled:opacity-30" aria-label={t("slide.moveDown")} title={t("slide.moveDown")} disabled={index === slideDeck.slides.length - 1} onClick={() => moveSlide(slide.id, index + 1)}>
                    <MoveDownIcon className="size-3.5" />
                  </button>
                  <button type="button" className="inline-flex size-6 items-center justify-center rounded hover:bg-accent disabled:opacity-30" aria-label={t("slide.delete")} title={t("slide.delete")} disabled={slideDeck.slides.length === 1} onClick={() => setPendingDeleteId(slide.id)}>
                    <DeleteIcon className="size-3.5" />
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <AlertDialog open={!!pendingSlide} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("slide.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>{pendingSlide ? t("slide.delete.description", { name: pendingSlide.name }) : ""}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("dialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingSlide) removeSlide(pendingSlide.id);
                setPendingDeleteId(null);
              }}
            >
              {t("slide.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
