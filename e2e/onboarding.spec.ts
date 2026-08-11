import { expect, test, type Page } from '@playwright/test';

const ONBOARDING_STORAGE_KEY = 'ascii-canvas-onboarding-v1';
const TOUR_TRANSITION_MS = 350;

test.use({
  storageState: {
    cookies: [],
    origins: [],
  },
});

const getStructuredComponentCount = (page: Page) =>
  page.evaluate(() => {
    const raw = localStorage.getItem('ascii-canvas-persistence');
    if (!raw) return 0;
    const state = JSON.parse(raw).state;
    return (
      state?.workspace?.structuredComponents?.length ??
      state?.structuredComponents?.length ??
      0
    );
  });

async function reachDragStep(page: Page, testWrongClicks = false) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  const popover = page.locator('.ascii-canvas-onboarding');
  await expect(popover.getByText("Your canvas")).toBeVisible({ timeout: 15_000 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.onboardingPhase))
    .toBe("welcome");
  const welcomeVisual = await page.evaluate(() => {
    const card = document.querySelector<HTMLElement>(".ascii-canvas-onboarding");
    const canvas = document.querySelector<HTMLElement>(
      "[data-onboarding-target=\"canvas\"]",
    );
    const dummy = document.querySelector<HTMLElement>("#driver-dummy-element");
    const overlayPath = document.querySelector<SVGPathElement>(".driver-overlay path");
    if (!card || !canvas || !dummy || !overlayPath) return null;

    const cardBox = card.getBoundingClientRect();
    return {
      canvasActive: canvas.classList.contains("driver-active-element"),
      dummyActive: dummy.classList.contains("driver-active-element"),
      overlayFill: getComputedStyle(overlayPath).fill,
      overlayOpacity: Number(getComputedStyle(overlayPath).opacity),
      centerOffsetX: Math.abs(
        cardBox.left + cardBox.width / 2 - window.innerWidth / 2,
      ),
      centerOffsetY: Math.abs(
        cardBox.top + cardBox.height / 2 - window.innerHeight / 2,
      ),
      arrowHidden: card.querySelector(".driver-popover-arrow-none") !== null,
    };
  });
  expect(welcomeVisual).not.toBeNull();
  expect(welcomeVisual!.canvasActive).toBe(false);
  expect(welcomeVisual!.dummyActive).toBe(true);
  expect(welcomeVisual!.overlayFill).toBe("rgb(0, 0, 0)");
  expect(welcomeVisual!.overlayOpacity).toBe(0.48);
  expect(welcomeVisual!.centerOffsetX).toBeLessThanOrEqual(2);
  expect(welcomeVisual!.centerOffsetY).toBeLessThanOrEqual(2);
  expect(welcomeVisual!.arrowHidden).toBe(true);

  await popover.getByRole("button", { name: "Next" }).click();
  await expect(popover.getByText('Character libraries')).toBeVisible();
  const characterRail = page.locator(
    '[data-onboarding-target="character-library"]',
  );
  await expect(characterRail).toBeVisible();
  await expect(characterRail).toHaveClass(/driver-active-element/);

  if (testWrongClicks) {
    await page.mouse.click(900, 780);
    await expect(popover.getByText('Character libraries')).toBeVisible();

    const zoomInBounds = await page.getByRole('button', { name: 'Zoom in' }).boundingBox();
    expect(zoomInBounds).not.toBeNull();
    await page.mouse.click(
      zoomInBounds!.x + zoomInBounds!.width / 2,
      zoomInBounds!.y + zoomInBounds!.height / 2,
    );
    await expect(popover.getByText('Character libraries')).toBeVisible();
  }

  const editorStateBeforeLibrary = await page.evaluate(() =>
    localStorage.getItem('ascii-canvas-persistence'),
  );
  await expect(page.getByRole('tab', { name: 'Nerd Icons' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Emoji' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Unicode' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Essentials' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await popover.getByRole('button', { name: 'Next' }).click();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('ascii-canvas-persistence')))
    .toBe(editorStateBeforeLibrary);
  await expect(popover.getByText('Canvas modes')).toBeVisible();
  await page.waitForTimeout(TOUR_TRANSITION_MS);
  await page.locator('[data-onboarding-target="canvas-selector"]').click();
  await expect(popover.getByText('Create a canvas')).toBeVisible();
  await page.waitForTimeout(TOUR_TRANSITION_MS);
  await page.locator('[data-onboarding-target="create-menu"]').click();
  await expect(popover.getByText('Structured Canvas', { exact: true })).toBeVisible();
  await page.waitForTimeout(TOUR_TRANSITION_MS);
  await page.locator('[data-onboarding-target="create-structured"]').click();

  await expect(popover.getByText('Button component')).toBeVisible();
  await popover.getByRole('button', { name: 'Next' }).click();
  await expect(popover.getByText('Drag your first component')).toBeVisible();
  await page.waitForTimeout(TOUR_TRANSITION_MS);

  return popover;
}

test('keeps wrong clicks inside the guide and completes a real Button drag', async ({ page }) => {
  test.setTimeout(60_000);
  const popover = await reachDragStep(page, true);

  const template = page.locator('[data-onboarding-template-id="button"]');
  const canvas = page.locator("[data-onboarding-target=\"canvas\"]");
  const footerButton = popover.getByRole("button", { name: "Skip this step" });
  const guideSurface = await page.evaluate(() => {
    const card = document.querySelector<HTMLElement>(".ascii-canvas-onboarding");
    const button = card?.querySelector<HTMLElement>(".driver-popover-footer-btn");
    if (!card || !button) return null;

    const cardStyle = getComputedStyle(card);
    const buttonStyle = getComputedStyle(button);
    return {
      cardBorderWidth: cardStyle.borderTopWidth,
      buttonBorderWidth: buttonStyle.borderTopWidth,
      buttonBackground: buttonStyle.backgroundColor,
    };
  });
  expect(guideSurface).not.toBeNull();
  expect(guideSurface!.cardBorderWidth).toBe("0px");
  expect(guideSurface!.buttonBorderWidth).toBe("0px");
  expect(guideSurface!.buttonBackground).not.toBe("rgba(0, 0, 0, 0)");

  await page.mouse.move(0, 0);
  await footerButton.evaluate((element) => element.blur());
  const restingButtonBackground = await footerButton.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  await footerButton.hover();
  await expect
    .poll(() => footerButton.evaluate((element) => getComputedStyle(element).backgroundColor))
    .not.toBe(restingButtonBackground);
  const guideColors = await page.evaluate(() => {
    const templateElement = document.querySelector<HTMLElement>(
      "[data-onboarding-template-id=\"button\"]",
    );
    const canvasElement = document.querySelector<HTMLElement>(
      "[data-onboarding-target=\"canvas\"]",
    );
    if (!templateElement || !canvasElement) return null;

    const templateStyle = getComputedStyle(templateElement);
    const canvasColorLayer = getComputedStyle(canvasElement, "::after");
    return {
      templateBackground: templateStyle.backgroundColor,
      templateOutline: templateStyle.outlineStyle,
      templateShadow: templateStyle.boxShadow,
      templateAnimation: templateStyle.animationName,
      canvasBackground: canvasColorLayer.backgroundColor,
      canvasPointerEvents: canvasColorLayer.pointerEvents,
    };
  });
  expect(guideColors).not.toBeNull();
  expect(guideColors!.templateBackground).not.toBe("rgba(0, 0, 0, 0)");
  expect(guideColors!.templateOutline).toBe("none");
  expect(guideColors!.templateShadow).toBe("none");
  expect(guideColors!.templateAnimation).toBe("none");
  expect(guideColors!.canvasBackground).not.toBe("rgba(0, 0, 0, 0)");
  expect(guideColors!.canvasPointerEvents).toBe("none");
  const templateBounds = await template.boundingBox();
  const canvasBounds = await canvas.boundingBox();
  expect(templateBounds).not.toBeNull();
  expect(canvasBounds).not.toBeNull();

  await page.mouse.move(
    templateBounds!.x + templateBounds!.width / 2,
    templateBounds!.y + templateBounds!.height / 2,
  );
  await page.mouse.down();
  await page.waitForTimeout(100);
  await page.mouse.move(
    templateBounds!.x + templateBounds!.width / 2 - 16,
    templateBounds!.y + templateBounds!.height / 2,
    { steps: 4 },
  );
  await page.mouse.move(canvasBounds!.x + 640, canvasBounds!.y + 360, {
    steps: 20,
  });
  await page.waitForTimeout(100);
  await page.mouse.up();

  await expect(popover.getByText('You are ready')).toBeVisible();
  await expect.poll(() => getStructuredComponentCount(page)).toBe(1);
  await popover.getByRole('button', { name: 'Start creating' }).click();
  await expect(popover).toHaveCount(0);
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), ONBOARDING_STORAGE_KEY)).toBe('completed');

  await page.reload();
  await expect(popover).toHaveCount(0);
});

test('allows the drag step to be skipped without adding a component', async ({ page }) => {
  test.setTimeout(60_000);
  const popover = await reachDragStep(page);

  await expect.poll(() => getStructuredComponentCount(page)).toBe(0);
  await popover.getByRole('button', { name: 'Skip this step' }).click();
  await expect(popover.getByText('You are ready')).toBeVisible();
  await expect.poll(() => getStructuredComponentCount(page)).toBe(0);

  await popover.getByRole('button', { name: 'Start creating' }).click();
  await expect.poll(() =>
    page.evaluate((key) => localStorage.getItem(key), ONBOARDING_STORAGE_KEY)
  ).toBe('completed');
});
