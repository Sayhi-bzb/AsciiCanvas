'use client';

import { useCallback, useMemo } from 'react';
import {
  useTextRenderingRuntime,
  useTextRenderProfile,
  type MarkdownColorRuleId,
  type MarkdownRenderRuleId,
  type TextRendererMode,
} from '@/domains/document/public';
import { useUiI18n } from '@/shared/i18n';
import { Button } from '@/shared/ui/button';
import { ColorSwatch } from '@/shared/ui/color-swatch';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { ColorPickerPanel } from '@/widgets/color-picker';
import {
  SettingsDataTable,
  type SettingsDataTableColumn,
  type SettingsDataTableGroup,
} from './settings-data-table';

type DisplaySettingsPanelProps = {
  revealSettingId?: string | null;
  onRevealComplete?: () => void;
};

type DisplaySettingsColumnId = 'setting' | 'value' | 'color';

type DisplaySetting =
  | { id: 'text-renderer'; kind: 'renderer'; label: 'settings.textRenderer' }
  | {
      id: MarkdownRenderRuleId;
      kind: 'markdown-rule';
      label:
        | 'settings.markdown.strong'
        | 'settings.markdown.emphasis'
        | 'settings.markdown.strikethrough'
        | 'settings.markdown.link'
        | 'settings.markdown.inlineCode'
        | 'settings.markdown.heading'
        | 'settings.markdown.blockquote'
        | 'settings.markdown.list'
        | 'settings.markdown.thematicBreak'
        | 'settings.markdown.codeBlock'
        | 'settings.markdown.table';
    };

const rendererSetting: DisplaySetting = {
  id: 'text-renderer',
  kind: 'renderer',
  label: 'settings.textRenderer',
};

const inlineSettings: readonly DisplaySetting[] = [
  { id: 'strong', kind: 'markdown-rule', label: 'settings.markdown.strong' },
  { id: 'emphasis', kind: 'markdown-rule', label: 'settings.markdown.emphasis' },
  { id: 'strikethrough', kind: 'markdown-rule', label: 'settings.markdown.strikethrough' },
  { id: 'link', kind: 'markdown-rule', label: 'settings.markdown.link' },
  { id: 'inline-code', kind: 'markdown-rule', label: 'settings.markdown.inlineCode' },
];

const blockSettings: readonly DisplaySetting[] = [
  { id: 'heading', kind: 'markdown-rule', label: 'settings.markdown.heading' },
  { id: 'blockquote', kind: 'markdown-rule', label: 'settings.markdown.blockquote' },
  { id: 'list', kind: 'markdown-rule', label: 'settings.markdown.list' },
  { id: 'thematic-break', kind: 'markdown-rule', label: 'settings.markdown.thematicBreak' },
  { id: 'code-block', kind: 'markdown-rule', label: 'settings.markdown.codeBlock' },
  { id: 'table', kind: 'markdown-rule', label: 'settings.markdown.table' },
];

function MarkdownColorControl({
  label,
  color,
  onPick,
  onReset,
}: {
  label: string;
  color?: string;
  onPick: (color: string) => void;
  onReset: () => void;
}) {
  const { t } = useUiI18n();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          tone="neutral"
          size="xs"
          className="ml-auto max-w-full min-w-0 overflow-hidden"
          aria-label={t('settings.color.customize', { setting: label })}
        >
          {color ? (
            <>
              <ColorSwatch aria-hidden="true" color={color} shape="circle" className="size-3.5" />
              <span className="truncate font-mono">{color}</span>
            </>
          ) : (
            <span className="truncate">{t('settings.color.default')}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-auto p-0">
        <ColorPickerPanel
          value={color ?? ''}
          onPick={onPick}
          onReset={color ? onReset : undefined}
          showCanvasPicker={false}
        />
      </PopoverContent>
    </Popover>
  );
}

export function DisplaySettingsPanel({
  revealSettingId,
  onRevealComplete,
}: DisplaySettingsPanelProps) {
  const { t } = useUiI18n();
  const textRendering = useTextRenderingRuntime();
  const textRenderProfile = useTextRenderProfile();
  const columns = useMemo<SettingsDataTableColumn<DisplaySettingsColumnId>[]>(
    () => [
      {
        id: 'setting',
        header: t('settings.column.setting'),
        widthClassName: 'w-[38%]',
        cellClassName: 'truncate ps-8 text-muted-foreground',
      },
      {
        id: 'value',
        header: t('settings.column.value'),
        widthClassName: 'w-[30%]',
        headerClassName: 'text-right',
        cellClassName: 'text-right',
      },
      {
        id: 'color',
        header: t('settings.column.color'),
        widthClassName: 'w-[32%]',
        headerClassName: 'text-right',
        cellClassName: 'text-right',
      },
    ],
    [t]
  );
  const groups = useMemo<SettingsDataTableGroup<DisplaySetting>[]>(
    () => [
      { id: 'rendering', label: t('settings.rendering'), items: [rendererSetting] },
      { id: 'inline', label: t('settings.markdownRules.inline'), items: inlineSettings },
      { id: 'blocks', label: t('settings.markdownRules.block'), items: blockSettings },
    ],
    [t]
  );
  const revealSetting = useCallback((row: HTMLTableRowElement) => {
    if (typeof row.scrollIntoView === 'function') {
      row.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    row.querySelector<HTMLElement>('[data-settings-control]')?.focus({ preventScroll: true });
  }, []);

  return (
    <SettingsDataTable
      columns={columns}
      groups={groups}
      getItemId={(setting) => setting.id}
      getGroupToggleLabel={(group, expanded) =>
        t(expanded ? 'settings.group.collapse' : 'settings.group.expand', {
          group: group.label,
        })
      }
      revealItemId={revealSettingId}
      onRevealItem={revealSetting}
      onRevealComplete={onRevealComplete}
      dataSlot="display-settings-grid"
      bodyDataSlot="display-settings-list"
      groupRowDataSlot="display-settings-group-row"
      renderItemCell={(setting, columnId) => {
        if (columnId === 'setting') return t(setting.label);
        if (columnId === 'value') {
          return setting.kind === 'renderer' ? (
            <Select
              value={textRenderProfile.mode}
              onValueChange={(mode) =>
                textRendering.setProfile({
                  ...textRenderProfile,
                  mode: mode as TextRendererMode,
                })
              }
            >
              <SelectTrigger
                id="settings-text-renderer"
                data-settings-control=""
                aria-label={t(setting.label)}
                className="ml-auto w-full max-w-40 min-w-0"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start" position="popper">
                <SelectGroup>
                  {(['auto', 'ansi', 'markdown', 'raw'] as const).map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {t(`settings.textRenderer.${mode}`)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : (
            <input
              type="checkbox"
              data-settings-control=""
              className="size-3.5 cursor-pointer accent-primary"
              aria-label={t(setting.label)}
              checked={textRenderProfile.markdownRules[setting.id]}
              onChange={(event) =>
                textRendering.setProfile({
                  ...textRenderProfile,
                  markdownRules: {
                    ...textRenderProfile.markdownRules,
                    [setting.id]: event.currentTarget.checked,
                  },
                })
              }
            />
          );
        }
        return (
          <>
            {setting.kind === 'renderer' ? (
              <span className="text-muted-foreground" aria-hidden="true">
                —
              </span>
            ) : setting.id === 'code-block' ? (
              <span className="text-muted-foreground">{t('settings.color.syntax')}</span>
            ) : (
              <MarkdownColorControl
                label={t(setting.label)}
                color={textRenderProfile.markdownColors[setting.id]}
                onPick={(color) =>
                  textRendering.setProfile({
                    ...textRenderProfile,
                    markdownColors: {
                      ...textRenderProfile.markdownColors,
                      [setting.id as MarkdownColorRuleId]: color,
                    },
                  })
                }
                onReset={() => {
                  const markdownColors = { ...textRenderProfile.markdownColors };
                  delete markdownColors[setting.id as MarkdownColorRuleId];
                  textRendering.setProfile({ ...textRenderProfile, markdownColors });
                }}
              />
            )}
          </>
        );
      }}
    />
  );
}
