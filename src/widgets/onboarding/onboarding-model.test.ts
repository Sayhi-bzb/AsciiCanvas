import { describe, expect, it } from "vitest";
import { shouldAutoStartOnboarding } from "./onboarding-model";

describe("shouldAutoStartOnboarding", () => {
  it("starts only for a new desktop user", () => {
    expect(
      shouldAutoStartOnboarding({
        isMobile: false,
        hasEditorPersistence: false,
        status: null,
      })
    ).toBe(true);
  });

  it.each([
    { isMobile: true, hasEditorPersistence: false, status: null },
    { isMobile: false, hasEditorPersistence: true, status: null },
    { isMobile: false, hasEditorPersistence: false, status: "dismissed" },
    { isMobile: false, hasEditorPersistence: false, status: "completed" },
  ])("does not start for an ineligible visit", (input) => {
    expect(shouldAutoStartOnboarding(input)).toBe(false);
  });
});
