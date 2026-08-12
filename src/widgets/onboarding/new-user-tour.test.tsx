import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Config, DriveStep } from "driver.js";
import { useEditorStore } from "@/domains/canvas/testing";
import { EDITOR_PERSISTENCE_KEY } from "@/domains/sessions/public";
import { setUiLanguage } from "@/shared/i18n";
import { useOnboardingTour } from "./onboarding-context";
import { ONBOARDING_STORAGE_KEY } from "./onboarding-model";
import { OnboardingTourProvider } from "./new-user-tour";

const driverMock = vi.hoisted(() => {
  let config: Config = {};
  let steps: DriveStep[] = [];
  const api = {
    isActive: vi.fn(() => true),
    refresh: vi.fn(),
    drive: vi.fn(),
    setConfig: vi.fn((next: Config) => {
      config = next;
    }),
    setSteps: vi.fn((next: DriveStep[]) => {
      steps = next;
    }),
    getConfig: vi.fn(() => config),
    getState: vi.fn(),
    getActiveIndex: vi.fn(),
    isFirstStep: vi.fn(),
    isLastStep: vi.fn(),
    getActiveStep: vi.fn(),
    getActiveElement: vi.fn(),
    getPreviousElement: vi.fn(),
    getPreviousStep: vi.fn(),
    getNextStep: vi.fn(),
    moveNext: vi.fn(),
    movePrevious: vi.fn(),
    moveTo: vi.fn(),
    hasNextStep: vi.fn(),
    hasPreviousStep: vi.fn(),
    highlight: vi.fn(),
    destroy: vi.fn(() => config.onDestroyed?.(undefined, {}, { config, state: {}, driver: api, index: undefined })),
  };
  const factory = vi.fn((next: Config = {}) => {
    config = next;
    return api;
  });
  return {
    api,
    factory,
    getConfig: () => config,
    getSteps: () => steps,
    reset: () => {
      config = {};
      steps = [];
      factory.mockClear();
      Object.values(api).forEach((mock) => mock.mockClear());
      api.isActive.mockReturnValue(true);
    },
  };
});

vi.mock("driver.js", () => ({ driver: driverMock.factory }));

function TourHarness() {
  const { requestStart } = useOnboardingTour();
  return (
    <>
      <div data-onboarding-target="canvas" />
      <button type="button" onClick={requestStart}>Start tour</button>
    </>
  );
}

async function flushTourStart() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
    await vi.dynamicImportSettled();
  });
}

describe("OnboardingTourProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    driverMock.reset();
    window.localStorage.clear();
    setUiLanguage("en");
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    setUiLanguage("en");
    window.localStorage.clear();
  });

  it("automatically starts an eight-step tour for a new desktop user", async () => {
    render(
      <OnboardingTourProvider>
        <TourHarness />
      </OnboardingTourProvider>
    );

    await flushTourStart();

    expect(driverMock.factory).toHaveBeenCalledOnce();
    expect(driverMock.api.drive).toHaveBeenCalledOnce();
    expect(driverMock.getSteps()).toHaveLength(8);
    expect(driverMock.getSteps()[1].element).toBe(
      '[data-onboarding-target="character-library"]'
    );
    expect(driverMock.getSteps()[0].element).toBeUndefined();
    expect(
      driverMock
        .getSteps()
        .some((step) =>
          [
            '[data-onboarding-target="app-menu"]',
            '[data-onboarding-target="language-menu"]',
            '[data-onboarding-target="language-options"]',
          ].includes(String(step.element))
        )
    ).toBe(false);
  });

  it("omits the freeform character guide outside freeform mode", async () => {
    useEditorStore.setState({ canvasMode: "structured" });
    window.localStorage.removeItem(EDITOR_PERSISTENCE_KEY);
    render(
      <OnboardingTourProvider>
        <TourHarness />
      </OnboardingTourProvider>
    );

    await flushTourStart();

    expect(driverMock.getSteps()).toHaveLength(7);
    expect(
      driverMock
        .getSteps()
        .some((step) => step.element === '[data-onboarding-target="character-library"]')
    ).toBe(false);
  });

  it.each([
    [ONBOARDING_STORAGE_KEY, "dismissed"],
    [ONBOARDING_STORAGE_KEY, "completed"],
    [EDITOR_PERSISTENCE_KEY, "{}"],
  ])("does not auto-start when %s exists", async (key, value) => {
    window.localStorage.setItem(key, value);
    render(
      <OnboardingTourProvider>
        <TourHarness />
      </OnboardingTourProvider>
    );

    await flushTourStart();
    expect(driverMock.factory).not.toHaveBeenCalled();
  });

  it("allows a manual replay despite a completed marker", async () => {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "completed");
    render(
      <OnboardingTourProvider>
        <TourHarness />
      </OnboardingTourProvider>
    );
    await flushTourStart();

    fireEvent.click(screen.getByRole("button", { name: "Start tour" }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(driverMock.factory).toHaveBeenCalledOnce();
  });

  it("records explicit dismissal and successful completion separately", async () => {
    render(
      <OnboardingTourProvider>
        <TourHarness />
      </OnboardingTourProvider>
    );
    await flushTourStart();

    act(() => driverMock.getConfig().onCloseClick?.(undefined, {}, {
      config: driverMock.getConfig(),
      state: {},
      driver: driverMock.api,
      index: 0,
    }));
    expect(window.localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe("dismissed");

    driverMock.api.isActive.mockReturnValue(false);
    fireEvent.click(screen.getByRole("button", { name: "Start tour" }));
    await act(async () => {
      await Promise.resolve();
    });
    const finalStep = driverMock.getSteps().at(-1);
    act(() => finalStep?.popover?.onDoneClick?.(undefined, finalStep, {
      config: driverMock.getConfig(),
      state: {},
      driver: driverMock.api,
      index: driverMock.getSteps().length - 1,
    }));
    expect(window.localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe("completed");
  });

  it("ignores overlay clicks without dismissing the tour", async () => {
    render(
      <OnboardingTourProvider>
        <TourHarness />
      </OnboardingTourProvider>
    );
    await flushTourStart();

    const overlayClickBehavior = driverMock.getConfig().overlayClickBehavior;
    expect(overlayClickBehavior).toBeTypeOf("function");
    if (typeof overlayClickBehavior === "function") {
      act(() => overlayClickBehavior(undefined, {}, {
        config: driverMock.getConfig(),
        state: {},
        driver: driverMock.api,
        index: 1,
      }));
    }

    expect(driverMock.api.destroy).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBeNull();
  });

  it("keeps the drag step actionable and offers a skip path", async () => {
    render(
      <OnboardingTourProvider>
        <TourHarness />
      </OnboardingTourProvider>
    );
    await flushTourStart();

    const dragStep = driverMock
      .getSteps()
      .find((step) => step.popover?.nextBtnText === "Skip this step");
    expect(dragStep).toBeDefined();
    if (!dragStep) throw new Error("Drag step missing");
    expect(dragStep.element).toBe('[data-onboarding-template-id="button"]');
    expect(dragStep.popover?.nextBtnText).toBe("Skip this step");

    act(() => dragStep.onHighlighted?.(undefined, dragStep, {
      config: driverMock.getConfig(),
      state: {},
      driver: driverMock.api,
      index: driverMock.getSteps().indexOf(dragStep),
    }));
    expect(document.documentElement).toHaveAttribute(
      "data-onboarding-phase",
      "drag"
    );

    act(() => dragStep.popover?.onNextClick?.(undefined, dragStep, {
      config: driverMock.getConfig(),
      state: {},
      driver: driverMock.api,
      index: driverMock.getSteps().indexOf(dragStep),
    }));
    expect(driverMock.api.moveNext).toHaveBeenCalledOnce();
  });
});
