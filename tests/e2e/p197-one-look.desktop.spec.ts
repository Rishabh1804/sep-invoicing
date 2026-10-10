import { test, expect } from '@playwright/test';
import { walkOneLook } from './load-fixture';

// P197 desktop: the same census and checks at 1280 × 800 (docs/TAB_MAP.md §3e, I11). The desktop draws the verdict card open,
// its filters inline and a row's second action in the pane, so the phone's row-end check is the phone's alone.
test('every screen declares its kind and wears only the system’s looks; the screens assembled keep their anatomy (desktop)', async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  const { errs, bad, report } = await walkOneLook(page);
  expect(Object.keys(report).length, 'the whole map walked').toBeGreaterThanOrEqual(50);
  expect(errs, 'no page error on any screen').toEqual([]);
  expect(bad).toEqual([]);
});
