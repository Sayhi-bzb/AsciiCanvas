'use client';

import { useCallback, useMemo } from 'react';
import {
  DEFAULT_TEXT_RENDER_THEME,
  TEXT_RENDER_FEATURES,
  useTextRenderingRuntime,
  useTextRenderProfile,
  type TextRenderColorDefault,
  type TextRenderFeatureDefinition,
  type TextRenderTheme,
  type TextRenderThemeTokenId,
  type TextRendererMode,
} from '@/domains/document/public';
import { useUiI18n, type I18nKey } from '@/shared/i18n';
import {
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SwatchButton,
  Tooltip,
  TooltipPopup,
  TooltipTrigger,
} from '@chardesk/ui';




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

type ColorSegment = {
  color?: string;
  inherited?: boolean;
};

type DisplaySetting =
  | { id: 'text-renderer'; kind: 'renderer'; label: 'settings.textRenderer' }
  | {
      id: `theme:${TextRenderThemeTokenId}`;
      kind: 'theme-token';
      token: TextRenderThemeTokenId;
      label:
        | 'settings.renderTheme.foreground'
        | 'settings.renderTheme.background'
        | 'settings.renderTheme.accent'
        | 'settings.renderTheme.accentForeground'
        | 'settings.renderTheme.info'
        | 'settings.renderTheme.success'
        | 'settings.renderTheme.warning'
        | 'settings.renderTheme.danger'
        | 'settings.renderTheme.muted'
        | 'settings.renderTheme.surface'
        | 'settings.renderTheme.surfaceForeground';
    }
  | {
      id: string;
      kind: 'render-feature';
      label: I18nKey;
      feature: TextRenderFeatureDefinition;
    };

const rendererSetting: DisplaySetting = {
  id: 'text-renderer',
  kind: 'renderer',
  label: 'settings.textRenderer',
};

const themeSettings: readonly DisplaySetting[] = [
  {
    id: 'theme:foreground',
    kind: 'theme-token',
    token: 'foreground',
    label: 'settings.renderTheme.foreground',
  },
  {
    id: 'theme:background',
    kind: 'theme-token',
    token: 'background',
    label: 'settings.renderTheme.background',
  },
  { id: 'theme:accent', kind: 'theme-token', token: 'accent', label: 'settings.renderTheme.accent' },
  {
    id: 'theme:accent-foreground',
    kind: 'theme-token',
    token: 'accent-foreground',
    label: 'settings.renderTheme.accentForeground',
  },
  { id: 'theme:info', kind: 'theme-token', token: 'info', label: 'settings.renderTheme.info' },
  { id: 'theme:success', kind: 'theme-token', token: 'success', label: 'settings.renderTheme.success' },
  { id: 'theme:warning', kind: 'theme-token', token: 'warning', label: 'settings.renderTheme.warning' },
  { id: 'theme:danger', kind: 'theme-token', token: 'danger', label: 'settings.renderTheme.danger' },
  { id: 'theme:muted', kind: 'theme-token', token: 'muted', label: 'settings.renderTheme.muted' },
  { id: 'theme:surface', kind: 'theme-token', token: 'surface', label: 'settings.renderTheme.surface' },
  {
    id: 'theme:surface-foreground',
    kind: 'theme-token',
    token: 'surface-foreground',
    label: 'settings.renderTheme.surfaceForeground',
  },
];

const featureSettings = TEXT_RENDER_FEATURES.map((feature): DisplaySetting => ({
  id: feature.id,
  kind: 'render-feature',
  label: feature.label,
  feature,
}));
const inlineSettings = featureSettings.filter(
  (setting) => setting.kind === 'render-feature' && setting.feature.settingsGroup === 'inline'
);
const blockSettings = featureSettings.filter(
  (setting) => setting.kind === 'render-feature' && setting.feature.settingsGroup === 'blocks'
);

function MarkdownColorControl({
  defaultSegments,
  label,
  color,
  className,
  onPick,
  onReset,
}: {
  defaultSegments: readonly ColorSegment[];
  label: string;
  color?: string;
  className?: string;
  onPick: (color: string) => void;
  onReset: () => void;
}) {
  const { t } = useUiI18n();
  const inheritedLabel = t('settings.color.inherited');
  const segments: ColorSegment[] = color
    ? [{ color }]
    : [...defaultSegments];
  const composite = segments.length > 1;
  const inherited = segments.length === 1 && segments[0]?.inherited === true;
  const solidColor = !composite && !inherited ? segments[0]?.color : undefined;
  const defaultValues = defaultSegments.map((segment) =>
    segment.color ?? inheritedLabel
  );
  const colorLabel = color
    ?? `${t('settings.color.default')} (${defaultValues.join(' / ')})`;
  return (
    <Popover>
      <Tooltip>
        <PopoverTrigger asChild>
          <TooltipTrigger
            render={
              <SwatchButton
                color={solidColor ?? 'transparent'}
                className={cn('ml-auto', className)}
                swatchClassName={cn(
                  (inherited || composite) && 'relative overflow-hidden shadow-none',
                  inherited &&
                    "after:absolute after:h-px after:w-3 after:-rotate-45 after:bg-muted-foreground after:content-['']"
                )}
                data-color-preview={color ? 'custom' : composite ? 'mixed' : inherited ? 'inherit' : 'default'}
                data-inherited={inherited || undefined}
                aria-label={`${t('settings.color.customize', { setting: label })}: ${colorLabel}`}
              />
            }
          >
            {composite &&
              segments.map((segment, index) => (
                <span
                  key={segment.color ?? `inherited-${index}`}
                  data-color-segment={segment.color ?? 'inherited'}
                  className={cn(
                    'relative h-full min-w-0 flex-1',
                    segment.inherited &&
                      "after:absolute after:left-1/2 after:top-1/2 after:h-px after:w-2 after:-translate-x-1/2 after:-translate-y-1/2 after:-rotate-45 after:bg-muted-foreground after:content-['']"
                  )}
                  style={segment.color ? { backgroundColor: segment.color } : undefined}
                />
              ))}
          </TooltipTrigger>
        </PopoverTrigger>
        <TooltipPopup>{label}</TooltipPopup>
      </Tooltip>
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

const resolveDefaultSegments = (
  source: TextRenderColorDefault,
  theme: TextRenderTheme
): ColorSegment[] => {
  if (source.kind === 'inherit') return [{ inherited: true }];
  if (source.kind === 'token') return [{ color: theme[source.token] }];
  return [
    ...source.tokens.map((token) => ({ color: theme[token] })),
    ...(source.includesInherited ? [{ inherited: true }] : []),
  ];
};

function FeatureColorControls({
  feature,
  label,
  theme,
  colors,
  onPick,
  onReset,
}: {
  feature: TextRenderFeatureDefinition;
  label: string;
  theme: TextRenderTheme;
  colors: Record<string, string>;
  onPick: (slot: string, color: string) => void;
  onReset: (slot: string) => void;
}) {
  const { t } = useUiI18n();
  if (feature.colorSlots.length === 0) {
    return <span className="text-muted-foreground">{t('settings.color.syntax')}</span>;
  }
  return (
    <div className="flex justify-end gap-1">
      {feature.colorSlots.map((slot) => (
        <MarkdownColorControl
          key={slot.id}
          defaultSegments={resolveDefaultSegments(slot.default, theme)}
          label={slot.label ? t(slot.label) : label}
          color={colors[slot.id]}
          className="ml-0"
          onPick={(color) => onPick(slot.id, color)}
          onReset={() => onReset(slot.id)}
        />
      ))}
    </div>
  );
}

export function DisplaySettingsPanel({
  revealSettingId,
  onRevealComplete,
}: DisplaySettingsPanelProps) {
  const { t } = useUiI18n();
  const textRendering = useTextRenderingRuntime();
  const textRenderProfile = useTextRenderProfile();
  const resolvedTheme: TextRenderTheme = {
    ...DEFAULT_TEXT_RENDER_THEME,
    ...textRenderProfile.renderTheme,
  };
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
      { id: 'theme', label: t('settings.renderTheme'), items: themeSettings },
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
        const featureConfig = setting.kind === 'render-feature'
          ? textRenderProfile.features[setting.id] ?? {
              enabled: setting.feature.defaultEnabled,
              colors: {},
            }
          : null;
        if (columnId === 'setting') return t(setting.label);
        if (columnId === 'value') {
          if (setting.kind === 'theme-token') {
            return <span className="text-muted-foreground">—</span>;
          }
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
              checked={featureConfig!.enabled}
              onChange={(event) => {
                textRendering.setProfile({
                  ...textRenderProfile,
                  features: {
                    ...textRenderProfile.features,
                    [setting.id]: {
                      ...featureConfig!,
                      enabled: event.currentTarget.checked,
                    },
                  },
                });
              }}
            />
          );
        }
        return (
          <>
            {setting.kind === 'renderer' ? (
              <span className="text-muted-foreground" aria-hidden="true">
                —
              </span>
            ) : setting.kind === 'theme-token' ? (
              <MarkdownColorControl
                defaultSegments={[{ color: DEFAULT_TEXT_RENDER_THEME[setting.token] }]}
                label={t(setting.label)}
                color={textRenderProfile.renderTheme[setting.token]}
                onPick={(color) =>
                  textRendering.setProfile({
                    ...textRenderProfile,
                    renderTheme: {
                      ...textRenderProfile.renderTheme,
                      [setting.token]: color,
                    },
                  })
                }
                onReset={() => {
                  const renderTheme = { ...textRenderProfile.renderTheme };
                  delete renderTheme[setting.token];
                  textRendering.setProfile({ ...textRenderProfile, renderTheme });
                }}
              />
            ) : (
              <FeatureColorControls
                feature={setting.feature}
                label={t(setting.label)}
                theme={resolvedTheme}
                colors={featureConfig!.colors}
                onPick={(slot, color) => {
                  textRendering.setProfile({
                    ...textRenderProfile,
                    features: {
                      ...textRenderProfile.features,
                      [setting.id]: {
                        ...featureConfig!,
                        colors: { ...featureConfig!.colors, [slot]: color },
                      },
                    },
                  });
                }}
                onReset={(slot) => {
                  const colors = { ...featureConfig!.colors };
                  delete colors[slot];
                  textRendering.setProfile({
                    ...textRenderProfile,
                    features: {
                      ...textRenderProfile.features,
                      [setting.id]: { ...featureConfig!, colors },
                    },
                  });
                }}
              />
            )}
          </>
        );
      }}
    />
  );
}
