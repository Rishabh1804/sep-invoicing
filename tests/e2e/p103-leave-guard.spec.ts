import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, switchTab, todayIso, type SepState } from './fixtures';
import { imState } from './im-fixture';

// P103: a tap or a swipe that leaves a form with unsaved work asks first (owner, 29 Sep 2026: "that's a real bug"). Only
// the browser's Back asked (P100); a tap on the phone bar, the sidebar, the More sheet, a view tab or the form's own back
// button dropped a half-typed challan or stock entry without a word. Stay keeps it as typed; Leave goes where the tap
// pointed. The Create form keeps what was typed when the app leaves it, so it asks nothing.

const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
async function typedChallan(page: Page) {
  await loadAppWithState(page, imState());
  await switchTab(page, 'pageIM');
  await page.locator('[data-action="invShowAddChallan"]').click();
  await page.locator('#imVehicleNo').fill('JH 05 1234');
}

test.describe('P103: leaving unsaved work', () => {
  test('the phone bar: Stay keeps the challan as typed; Leave goes where the tap pointed', async ({ page }) => {
    await typedChallan(page);
    const bar = page.locator('.inv-navbar-item[data-tab="pageRegister"]');
    await bar.click();
    expect(await answerAsk(page, 'cancel')).toContain('Leave without saving?');
    await expect(page.locator('#pageIM')).toHaveClass(/inv-page-active/);
    await expect(page.locator('#imVehicleNo')).toHaveValue('JH 05 1234');
    await bar.click();
    await answerAsk(page, 'ok');
    await expect(page.locator('#pageRegister')).toHaveClass(/inv-page-active/);
    // Leaving dropped it, as Leave says: back on Challans the list shows, not the form.
    await switchTab(page, 'pageIM');
    await expect(page.locator('#imAddForm')).toBeEmpty();
  });

  test("the same screen's own tab and the More sheet ask too", async ({ page }) => {
    await typedChallan(page);
    // Challans on the bar redraws the list, which drops the form: that is leaving it.
    await page.locator('.inv-navbar-item[data-tab="pageIM"]').click();
    await answerAsk(page, 'cancel');
    await expect(page.locator('#imVehicleNo')).toHaveValue('JH 05 1234');
    // The More sheet opens without asking (it is not a screen); a screen in it asks.
    await page.locator('.inv-navbar-more').click();
    await expect(page.locator('.inv-ask, [data-ui-ask]')).toHaveCount(0);
    await page.locator('#moreSheet [data-tab="pageStats"]').click();
    await answerAsk(page, 'ok');
    await expect(page.locator('#pageStats')).toHaveClass(/inv-page-active/);
  });

  test("a sub-view's back button asks: Stock's entry by hand", async ({ page }) => {
    await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM() } as SepState);
    await ev(page, `switchTab('pageStock'); stockOpenManual()`);
    await page.locator('#stockManDate').fill('2020-01-02');
    await page.locator('[data-action="invStockBack"]').click();
    await answerAsk(page, 'cancel');
    await expect(page.locator('#stockManDate')).toHaveValue('2020-01-02');
    await page.locator('[data-action="invStockBack"]').click();
    await answerAsk(page, 'ok');
    await expect(page.locator('#stockManDate')).toHaveCount(0);
  });

  test('a swipe asks too', async ({ page }) => {
    await typedChallan(page);
    await page.evaluate(() => {
      const t = (x: number) => new Touch({ identifier: 1, target: document.body, clientX: x, clientY: 300 });
      document.dispatchEvent(new TouchEvent('touchstart', { touches: [t(300)], changedTouches: [t(300)] }));
      document.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t(100)] }));
    });
    await answerAsk(page, 'cancel');
    await expect(page.locator('#pageIM')).toHaveClass(/inv-page-active/);
    await expect(page.locator('#imVehicleNo')).toHaveValue('JH 05 1234');
  });

  test('nothing typed, or a form saved: no question', async ({ page }) => {
    await loadAppWithState(page, imState());
    await switchTab(page, 'pageIM');
    await page.locator('[data-action="invShowAddChallan"]').click();
    await switchTab(page, 'pageRegister');
    await expect(page.locator('[data-ui-ask]')).toHaveCount(0);
  });

  test('Create keeps what was typed when left, so it asks nothing', async ({ page }) => {
    await loadAppWithState(page, imState());
    await switchTab(page, 'pageCreate');
    await page.locator('#invDate').fill('2020-01-02');
    await switchTab(page, 'pageRegister');
    await expect(page.locator('[data-ui-ask]')).toHaveCount(0);
    await switchTab(page, 'pageCreate');
    await expect(page.locator('#invDate')).toHaveValue('2020-01-02');
  });
  // The form puts the cursor in the client search 100 ms after it opens. A field tapped before then kept its cursor only
  // until the delay ran out, and the rest of the typing went to the search (the one flake this guard's tests showed).
  test('a field tapped as the challan form opens keeps what is typed in it', async ({ page }) => {
    await loadAppWithState(page, imState());
    await switchTab(page, 'pageIM');
    await page.evaluate(() => {
      (document.querySelector('[data-action="invShowAddChallan"]') as HTMLElement).click();
      (document.getElementById('imVehicleNo') as HTMLInputElement).focus();
    });
    await page.waitForTimeout(250);
    await page.keyboard.type('JH 05');
    await expect(page.locator('#imVehicleNo')).toHaveValue('JH 05');
    await expect(page.locator('#imChallanClientSearch')).toHaveValue('');
  });
});
