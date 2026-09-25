import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, type SepState } from './fixtures';

// P45: Settings → To-do → Check Windows widget. The widget host exists only in
// Edge on Windows 11, so what is testable is the verdict: for each step that can
// fail, the check names that step and what to do, and nothing past it.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);

test('the widget check names the first step that fails, and what to do', async ({ page }) => {
  await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM() } as SepState);
  const v = await g(page, `(function(){
    var ok = { windows: true, edge: true, installed: true, worker: true };
    var e = function(k) { var x = Object.assign({}, ok); x[k] = false; return x; };
    var full = { api: true, defined: true, instances: 0, error: '' };
    return {
      windows: todoWidgetVerdict(e('windows'), full)[1],
      edge: todoWidgetVerdict(e('edge'), full)[1],
      tab: todoWidgetVerdict(e('installed'), full)[1],
      noApi: todoWidgetVerdict(ok, { api: false })[1],
      notDefined: todoWidgetVerdict(ok, { api: true, defined: false })[1],
      ready: todoWidgetVerdict(ok, full),
      pinned: todoWidgetVerdict(ok, Object.assign({}, full, { instances: 1 }))[0]
    }; })()`) as any;
  expect(v.windows).toContain('not Windows');
  expect(v.edge).toContain('not Microsoft Edge');
  expect(v.tab).toContain('Install this site as an app');
  expect(v.noApi).toContain('Developer Mode');
  expect(v.noApi).toContain('Windows App SDK 1.2');
  expect(v.notDefined).toContain('install it again from Edge');
  expect(v.ready).toEqual(['ok', 'Ready. Press Win+W → Add widgets (+) → SEP To-do → Pin.']);
  expect(v.pinned).toBe('ok');

  // Run for real here: headless Chromium on the test machine is neither Edge nor installed.
  await page.evaluate(() => (window as any).openSettings());
  await page.locator('[data-action="invTodoWidgetCheck"]').click();
  const box = page.locator('#todoWidgetStatus');
  await expect(box.locator('.inv-td-wverdict-bad')).toBeVisible();
  await expect(box).toContainText('No: Microsoft Edge');
  await expect(box).toContainText('No: Widget on the board');
});
