import { expect, test } from '@playwright/test';

const agentDeck = [
  '---',
  'asciicanvas: slides/v1',
  'size: 12x4',
  'title: Agent Deck',
  '---',
  '## Intro',
  '```text',
  '  ASCII',
  '```',
  '## Next',
  '```asciicanvas',
  '[31mAgent -> Slides[0m',
  '```',
].join('\n');

test('imports an Agent-generated deck and exposes Markdown export', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.getByRole('menuitem', { name: 'Import' })).toBeVisible();

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: 'agent.slides.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(agentDeck),
  });

  await expect(page.getByRole('button', { name: 'Add slide' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Rename' })).toHaveCount(2);
  await expect(page.getByRole('button', { name: '1. Intro' })).toBeVisible();
  await expect(page.getByRole('button', { name: '2. Next' })).toBeVisible();

  await page.getByRole('button', { name: 'Open menu' }).click();
  await page
    .getByRole('menuitem', { name: 'Export', exact: true })
    .evaluate((element) => (element as HTMLElement).click());
  await expect(page.getByRole('menuitem', { name: 'Markdown', exact: true })).toBeVisible();
});
