import { expect, test, type Page } from "@playwright/test";

import { CHARGRAPH_EXAMPLES, renderExample } from "../src/examples";

declare global {
  interface Window {
    __copiedText: string;
  }
}

const installClipboard = async (page: Page, shouldFail = false) => {
  await page.addInitScript((fail) => {
    let copiedText = "";
    Object.defineProperty(window, "__copiedText", {
      configurable: true,
      get: () => copiedText,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          if (fail) throw new Error("Clipboard unavailable");
          copiedText = value;
        },
      },
    });
  }, shouldFail);
};

const readClipboard = (page: Page) =>
  page.evaluate(() => window.__copiedText);

test("copies Mermaid source and Unicode output with in-place feedback", async ({
  page,
}) => {
  await installClipboard(page);
  await page.goto("./");

  const example = CHARGRAPH_EXAMPLES.find((item) => item.id === "flowchart");
  if (!example) throw new Error("Flowchart example is missing");
  const rendered = await renderExample(example);
  const article = page.locator("#flowchart");

  const sourceCopy = article.locator('[data-copy-target="source"]');
  await sourceCopy.click();
  await expect.poll(() => readClipboard(page)).toBe(example.source);
  await expect(sourceCopy).toHaveAttribute("data-copy-feedback", "success");
  await expect(sourceCopy).toHaveAttribute("data-feedback", "success");
  await expect(sourceCopy).toHaveClass(/text-success/);
  await expect(sourceCopy.locator("svg")).toHaveClass(/lucide-check/);
  await expect(sourceCopy).not.toHaveAttribute("data-copy-feedback", /.+/, {
    timeout: 2_000,
  });

  const unicodeCopy = article.locator('[data-copy-target="unicode"]');
  await unicodeCopy.click();
  await expect.poll(() => readClipboard(page)).toBe(rendered.protocolText);
  await expect(unicodeCopy).toHaveAttribute("data-copy-feedback", "success");
});

test("floats copy controls inside unlabeled content panels", async ({ page }) => {
  await page.goto("./");

  const article = page.locator("#flowchart");
  await expect(article.locator('[data-slot="example-panel-header"]')).toHaveCount(0);

  const panels = article.locator('[data-slot="example-panel"]');
  await expect(panels).toHaveCount(2);
  await expect(panels.nth(0)).toHaveAttribute("aria-label", "Mermaid");
  await expect(panels.nth(1)).toHaveAttribute("aria-label", "Unicode");

  for (const target of ["source", "unicode"] as const) {
    const panel = article
      .locator(`[data-copy-target="${target}"]`)
      .locator('xpath=ancestor::*[@data-slot="example-panel"]');
    const copy = panel.locator(`[data-copy-target="${target}"]`);
    const geometry = await panel.evaluate((element) => {
      const button = element.querySelector<HTMLElement>("[data-copy-target]");
      if (!button) throw new Error("Copy control is missing");
      const panelRect = element.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      return {
        top: buttonRect.top - panelRect.top,
        right: panelRect.right - buttonRect.right,
        contained:
          buttonRect.top >= panelRect.top &&
          buttonRect.right <= panelRect.right &&
          buttonRect.bottom <= panelRect.bottom,
      };
    });

    await expect(copy).toBeVisible();
    expect(geometry.top).toBeCloseTo(12, 0);
    expect(geometry.right).toBeCloseTo(12, 0);
    expect(geometry.contained).toBe(true);
  }
});

test("preserves ANSI styling when copying Markdown output", async ({ page }) => {
  await installClipboard(page);
  await page.goto("./#type-markdown-basics");

  const example = CHARGRAPH_EXAMPLES.find((item) => item.id === "markdown-basics");
  if (!example) throw new Error("Markdown example is missing");
  const rendered = await renderExample(example);
  const unicodeCopy = page
    .locator("#markdown-basics")
    .locator('[data-copy-target="unicode"]');

  await unicodeCopy.click();
  await expect.poll(() => readClipboard(page)).toBe(rendered.protocolText);
  expect(rendered.protocolText).toContain("\u001b[");
});

test("shows clipboard failures in place without a toast", async ({ page }) => {
  await installClipboard(page, true);
  await page.goto("./");

  const copyButton = page
    .locator("#flowchart")
    .locator('[data-copy-target="source"]');
  await copyButton.click();

  await expect(copyButton).toHaveAttribute("data-copy-feedback", "error");
  await expect(copyButton).toHaveAttribute("aria-label", "Could not copy Mermaid");
  await expect(copyButton.locator("svg")).toHaveClass(/lucide-x/);
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
  await expect(copyButton).not.toHaveAttribute("data-copy-feedback", /.+/, {
    timeout: 2_500,
  });
});
