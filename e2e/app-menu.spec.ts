import { expect, test } from '@playwright/test';

test.describe('App menu', () => {
  test('round-trips a native CharDesk project file', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('menuitem', { name: 'Export' }).hover();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: 'CharDesk' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^chardesk-\d+\.chardesk$/);
    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    if (!downloadPath) return;

    await page.locator('input[type="file"]').setInputFiles(downloadPath);
    await expect(page.getByText('Import complete')).toBeVisible();
  });

  test('keeps inline actions open and closes when focus leaves', async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const trigger = page.getByRole('button', { name: 'Open menu' });
    const menuContent = page.locator('[data-slot="dropdown-menu-content"]');
    const canvasBreadcrumb = page.getByRole('button', { name: 'Select canvas' });
    await expect(trigger).toBeVisible();
    await expect(page.locator('[data-slot="sidebar-footer"]')).toHaveCount(0);

    const gridControl = page.getByRole('button', {
      name: 'Hide Workspace Grid',
    });
    const minimapControl = page.getByRole('button', { name: 'Minimap' });
    await gridControl.click();
    await expect(page.getByRole('button', { name: 'Toggle Grid' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    await minimapControl.click();
    const minimap = page.getByLabel('Canvas minimap');
    await expect(minimap).toBeVisible();
    const minimapBox = await minimap.boundingBox();
    const minimapControlBox = await minimapControl.boundingBox();
    expect(minimapBox).not.toBeNull();
    expect(minimapControlBox).not.toBeNull();
    expect(minimapBox!.y + minimapBox!.height).toBeLessThan(minimapControlBox!.y);

    const triggerBox = await trigger.boundingBox();
    const breadcrumbBox = await canvasBreadcrumb.boundingBox();
    expect(triggerBox).not.toBeNull();
    expect(breadcrumbBox).not.toBeNull();
    expect(triggerBox!.x + triggerBox!.width).toBeLessThanOrEqual(breadcrumbBox!.x);

    await trigger.click();
    const menu = page.getByRole('menu', { name: 'Open menu' });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem').allTextContents()).resolves.toEqual([
      'Import',
      'Export',
      'Clear',
      'Settings',
      'GitHub',
    ]);

    await menu.getByRole('menuitem', { name: 'Export' }).hover();
    const exportMenu = page.getByRole('menu', { name: 'Export' });
    await expect(exportMenu).toBeVisible();
    await expect(exportMenu.getByRole('menuitem').allTextContents()).resolves.toEqual([
      'TXT',
      'CharDesk',
      'ANSI',
      'PNG',
    ]);
    const projectDownload = page.waitForEvent('download');
    await exportMenu.getByRole('menuitem', { name: 'CharDesk' }).click();
    const downloadedProject = await projectDownload;
    expect(downloadedProject.suggestedFilename()).toMatch(/^chardesk-\d+\.chardesk$/);
    await expect(menu).toBeVisible();
    await expect(exportMenu).toBeVisible();
    const txtItem = exportMenu.getByRole('menuitem', { name: 'TXT' });
    await expect(txtItem).not.toHaveAttribute('aria-haspopup', 'menu');
    const textDownload = page.waitForEvent('download');
    await txtItem.click();
    const downloadedText = await textDownload;
    expect(downloadedText.suggestedFilename()).toMatch(/\.txt$/);
    await expect(menu).toBeVisible();
    await expect(exportMenu).toBeVisible();
    await expect(page.getByRole('menu', { name: 'TXT' })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: 'Copy' })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: 'Save' })).toHaveCount(0);

    const separator = menu.locator('[data-slot="dropdown-menu-separator"]');
    await expect(separator).toHaveCSS('height', '1px');
    await expect(separator).toHaveClass(/bg-border/);

    await page.mouse.click(700, 500);
    await expect(menuContent).toHaveCount(0);

    await trigger.click();
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(menuContent).toHaveCount(0);

    const helpControl = page.getByRole('button', { name: 'Help' });
    const helpBox = await helpControl.boundingBox();
    expect(helpBox).not.toBeNull();
    expect(helpBox!.x + helpBox!.width).toBe(1428);
    expect(helpBox!.y + helpBox!.height).toBe(888);
    await expect(page.locator('[data-slot="sidebar-content"]')).toHaveCSS('padding-bottom', '48px');

    await helpControl.click();
    await expect(page.getByRole('dialog')).toContainText('Help');
    await page.keyboard.press('Escape');

    await trigger.click();
    const clearMenu = page.getByRole('menu', { name: 'Open menu' });
    await clearMenu.getByRole('menuitem', { name: 'Clear' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await expect(menuContent).toHaveCount(0);
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('auto-detects imports and exposes language and shortcuts in Settings', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const trigger = page.getByTestId('app-menu-host').getByRole('button');
    await trigger.click();
    const menu = page.getByRole('menu', { name: 'Open menu' });

    const importChooser = page.waitForEvent('filechooser');
    await menu.getByRole('menuitem', { name: 'Import' }).click();
    await importChooser;
    await expect(page.locator('input[type="file"]')).toHaveAttribute(
      'accept',
      '.chardesk,.md,text/markdown,text/plain'
    );
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(page.locator('[data-slot="dropdown-menu-content"]')).toHaveCount(0);

    await trigger.click();
    await page
      .getByRole('menu', { name: 'Open menu' })
      .getByRole('menuitem', { name: 'Settings' })
      .click();

    const settings = page.getByRole('dialog', { name: 'Settings' });
    await expect(settings).toBeVisible();
    await expect(settings.getByRole('button', { name: 'Close' })).toHaveCount(0);
    await settings.getByRole('combobox', { name: 'Language' }).click();
    const languageOptions = page.getByRole('listbox');
    await expect(languageOptions).toBeVisible();
    await languageOptions.getByRole('option', { name: '中文' }).click();
    await expect(page.getByRole('dialog', { name: '设置' })).toBeVisible();

    await page.getByRole('button', { name: '快捷键' }).click();
    await expect(page.getByRole('heading', { name: '键盘快捷键' })).toBeVisible();

    const overlay = page.locator('[data-slot="dialog-overlay"]');
    await overlay.click({ position: { x: 4, y: 4 } });
    await expect(settings).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('switches Settings sections through the phone Select navigation', async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 800 });
    await page.goto('/');

    await page.getByRole('button', { name: 'Open menu' }).click();
    await page
      .getByRole('menu', { name: 'Open menu' })
      .getByRole('menuitem', { name: 'Settings' })
      .click();

    const settings = page.getByRole('dialog', { name: 'Settings' });
    const sectionSelect = settings.getByRole('combobox', { name: 'Settings sections' });
    await sectionSelect.click();
    const sectionOptions = page.getByRole('listbox');
    await expect(sectionOptions).toBeVisible();
    await sectionOptions.getByRole('option', { name: 'Shortcuts' }).click();
    await expect(settings.getByRole('heading', { name: 'Keyboard shortcuts' })).toBeVisible();
  });

  test('keeps every Settings table column inside the phone content width', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('/');

    await page.getByRole('button', { name: 'Open menu' }).click();
    await page
      .getByRole('menu', { name: 'Open menu' })
      .getByRole('menuitem', { name: 'Settings' })
      .click();

    const settings = page.getByRole('dialog', { name: 'Settings' });
    const content = settings.locator('[data-slot="settings-content"]');
    const sectionScroll = () => settings.locator('[data-slot="settings-section-scroll"]');
    const expectWidthContained = async (target: ReturnType<typeof sectionScroll>) => {
      const metrics = await target.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollLeft: element.scrollLeft,
        scrollWidth: element.scrollWidth,
      }));
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
      expect(metrics.scrollLeft).toBe(0);
    };

    await expectWidthContained(sectionScroll());

    const sectionSelect = settings.getByRole('combobox', { name: 'Settings sections' });
    await sectionSelect.click();
    await page.getByRole('listbox').getByRole('option', { name: 'Display' }).click();
    await expect(settings.getByRole('columnheader', { name: 'Setting' })).toBeVisible();
    await expect(settings.getByRole('columnheader', { name: 'Value' })).toBeVisible();
    await expect(settings.getByRole('columnheader', { name: 'Color' })).toBeVisible();
    await expectWidthContained(sectionScroll());
    await expectWidthContained(settings.locator('[data-slot="display-settings-grid"]'));

    await sectionSelect.click();
    await page.getByRole('listbox').getByRole('option', { name: 'Shortcuts' }).click();
    await expect(settings.getByRole('columnheader', { name: 'Command' })).toBeVisible();
    await expect(settings.getByRole('columnheader', { name: 'Scope' })).toBeVisible();
    await expect(settings.getByRole('columnheader', { name: 'Shortcut' })).toBeVisible();
    await expectWidthContained(sectionScroll());
    await expectWidthContained(settings.locator('[data-slot="shortcut-grid"]'));

    await settings.getByRole('searchbox', { name: 'Search settings' }).fill('Undo');
    await settings
      .getByRole('navigation', { name: 'Settings search results' })
      .getByRole('button', { name: 'Undo' })
      .click();
    await expect(content).toBeVisible();
    await expectWidthContained(sectionScroll());
  });
});
