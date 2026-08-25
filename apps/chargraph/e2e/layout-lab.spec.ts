import { expect, test } from "@playwright/test";

test("edits the boundary-line block layout stream", async ({ page }) => {
  await page.goto("?lab=layout");

  await expect(
    page.getByRole("heading", { level: 1, name: "Block Layout Lab" })
  ).toBeVisible();
  const editor = page.getByRole("textbox", { name: "Block layout source" });
  await expect(editor).toHaveValue(/CharDesk/);

  const viewer = page.locator("chardesk-viewer");
  await expect(viewer).toBeVisible();
  const previewText = () => viewer.locator("pre").textContent();
  await expect.poll(previewText).toContain("CharDesk Workspace");
  await expect.poll(previewText).toContain("中文       就绪");
  await expect.poll(previewText).toContain("日本語     準備完了");
  await expect.poll(previewText).toContain("한국어     준비 완료");
  await expect.poll(previewText).toContain('"canvas": "launch-plan"');
  await expect.poll(previewText).toContain("Unicode Canvas");
  await expect.poll(previewText).toContain("└─ publish ✓");
  await expect.poll(previewText).toContain("All systems operational");

  await expect(editor).toHaveValue(/\|\|\|/);
  await expect(editor).toHaveValue(/---/);
  await expect.poll(previewText).toContain("|||  next field");
  await expect.poll(previewText).toContain("---  next row");

  await editor.fill("A\n|||\nB\n---\nC");
  await expect.poll(async () => viewer.locator("pre").textContent()).toBe(
    "A    B\n\nC"
  );
});

test("stacks the editor and preview on a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 900 });
  await page.goto("?lab=layout");

  const editor = page.getByRole("textbox", { name: "Block layout source" });
  const viewer = page.locator("chardesk-viewer");
  const positions = await Promise.all([
    editor.boundingBox(),
    viewer.boundingBox(),
  ]);

  expect(positions[0]).not.toBeNull();
  expect(positions[1]).not.toBeNull();
  expect(positions[1]!.y).toBeGreaterThan(positions[0]!.y + positions[0]!.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    720
  );
});
