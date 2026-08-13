"use client";

import { useRef, useState } from "react";
import { useCanvasRuntime, useCanvasState } from "@/domains/canvas/public";
import {
  getSlideResizeCropCount,
  type Slide,
  type SlideSize,
} from "@/domains/slides/public";
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
import { CustomSlideSizeDialog } from "@/widgets/dialogs/custom-slide-size-dialog";

const AddIcon = HOST_ICONOLOGY.sessionAction.create;
const DuplicateIcon = HOST_ICONOLOGY.editorAction["structured-duplicate"];
const DeleteIcon = HOST_ICONOLOGY.sessionAction.close;
const ConfigureIcon = HOST_ICONOLOGY.slideAction.configure;

type PendingResize = {
  slideId: string;
  slideName: string;
  size: SlideSize;
  cropCount: number;
};

export function SlideAddButton() {
  const canvas = useCanvasRuntime();
  const { t } = useUiI18n();
  const addSlide = canvas.commands.slides.add;

  return (
    <Button tone="subtle" size="md" className="w-full justify-center gap-2" onClick={addSlide}>
      <AddIcon />
      {t("slide.add")}
    </Button>
  );
}

export function SlideNavigator() {
  const canvas = useCanvasRuntime();
  const { t } = useUiI18n();
  const slideDeck = useCanvasState((state) => state.slideDeck);
  const duplicateSlide = canvas.commands.slides.duplicate;
  const removeSlide = canvas.commands.slides.remove;
  const renameSlide = canvas.commands.slides.rename;
  const moveSlide = canvas.commands.slides.move;
  const activateSlide = canvas.commands.slides.activate;
  const resizeSlide = canvas.commands.slides.resize;
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [configureSlideId, setConfigureSlideId] = useState<string | null>(null);
  const [pendingResize, setPendingResize] = useState<PendingResize | null>(null);
  const configureTriggerRef = useRef<HTMLButtonElement | null>(null);
  if (!slideDeck) return null;
  const pendingSlide = slideDeck.slides.find((slide) => slide.id === pendingDeleteId) ?? null;
  const configureSlide =
    slideDeck.slides.find((slide) => slide.id === configureSlideId) ?? null;
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
                    slide.size.columns * 9 +
                    " / " +
                    slide.size.rows * 19,
                }}
                aria-label={index + 1 + ". " + slide.name}
                aria-current={active ? "page" : undefined}
                onClick={() => activateSlide(slide.id)}
              >
                <SlidePreviewCanvas slide={slide} />
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
                  aria-label={t("slide.configure")}
                  title={t("slide.configure")}
                  onClick={(event) => {
                    configureTriggerRef.current = event.currentTarget;
                    setConfigureSlideId(slide.id);
                  }}
                >
                  <ConfigureIcon className="size-3.5" />
                </button>
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
      {configureSlide ? (
        <CustomSlideSizeDialog
          open
          mode="resize"
          initialSize={configureSlide.size}
          onOpenChange={(open) => {
            if (!open) setConfigureSlideId(null);
          }}
          onConfirm={(size) => {
            const cropCount = getSlideResizeCropCount(configureSlide, size);
            if (cropCount > 0) {
              setPendingResize({
                slideId: configureSlide.id,
                slideName: configureSlide.name,
                size,
                cropCount,
              });
              setConfigureSlideId(null);
              return;
            }
            resizeSlide(configureSlide.id, size);
            setConfigureSlideId(null);
          }}
          returnFocusRef={configureTriggerRef}
        />
      ) : null}
      <AlertDialog
        open={!!pendingResize}
        onOpenChange={(open) => {
          if (!open) setPendingResize(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("slide.resizeCrop.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingResize
                ? t("slide.resizeCrop.description", {
                    name: pendingResize.slideName,
                    columns: pendingResize.size.columns,
                    rows: pendingResize.size.rows,
                    count: pendingResize.cropCount,
                  })
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("dialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              tone="danger"
              onClick={() => {
                if (pendingResize) {
                  resizeSlide(pendingResize.slideId, pendingResize.size);
                }
                setPendingResize(null);
              }}
            >
              {t("slide.resizeCrop.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!pendingSlide} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("slide.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>{pendingSlide ? t("slide.delete.description", { name: pendingSlide.name }) : ""}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("dialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              tone="danger"
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
