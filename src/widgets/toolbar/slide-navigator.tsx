"use client";

import { useMemo, useRef, useState, type ComponentProps } from "react";
import {
  materializeSlideDeckContent,
  useCanvasRuntime,
  useCanvasState,
} from "@/domains/canvas/public";
import {
  getSlideResizeCropCount,
  type Slide,
  type SlideSize,
} from "@/domains/slides/public";
import { HOST_ICONOLOGY } from "@/shared/icons/iconology";
import { useUiI18n } from "@/shared/i18n";
import {
  cn,
  Button,
  CollectionCard,
  SurfaceContent,
  IconButton,
  InlineRenameInput,
  SelectableItem,
  Tooltip,
  TooltipCreateHandle,
  TooltipPopup,
  TooltipTrigger,
  type TooltipHandle,
  ReorderableList,
  type ReorderAnnouncement,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@chardesk/ui";









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

type SlideActionProps = ComponentProps<typeof IconButton> & {
  tooltip: string;
  tooltipHandle: TooltipHandle<string>;
};

function SlideAction({ tooltip, tooltipHandle, disabled, ...props }: SlideActionProps) {
  const button = <IconButton size="xs" disabled={disabled} {...props} />;

  return (
    <TooltipTrigger
      handle={tooltipHandle}
      payload={tooltip}
      render={disabled ? <span className="inline-flex">{button}</span> : button}
    />
  );
}

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
  const activeGrid = useCanvasState((state) => state.grid);
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
  const actionTooltipHandle = useMemo(() => TooltipCreateHandle<string>(), []);
  if (!slideDeck) return null;
  const hydratedSlides = materializeSlideDeckContent(
    canvas.documents,
    canvas.getState().activeCanvasId,
    slideDeck
  ).slides.map((slide) =>
    slide.id === slideDeck.activeSlideId
      ? { ...slide, grid: Array.from(activeGrid.entries()) }
      : slide
  );
  const pendingSlide = slideDeck.slides.find((slide) => slide.id === pendingDeleteId) ?? null;
  const configureSlide =
    hydratedSlides.find((slide) => slide.id === configureSlideId) ?? null;
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
    <SurfaceContent data-testid="slide-navigator">
      <ReorderableList
        items={slideDeck.slides}
        getId={(slide) => slide.id}
        ariaLabel={t("slide.reorder.list")}
        className="flex flex-col gap-3"
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
          const renderedSlide =
            hydratedSlides.find((candidate) => candidate.id === slide.id) ?? slide;
          return (
            <CollectionCard
              selected={active}
              className={cn(reorderState.lifted && "shadow-dragged")}
            >
              <SelectableItem
                type="button"
                orientation="vertical"
                selected={active}
                className="relative w-full overflow-hidden p-0 text-left"
                style={{
                  aspectRatio:
                    slide.size.columns * 9 +
                    " / " +
                    slide.size.rows * 19,
                }}
                aria-label={t(
                  active ? "slide.previewCurrent" : "slide.preview",
                  {
                    name: slide.name,
                    current: index + 1,
                    total: slideDeck.slides.length,
                  }
                )}
                aria-current={active ? "page" : undefined}
                onClick={() => activateSlide(slide.id)}
              >
                <SlidePreviewCanvas slide={renderedSlide} />
              </SelectableItem>
              <div
                role="group"
                aria-label={t("slide.actions", { name: slide.name })}
                className="flex items-center gap-0.5"
              >
                <InlineRenameInput
                  value={slide.name}
                  aria-label={t("slide.renameNamed", { name: slide.name })}
                  className="flex-1"
                  onCommit={(name) => renameSlide(slide.id, name)}
                />
                <SlideAction
                  type="button"
                  tooltip={t("slide.configure")}
                  tooltipHandle={actionTooltipHandle}
                  aria-label={t("slide.configureNamed", { name: slide.name })}
                  onClick={(event) => {
                    configureTriggerRef.current = event.currentTarget;
                    setConfigureSlideId(slide.id);
                  }}
                >
                  <ConfigureIcon />
                </SlideAction>
                <SlideAction
                  type="button"
                  tooltip={t("slide.duplicate")}
                  tooltipHandle={actionTooltipHandle}
                  aria-label={t("slide.duplicateNamed", { name: slide.name })}
                  onClick={() => duplicateSlide(slide.id)}
                >
                  <DuplicateIcon />
                </SlideAction>
                <SlideAction
                  type="button"
                  tooltip={t("slide.delete")}
                  tooltipHandle={actionTooltipHandle}
                  destructive
                  aria-label={t("slide.deleteNamed", { name: slide.name })}
                  disabled={slideDeck.slides.length === 1}
                  onClick={() => setPendingDeleteId(slide.id)}
                >
                  <DeleteIcon />
                </SlideAction>
              </div>
            </CollectionCard>
          );
        }}
      />
      <Tooltip handle={actionTooltipHandle}>
        {({ payload }) => <TooltipPopup side="left">{payload}</TooltipPopup>}
      </Tooltip>
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
    </SurfaceContent>
  );
}
