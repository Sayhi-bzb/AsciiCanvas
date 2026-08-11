"use client";

import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@/domains/canvas/public";
import type { Slide } from "@/domains/slides/public";
import { HOST_ICONOLOGY } from "@/shared/icons/iconology";
import { useUiI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { InlineRenameInput } from "@/shared/ui/inline-rename-input";
import {
  ReorderableList,
  type ReorderAnnouncement,
} from "@/shared/ui/reorderable-list";
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
import { SlidePreviewCanvas } from "./slide-preview-canvas";

const AddIcon = HOST_ICONOLOGY.sessionAction.create;
const DuplicateIcon = HOST_ICONOLOGY.editorAction["structured-duplicate"];
const DeleteIcon = HOST_ICONOLOGY.sessionAction.close;

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
  const getReorderAnnouncement = ({
    type,
    item,
    from,
    to,
    total,
  }: ReorderAnnouncement<Slide>) => {
    const values = {
      name: item.name,
      from: from + 1,
      to: to + 1,
      total,
    };
    if (type === "grab") return t("slide.reorder.grabbed", values);
    if (type === "move") return t("slide.reorder.moved", values);
    if (type === "drop") return t("slide.reorder.dropped", values);
    return t("slide.reorder.cancelled", values);
  };

  return (
    <div className="p-2" data-testid="slide-navigator">
      <ReorderableList
        items={slideDeck.slides}
        getId={(slide) => slide.id}
        ariaLabel={t("slide.reorder.list")}
        className="space-y-2"
        onMove={moveSlide}
        getItemLabel={(slide, index, total, grabbed) =>
          t(
            grabbed ? "slide.reorder.itemGrabbed" : "slide.reorder.item",
            { name: slide.name, current: index + 1, total }
          )
        }
        getAnnouncement={getReorderAnnouncement}
        renderItem={(slide, index, reorderState) => {
          const active = slide.id === slideDeck.activeSlideId;
          return (
            <div
              className={cn(
                "min-w-0 rounded-md border bg-background p-1 transition-shadow",
                reorderState.lifted && "shadow-overlay"
              )}
            >
              <button
                type="button"
                className={cn(
                  "relative block w-full overflow-hidden rounded-sm border bg-white text-left",
                  active ? "border-primary" : "border-transparent"
                )}
                style={{
                  aspectRatio:
                    slideDeck.size.columns * 9 +
                    " / " +
                    slideDeck.size.rows * 19,
                }}
                aria-label={index + 1 + ". " + slide.name}
                aria-current={active ? "page" : undefined}
                onClick={() => activateSlide(slide.id)}
              >
                <SlidePreviewCanvas
                  slide={slide}
                  size={slideDeck.size}
                />
              </button>
              <div className="mt-1 flex items-center gap-0.5">
                <InlineRenameInput
                  value={slide.name}
                  aria-label={t("slide.rename")}
                  className="flex-1"
                  onCommit={(name) => renameSlide(slide.id, name)}
                />
                <button
                  type="button"
                  className="inline-flex size-6 items-center justify-center rounded hover:bg-accent"
                  aria-label={t("slide.duplicate")}
                  title={t("slide.duplicate")}
                  onClick={() => duplicateSlide(slide.id)}
                >
                  <DuplicateIcon className="size-3.5" />
                </button>
                <button
                  type="button"
                  className="inline-flex size-6 items-center justify-center rounded hover:bg-accent disabled:opacity-30"
                  aria-label={t("slide.delete")}
                  title={t("slide.delete")}
                  disabled={slideDeck.slides.length === 1}
                  onClick={() => setPendingDeleteId(slide.id)}
                >
                  <DeleteIcon className="size-3.5" />
                </button>
              </div>
            </div>
          );
        }}
      />
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
