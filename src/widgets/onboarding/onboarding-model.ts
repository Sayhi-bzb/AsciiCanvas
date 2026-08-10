import { EDITOR_PERSISTENCE_KEY } from "@/domains/sessions/public";

export const ONBOARDING_STORAGE_KEY = "ascii-canvas-onboarding-v1";

let hadEditorPersistenceAtEntry: boolean | undefined;

function hasEditorPersistence() {
  try {
    return window.localStorage.getItem(EDITOR_PERSISTENCE_KEY) !== null;
  } catch {
    return false;
  }
}

export function captureOnboardingEntryState() {
  if (hadEditorPersistenceAtEntry === undefined) {
    hadEditorPersistenceAtEntry = hasEditorPersistence();
  }
}

export function hadEditorPersistenceOnEntry() {
  return hadEditorPersistenceAtEntry ?? hasEditorPersistence();
}

export function shouldAutoStartOnboarding({
  isMobile,
  hasEditorPersistence,
  status,
}: {
  isMobile: boolean;
  hasEditorPersistence: boolean;
  status: string | null;
}) {
  return !isMobile && !hasEditorPersistence && status === null;
}
