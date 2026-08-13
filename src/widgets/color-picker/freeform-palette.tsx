'use client';

import { useCallback, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useCanvasRuntime, useCanvasState } from '@/domains/canvas/public';
import { useUiI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';
import { SHORTCUT_PRIORITY, useShortcutLayer } from '@/shared/shortcuts/dispatcher';
import { rx } from '@/shared/styles/recipes';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { ColorPickerPanel } from './index';

type FreeformPaletteControlProps = {
  enabled?: boolean;
  onBeforeOpen?: () => void;
};

export function FreeformPaletteControl({
  enabled = true,
  onBeforeOpen,
}: FreeformPaletteControlProps) {
  const paletteMode = useCanvasState((state) =>
    state.canvasMode !== 'freeform' ? null : state.tool === 'pan' ? 'pan' : 'drawing'
  );

  return paletteMode && enabled ? (
    <FreeformPaletteSurface
      key={paletteMode}
      initiallyOpen={paletteMode === 'drawing'}
      onBeforeOpen={onBeforeOpen}
    />
  ) : null;
}

function FreeformPaletteSurface({
  initiallyOpen,
  onBeforeOpen,
}: Pick<FreeformPaletteControlProps, 'onBeforeOpen'> & {
  initiallyOpen: boolean;
}) {
  const canvas = useCanvasRuntime();
  const { t } = useUiI18n();
  const { brushColor, brushBackgroundColor, canvasColorPickerTarget, hasSelection, tool } =
    useCanvasState(
      useShallow((state) => ({
        brushColor: state.brushColor,
        brushBackgroundColor: state.brushBackgroundColor,
        canvasColorPickerTarget: state.canvasColorPickerTarget,
        hasSelection: state.selections.length > 0,
        tool: state.tool,
      }))
    );
  const [open, setOpen] = useState(initiallyOpen);

  useEffect(() => {
    canvas.commands.interaction.setColorPickerTarget(null);
    return () => canvas.commands.interaction.setColorPickerTarget(null);
  }, [canvas, tool]);

  const close = useCallback(() => {
    setOpen(false);
    canvas.commands.interaction.setColorPickerTarget(null);
  }, [canvas]);

  const setOpenState = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        onBeforeOpen?.();
        setOpen(true);
      } else {
        close();
      }
    },
    [close, onBeforeOpen]
  );

  useShortcutLayer({
    id: 'freeform-palette',
    priority: SHORTCUT_PRIORITY.dynamicCanvasCommand,
    onKeyDown: (event, context) => {
      if (event.key === 'Escape' && (open || canvasColorPickerTarget)) {
        close();
        return { claimed: true, preventDefault: true };
      }
      if (context.targetKind === 'editable' || context.targetKind === 'overlay') {
        return;
      }
      if (
        event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        event.code === 'Digit6'
      ) {
        setOpenState(!open);
        return { claimed: true, preventDefault: true };
      }
    },
  });

  const isBackgroundTool = tool === 'bg';
  const activeColor = isBackgroundTool ? brushBackgroundColor : brushColor;
  const applyColor = (color: string) => {
    if (isBackgroundTool) {
      canvas.commands.preferences.setBrushBackgroundColor(color);
      if (hasSelection) canvas.commands.selection.setBackgroundColor(color);
      return;
    }
    canvas.commands.preferences.setBrushColor(color);
    if (hasSelection) canvas.commands.selection.setForegroundColor(color);
  };

  return (
    <div className="pointer-events-auto relative flex-none">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={t('palette.toggle')}
            aria-controls="freeform-palette-panel"
            aria-expanded={open}
            aria-keyshortcuts="Alt+6"
            className={cn(rx.hostIconControl, open && rx.hostControlActive)}
            onClick={() => setOpenState(!open)}
          >
            <span
              data-testid="freeform-palette-swatch"
              aria-hidden="true"
              className="size-5 rounded-[3px] border border-border shadow-sm"
              style={{ backgroundColor: activeColor }}
            />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t('palette.title')}</TooltipContent>
      </Tooltip>

      {open && (
        <section
          id="freeform-palette-panel"
          data-testid="freeform-palette-panel"
          aria-label={t('palette.title')}
          className={cn(
            rx.floatingHost,
            'absolute left-[calc(100%+0.5rem)] top-0 w-[min(10rem,calc(100vw-2rem))] p-2'
          )}
        >
          <ColorPickerPanel
            value={activeColor}
            onPick={applyColor}
            canvasPickDestination={isBackgroundTool ? 'background' : 'foreground'}
            className="w-full"
          />
        </section>
      )}
    </div>
  );
}
