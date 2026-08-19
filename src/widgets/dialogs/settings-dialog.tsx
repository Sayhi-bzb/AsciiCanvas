'use client';

import { useEffect, useRef, useState } from 'react';
import { useUiI18n } from '@/shared/i18n';
import { HOST_ICONOLOGY } from '@/shared/icons/iconology';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog';
import { Button } from '@/shared/ui/button';
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
import {
  KeyboardShortcutsPanel,
  type KeyboardShortcutsPanelHandle,
} from './keyboard-shortcuts-dialog';
import { SettingsContentSection } from './settings-content-section';
import { SettingsNavigation } from './settings-navigation';

type SettingsSection = 'general' | 'shortcuts';

type PendingTransition = { type: 'close' } | { type: 'section'; section: SettingsSection };

type SettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const GeneralIcon = HOST_ICONOLOGY.appMenu.language;
const ShortcutsIcon = HOST_ICONOLOGY.appMenu.shortcuts;

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { language, setLanguage, t } = useUiI18n();
  const [section, setSection] = useState<SettingsSection>('general');
  const [shortcutDirty, setShortcutDirty] = useState(false);
  const [shortcutRecording, setShortcutRecording] = useState(false);
  const [shortcutValid, setShortcutValid] = useState(true);
  const [pendingTransition, setPendingTransition] = useState<PendingTransition | null>(null);
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
    if (!open || !shortcutDirty) return;
    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', preventUnload);
    return () => window.removeEventListener('beforeunload', preventUnload);
  }, [open, shortcutDirty]);

  const finishTransition = (transition: PendingTransition) => {
    setPendingTransition(null);
    setShortcutDirty(false);
    setShortcutRecording(false);
    if (transition.type === 'close') {
      setSection('general');
      onOpenChange(false);
      return;
    }
    setSection(transition.section);
  };

  const requestTransition = (transition: PendingTransition) => {
    if (shortcutRecording) return;
    if (section === 'shortcuts' && shortcutDirty) {
      setPendingTransition(transition);
      return;
    }
    finishTransition(transition);
  };

  const changeOpen = (nextOpen: boolean) => {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }
    requestTransition({ type: 'close' });
  };

  const changeSection = (nextSection: SettingsSection) => {
    if (nextSection === section) return;
    requestTransition({ type: 'section', section: nextSection });
  };

  const saveShortcuts = () => {
    shortcutPanelRef.current?.save();
  };

  const saveAndContinue = () => {
    if (!pendingTransition || !shortcutValid) return;
    shortcutPanelRef.current?.save();
    finishTransition(pendingTransition);
  };

  const discardAndContinue = () => {
    if (!pendingTransition) return;
    finishTransition(pendingTransition);
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent
        showCloseButton={false}
        className="h-[min(34rem,calc(100vh-2rem))] grid-rows-[minmax(0,1fr)] gap-0 sm:max-w-[840px]"
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
              onValueChange={changeSection}
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
              <SettingsContentSection
                heading={t('shortcutEditor.title')}
                footer={
                  shortcutDirty ? (
                    <div className="flex items-center justify-between gap-3">
                      <span
                        role="status"
                        aria-live="polite"
                        className="text-xs leading-4 text-muted-foreground"
                      >
                        {t('shortcutEditor.unsaved')}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        disabled={shortcutRecording || !shortcutValid}
                        onClick={saveShortcuts}
                      >
                        {t('shortcutEditor.save')}
                      </Button>
                    </div>
                  ) : undefined
                }
              >
                <KeyboardShortcutsPanel
                  ref={shortcutPanelRef}
                  onDirtyChange={setShortcutDirty}
                  onRecordingChange={setShortcutRecording}
                  onValidityChange={setShortcutValid}
                />
              </SettingsContentSection>
            )}
          </div>
        </div>
      </DialogContent>

      <AlertDialog
        open={pendingTransition !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPendingTransition(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('shortcutEditor.unsavedDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('shortcutEditor.unsavedDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('dialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction tone="danger" onClick={discardAndContinue}>
              {t('shortcutEditor.discard')}
            </AlertDialogAction>
            <AlertDialogAction disabled={!shortcutValid} onClick={saveAndContinue}>
              {t('shortcutEditor.save')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
