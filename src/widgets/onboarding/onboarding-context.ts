import { createContext, useContext } from "react";

export type OnboardingPhase =
  | "idle"
  | "welcome"
  | "app-menu"
  | "language-menu"
  | "language-choice"
  | "canvas-selector"
  | "create-menu"
  | "structured-create"
  | "preparing-template"
  | "template"
  | "drag"
  | "complete";

export type OnboardingTourContextValue = {
  phase: OnboardingPhase;
  canStart: boolean;
  requestStart: () => void;
  notifyLanguageSelected: () => void;
};

export const OnboardingTourContext = createContext<OnboardingTourContextValue>({
  phase: "idle",
  canStart: false,
  requestStart: () => undefined,
  notifyLanguageSelected: () => undefined,
});

export function useOnboardingTour() {
  return useContext(OnboardingTourContext);
}
