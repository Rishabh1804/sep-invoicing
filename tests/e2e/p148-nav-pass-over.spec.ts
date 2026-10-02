import { test, expect } from '@playwright/test';
import { loadAppWithState, switchTab } from './fixtures';
import { openSearch, search, searchBook } from './p139-search.fixture';

// P148: Back over a layer that shut without Back (a search that jumped) passes over its step, and where the browser has
// nowhere further to go a fallback arrives at it a moment later. The fallback checked only the step's index, and a tap in
// that moment pushes its own step onto the very same index: the stale fallback then sent the app back to the screen just
// left. P139 ("the screen already open is no new step") failed this way on CI and on main, 9 runs in 15 locally.

test('a tap right after Back over a shut search is not undone by the pass-over', async ({ page }) => {
  await loadAppWithState(page, searchBook());
  await switchTab(page, 'pageIM');
  // A search that jumps shuts its layer without Back: its step stays in the history, marked to be passed over.
  await openSearch(page);
  await search(page, 'live cost');
  await page.keyboard.press('Enter');
  await expect(page.locator('#pageStats')).toHaveClass(/inv-page-active/);
  // Back passes over the search's step to Challans; the tap comes the moment Challans is drawn, inside the fallback's
  // 120 ms, the way a quick finger (or a test) does.
  await page.evaluate(() => new Promise<void>(res => {
    const onPop = (e: PopStateEvent) => {
      const st = e.state;
      if (!st || st.skip || st.layer) return;
      window.removeEventListener('popstate', onPop);
      setTimeout(() => { (window as any).switchTab('pageRegister'); (window as any).navSync(); res(); }, 0);
    };
    window.addEventListener('popstate', onPop);
    history.back();
  }));
  await expect(page.locator('#pageRegister')).toHaveClass(/inv-page-active/);
  // Well past the fallback's moment: still on Invoices, and the address says so.
  await page.waitForTimeout(400);
  await expect(page.locator('#pageRegister')).toHaveClass(/inv-page-active/);
  expect(page.url()).toContain('tab=pageRegister');
  // Back from Invoices is Challans, one step, as a tap's step should be.
  await page.goBack();
  await expect(page.locator('#pageIM')).toHaveClass(/inv-page-active/);
});
