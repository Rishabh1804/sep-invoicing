import { test, expect } from '@playwright/test';
import { loadAppWithState } from './fixtures';
import { sweepState, walkPages, walkDialogs, problems, type Stop } from './sweep-fixture';

// P76 desktop: the same sweep at 1280px in both themes — the table and pane layouts, the sidebar and the centred
// dialogs are the desktop's own markup, so a v1.0 name could survive there alone.

for (const scheme of ['light', 'dark'] as const) {
  test(`every screen and dialog is v2.0 only on the desktop (${scheme})`, async ({ page }) => {
    test.setTimeout(180_000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.emulateMedia({ colorScheme: scheme });
    await loadAppWithState(page, sweepState());
    const stops: Stop[] = [];
    await walkPages(page, `desktop-${scheme}`, stops);
    await walkDialogs(page, `desktop-${scheme}`, stops);
    expect(stops.length).toBeGreaterThan(40);
    expect(problems(stops)).toEqual([]);
    expect(errors).toEqual([]);
  });
}
