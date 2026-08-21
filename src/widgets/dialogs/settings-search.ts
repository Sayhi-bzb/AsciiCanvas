import { formatShortcutLabel } from '@/domains/actions/public';
import { TEXT_RENDER_FEATURES } from '@/domains/document/public';
import type { KeymapBindingSnapshot } from '@/domains/editor/public';
import type { I18nKey } from '@/shared/i18n';
import {
  getShortcutCategory,
  getShortcutCategoryLabel,
  getShortcutCommandLabel,
  getShortcutScopeLabel,
} from './editor-shortcut-catalog';

export type SettingsSection = 'general' | 'display' | 'shortcuts';

export type SettingsTarget = {
  section: SettingsSection;
  focus?:
    | { type: 'language' }
    | { type: 'text-renderer' }
    | { type: 'shortcut'; entryId: string };
};

export type SettingsSearchResult = {
  id: string;
  group: SettingsSection;
  groupTitle: string;
  title: string;
  target: SettingsTarget;
  searchText: string;
};

type Translate = (key: I18nKey, params?: Record<string, string | number>) => string;

const searchable = (values: readonly string[]) => values.join(' ').toLocaleLowerCase();

export const getSettingsSearchResults = (
  query: string,
  entries: readonly KeymapBindingSnapshot[],
  t: Translate
) => {
  const generalTitle = t('settings.general');
  const shortcutsTitle = t('appMenu.shortcuts');
  const displayTitle = t('settings.display');
  const languageTitle = t('appMenu.language');
  const results: SettingsSearchResult[] = [
    {
      id: 'section:general',
      group: 'general',
      groupTitle: generalTitle,
      title: generalTitle,
      target: { section: 'general' },
      searchText: searchable([generalTitle]),
    },
    {
      id: 'setting:language',
      group: 'general',
      groupTitle: generalTitle,
      title: languageTitle,
      target: { section: 'general', focus: { type: 'language' } },
      searchText: searchable([
        languageTitle,
        t('appMenu.english'),
        t('appMenu.chinese'),
        'English',
        '中文',
      ]),
    },
    {
      id: 'section:display',
      group: 'display',
      groupTitle: displayTitle,
      title: displayTitle,
      target: { section: 'display' },
      searchText: searchable([
        displayTitle,
        t('settings.textRenderer'),
        t('settings.column.color'),
        'ANSI',
        'Markdown',
        'Raw',
      ]),
    },
    {
      id: 'setting:text-renderer',
      group: 'display',
      groupTitle: displayTitle,
      title: t('settings.textRenderer'),
      target: { section: 'display', focus: { type: 'text-renderer' } },
      searchText: searchable([
        t('settings.textRenderer'),
        t('settings.renderTheme'),
        t('settings.renderTheme.accent'),
        t('settings.renderTheme.info'),
        t('settings.renderTheme.success'),
        t('settings.renderTheme.warning'),
        t('settings.renderTheme.danger'),
        t('settings.renderTheme.muted'),
        t('settings.renderTheme.surface'),
        t('settings.markdownRules'),
        t('settings.column.color'),
        ...TEXT_RENDER_FEATURES.map((feature) => t(feature.label)),
        'ANSI',
        'Markdown',
        'Raw',
      ]),
    },
    {
      id: 'section:shortcuts',
      group: 'shortcuts',
      groupTitle: shortcutsTitle,
      title: shortcutsTitle,
      target: { section: 'shortcuts' },
      searchText: searchable([shortcutsTitle, t('shortcutEditor.title')]),
    },
    ...entries
      .filter((entry) => entry.configurable)
      .map((entry): SettingsSearchResult => {
        const title = getShortcutCommandLabel(entry, t);
        const category = getShortcutCategory(entry.category);
        const categoryLabel = getShortcutCategoryLabel(category, t);
        const scopeLabel = getShortcutScopeLabel(entry.scope, t);
        const shortcuts = entry.shortcuts.map((shortcut) => formatShortcutLabel(shortcut));
        return {
          id: `shortcut:${entry.id}`,
          group: 'shortcuts',
          groupTitle: shortcutsTitle,
          title,
          target: { section: 'shortcuts', focus: { type: 'shortcut', entryId: entry.id } },
          searchText: searchable([title, categoryLabel, scopeLabel, ...shortcuts]),
        };
      }),
  ];
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return normalizedQuery
    ? results.filter((result) => result.searchText.includes(normalizedQuery))
    : [];
};
