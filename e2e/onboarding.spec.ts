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
  await expect(popover.getByText('Your canvas')).toBeVisible({ timeout: 15_000 });
  await popover.getByRole('button', { name: 'Next' }).click();
  await expect(popover.getByText('App menu', { exact: true })).toBeVisible();
  await page.waitForTimeout(TOUR_TRANSITION_MS);

  if (testWrongClicks) {
    await page.mouse.click(900, 780);
    await expect(popover.getByText('App menu', { exact: true })).toBeVisible();

    const zoomInBounds = await page.getByRole('button', { name: 'Zoom in' }).boundingBox();
    expect(zoomInBounds).not.toBeNull();
    await page.mouse.click(
      zoomInBounds!.x + zoomInBounds!.width / 2,
      zoomInBounds!.y + zoomInBounds!.height / 2,
    );
    await expect(popover.getByText('App menu', { exact: true })).toBeVisible();
  }

  await page.locator('[data-onboarding-target="app-menu"]').click();
  await expect(popover.getByText('Language', { exact: true })).toBeVisible();
  await page.waitForTimeout(TOUR_TRANSITION_MS);
  await page.locator('[data-onboarding-target="language-menu"]').click();
  await expect(popover.getByText('Choose your language')).toBeVisible();
  await page.waitForTimeout(TOUR_TRANSITION_MS);
  await page.locator('[data-onboarding-language="zh"]').click();

  await expect(popover.getByText('画布模式')).toBeVisible();
  await page.waitForTimeout(TOUR_TRANSITION_MS);
  await page.locator('[data-onboarding-target="canvas-selector"]').click();
  await expect(popover.getByText('新建画布')).toBeVisible();
  await page.waitForTimeout(TOUR_TRANSITION_MS);
  await page.locator('[data-onboarding-target="create-menu"]').click();
  await expect(popover.getByText('结构化画布', { exact: true })).toBeVisible();
  await page.waitForTimeout(TOUR_TRANSITION_MS);
  await page.locator('[data-onboarding-target="create-structured"]').click();

  await expect(popover.getByText('Button 组件')).toBeVisible();
  await popover.getByRole('button', { name: '下一步' }).click();
  await expect(popover.getByText('拖入第一个组件')).toBeVisible();
  await page.waitForTimeout(TOUR_TRANSITION_MS);

  return popover;
}

test('keeps wrong clicks inside the guide and completes a real Button drag', async ({ page }) => {
  test.setTimeout(60_000);
  const popover = await reachDragStep(page, true);

  const template = page.locator('[data-onboarding-template-id="button"]');
  const canvas = page.locator("[data-onboarding-target=\"canvas\"]");
  const footerButton = popover.getByRole("button", { name: "跳过此步" });
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

  await expect(popover.getByText('可以开始了')).toBeVisible();
  await expect.poll(() => getStructuredComponentCount(page)).toBe(1);
  await popover.getByRole('button', { name: '开始创作' }).click();
  await expect(popover).toHaveCount(0);
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), ONBOARDING_STORAGE_KEY)).toBe('completed');

  await page.reload();
  await expect(popover).toHaveCount(0);
});

test('allows the drag step to be skipped without adding a component', async ({ page }) => {
  test.setTimeout(60_000);
  const popover = await reachDragStep(page);

  await expect.poll(() => getStructuredComponentCount(page)).toBe(0);
  await popover.getByRole('button', { name: '跳过此步' }).click();
  await expect(popover.getByText('可以开始了')).toBeVisible();
  await expect.poll(() => getStructuredComponentCount(page)).toBe(0);

  await popover.getByRole('button', { name: '开始创作' }).click();
  await expect.poll(() =>
    page.evaluate((key) => localStorage.getItem(key), ONBOARDING_STORAGE_KEY)
  ).toBe('completed');
});
