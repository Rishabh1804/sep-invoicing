import { test, expect } from '@playwright/test';
import { walkWidgets } from './p224-widget-sweep.fixture';

// P224 (UI pass 3, U2; docs/UI_PASS_3.md §7i) on the desktop, at 1280 px and at 1024 px (12 columns and 6): every widget at every
// size it allows, three books, both themes, each preset and three seeded random arrangements.

for (const width of [1280, 1024]) {
  test(`every widget at every size, every preset and random arrangements draw whole on the desktop at ${width} px`, async ({ page }) => {
    test.setTimeout(600_000);
    await page.setViewportSize({ width, height: 900 });
    const { errs, bad, drawn } = await walkWidgets(page, 'desk ' + width);
    expect(drawn).toBeGreaterThan(100);
    expect(errs).toEqual([]);
    expect(bad).toEqual([]);
  });
}
