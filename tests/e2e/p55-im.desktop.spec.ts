import { test, expect } from '@playwright/test';
import { loadAppWithState, switchTab } from './fixtures';
import { imState } from './im-fixture';

// P55 desktop: the challan table fits beside its pane, the way the Register's does (P54).

for (const width of [1280, 1024]) {
  test(`at ${width}px the challan table fits beside its pane`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await loadAppWithState(page, imState());
    await switchTab(page, 'pageIM');
    const fit = () => page.evaluate(() => {
      const list = document.getElementById('imMaster')!;
      const t = list.querySelector('table');
      return { shown: list.offsetWidth > 0, overflow: t ? t.scrollWidth - list.clientWidth : 0 };
    });
    expect((await fit()).overflow).toBeLessThanOrEqual(0);

    await page.locator('#imMaster button[data-action="invSelectIMRow"]').first().click();
    await expect(page.locator('#imDetail')).toContainText('Total');
    const open = await fit();
    if (width >= 1280) expect(open.shown).toBe(true);
    if (open.shown) expect(open.overflow).toBeLessThanOrEqual(0);
    await page.locator('[data-action="invIMClosePane"]').click();
    expect((await fit()).shown).toBe(true);
  });
}
