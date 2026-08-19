'use client';

import { RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditorKeymapSnapshot } from '@/domains/editor/public';
import { useUiI18n } from '@/shared/i18n';
import { HOST_ICONOLOGY } from '@/shared/icons/iconology';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/shared/ui/dialog';
import { Label } from '@/shared/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';
import {
  KeyboardShortcutsPanel,
  type KeyboardShortcutsPanelHandle,
} from './keyboard-shortcuts-dialog';
import { SettingsContentSection } from './settings-content-section';
import { SettingsNavigation } from './settings-navigation';
import {
  getSettingsSearchResults,
  type SettingsSearchResult,
  type SettingsSection,
  type SettingsTarget,
} from './settings-search';

type SettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const GeneralIcon = HOST_ICONOLOGY.appMenu.language;
const ShortcutsIcon = HOST_ICONOLOGY.appMenu.shortcuts;

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { language, setLanguage, t } = useUiI18n();
  const keymapSnapshot = useEditorKeymapSnapshot();
  const [section, setSection] = useState<SettingsSection>('general');
  const [shortcutDirty, setShortcutDirty] = useState(false);
  const [shortcutRecording, setShortcutRecording] = useState(false);
  const [shortcutResettable, setShortcutResettable] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [revealTarget, setRevealTarget] = useState<NonNullable<SettingsTarget['focus']> | null>(
    null
  );
  const searchResults = useMemo(
    () => getSettingsSearchResults(searchQuery, keymapSnapshot.entries, t),
    [keymapSnapshot.entries, searchQuery, t]
  );
  const shortcutPanelRef = useRef<KeyboardShortcutsPanelHandle>(null);
  const navigationItems = [
    {
      value: 'general',
      title: t('settings.general'),
      icon: GeneralIcon,
    },
    {
      value: 'shortcuts',
      title: t('appMenu.shortcuts'),
      icon: ShortcutsIcon,
    },
  ] as const;

  useEffect(() => {
    if (section !== 'general' || revealTarget?.type !== 'language') return;
    const frame = requestAnimationFrame(() => {
      const control = document.getElementById('settings-language');
      if (typeof control?.scrollIntoView === 'function') {
        control.scrollIntoView({ block: 'nearest' });
      }
      control?.focus();
      setRevealTarget(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [revealTarget, section]);

  useEffect(() => {
    if (!open || !shortcutDirty) return;
    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', preventUnload);
    return () => window.removeEventListener('beforeunload', preventUnload);
  }, [open, shortcutDirty]);

  const showTarget = (target: SettingsTarget) => {
    if (section === 'shortcuts' && shortcutDirty) return;
    setSearchQuery('');
    setSection(target.section);
    setRevealTarget(target.focus ?? null);
  };

  const changeOpen = (nextOpen: boolean) => {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }
    if (section === 'shortcuts' && shortcutDirty) return;
    setSection('general');
    setSearchQuery('');
    setRevealTarget(null);
    onOpenChange(false);
  };

  const changeSection = (nextSection: SettingsSection) => {
    if (nextSection === section) return;
    showTarget({ section: nextSection });
  };

  const selectSearchResult = (result: SettingsSearchResult) => {
    showTarget(result.target);
  };

  const saveShortcuts = () => shortcutPanelRef.current?.save();
  const discardShortcuts = () => shortcutPanelRef.current?.discard();
  const resetShortcuts = () => shortcutPanelRef.current?.reset();

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent
        showCloseButton={false}
        className="h-[min(34rem,calc(100vh-2rem))] grid-rows-[minmax(0,1fr)] gap-0 sm:max-w-[840px]"
        onEscapeKeyDown={(event) => {
          if (searchQuery.trim() || shortcutRecording || shortcutDirty) event.preventDefault();
        }}
      >
        <DialogTitle className="sr-only">{t('settings.title')}</DialogTitle>
        <div
          data-slot="settings-layout"
          className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_2.25rem] overflow-hidden lg:grid-cols-[11rem_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)_2.25rem] lg:gap-x-4"
        >
          <aside className="min-h-0 min-w-0 lg:row-span-2">
            <SettingsNavigation
              label={t('settings.navigation')}
              items={navigationItems}
              value={section}
              onValueChange={changeSection}
              search={{
                label: t('settings.search'),
                placeholder: t('settings.searchPlaceholder'),
                resultsLabel: t('settings.searchResults'),
                noResultsLabel: t('settings.noSearchResults'),
                query: searchQuery,
                results: searchResults,
                onQueryChange: setSearchQuery,
                onResultSelect: selectSearchResult,
              }}
            />
          </aside>
          <div
            data-slot="settings-content"
            className="flex min-h-0 min-w-0 overflow-hidden p-1 pt-2 lg:col-start-2 lg:row-start-1 lg:pt-1"
          >
            {section === 'general' ? (
              <SettingsContentSection heading={t('settings.general')}>
                <div className="flex min-w-72 items-center justify-between gap-6 py-2">
                  <Label htmlFor="settings-language" className="whitespace-nowrap">
                    {t('appMenu.language')}
                  </Label>
                  <Select
                    value={language}
                    onValueChange={(value) => setLanguage(value as 'en' | 'zh')}
                  >
                    <SelectTrigger id="settings-language" className="w-40 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="start" position="popper">
                      <SelectGroup>
                        <SelectItem value="en">{t('appMenu.english')}</SelectItem>
                        <SelectItem value="zh">{t('appMenu.chinese')}</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </SettingsContentSection>
            ) : (
              <SettingsContentSection heading={t('shortcutEditor.title')}>
                <KeyboardShortcutsPanel
                  ref={shortcutPanelRef}
                  revealEntryId={revealTarget?.type === 'shortcut' ? revealTarget.entryId : null}
                  onRevealComplete={() => setRevealTarget(null)}
                  onDirtyChange={setShortcutDirty}
                  onRecordingChange={setShortcutRecording}
                  onResettableChange={setShortcutResettable}
                />
              </SettingsContentSection>
            )}
          </div>
          <DialogFooter className="h-9 min-w-0 flex-row items-center justify-between gap-2 overflow-hidden lg:col-start-2 lg:row-start-2">
            {shortcutDirty ? (
              <>
                <div className="flex min-w-0 items-center gap-2">
                  <Button
                    type="button"
                    tone="subtle"
                    size="xs"
                    disabled={shortcutRecording || !shortcutResettable}
                    onClick={resetShortcuts}
                  >
                    <RotateCcw data-icon="inline-start" />
                    {t('shortcutEditor.resetAll')}
                  </Button>
                  <span
                    role="status"
                    aria-live="polite"
                    className="truncate text-xs leading-4 text-muted-foreground"
                  >
                    {t('shortcutEditor.unsaved')}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    tone="subtle"
                    size="xs"
                    disabled={shortcutRecording}
                    onClick={discardShortcuts}
                  >
                    {t('shortcutEditor.discard')}
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    disabled={shortcutRecording}
                    onClick={saveShortcuts}
                  >
                    {t('shortcutEditor.save')}
                  </Button>
                </div>
              </>
            ) : null}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
