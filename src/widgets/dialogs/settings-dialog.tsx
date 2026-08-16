'use client';

import { useState } from 'react';
import { useUiI18n } from '@/shared/i18n';
import { HOST_ICONOLOGY } from '@/shared/icons/iconology';
import { Dialog, DialogContent, DialogTitle } from '@/shared/ui/dialog';
import { Label } from '@/shared/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';
import { KeyboardShortcutsPanel } from './keyboard-shortcuts-dialog';
import { SettingsContentSection } from './settings-content-section';
import { SettingsNavigation } from './settings-navigation';

type SettingsSection = 'general' | 'shortcuts';

type SettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const GeneralIcon = HOST_ICONOLOGY.appMenu.language;
const ShortcutsIcon = HOST_ICONOLOGY.appMenu.shortcuts;

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { language, setLanguage, t } = useUiI18n();
  const [section, setSection] = useState<SettingsSection>('general');
  const [shortcutRecording, setShortcutRecording] = useState(false);
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

  const changeOpen = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSection('general');
      setShortcutRecording(false);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent
        showCloseButton={false}
        className="h-[min(34rem,calc(100vh-2rem))] grid-rows-[minmax(0,1fr)] gap-0 sm:max-w-[720px]"
        onEscapeKeyDown={(event) => {
          if (shortcutRecording) event.preventDefault();
        }}
      >
        <DialogTitle className="sr-only">{t('settings.title')}</DialogTitle>
        <div
          data-slot="settings-layout"
          className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden lg:grid-cols-[11rem_minmax(0,1fr)] lg:grid-rows-1 lg:gap-4"
        >
          <aside className="min-w-0">
            <SettingsNavigation
              label={t('settings.navigation')}
              items={navigationItems}
              value={section}
              onValueChange={setSection}
            />
          </aside>
          <div
            data-slot="settings-content"
            className="flex min-h-0 min-w-0 overflow-hidden p-1 pt-2 lg:pt-1"
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
                <KeyboardShortcutsPanel onRecordingChange={setShortcutRecording} />
              </SettingsContentSection>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
