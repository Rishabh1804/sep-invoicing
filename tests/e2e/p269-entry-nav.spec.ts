import { test, expect, Page } from '@playwright/test';
import { loadAppWithState, switchTab, toolbarMore } from './fixtures';
import { longBook } from './load-fixture';

// P269: leaving an entry form by its own way out (Done, Back, a correction saved) is a step back to the screen it came from, so the
// phone's back does not open the form again (owner: bugs "mostly based on navigation when entering data"). Made-up book (HR-10).

const idx = (page: Page) => page.evaluate(() => (history.state || {}).idx);
const v = (page: Page) => { const u = new URL(page.url()); return u.searchParams.get('tab') + '|' + (u.searchParams.get('v') || ''); };

test('Power → Enter a cut → Save → Done is a step back to Power; back then leaves Power, never reopening the form', async ({ page }) => {
  await loadAppWithState(page, longBook());
  await switchTab(page, 'pagePower');
  await expect.poll(() => v(page)).toBe('pagePower|cuts');
  const atPower = await idx(page);
  await page.locator('[data-action="invPowerAddCut"]').first().click();
  await expect.poll(() => v(page)).toBe('pageProduction|lines/hand');
  await page.locator('#prodHandTime').fill('10:30');
  await page.locator('[data-action="invProdSaveHand"]').click();
  await expect(page.locator('[data-card="prodHandSaved"]')).toBeVisible();
  await page.locator('[data-card="prodHandSaved"] [data-action="invProdHandDone"]').click();
  await expect.poll(() => v(page)).toBe('pagePower|cuts');
  await expect.poll(() => idx(page)).toBe(atPower);
  await page.goBack();
  await expect.poll(() => v(page)).not.toBe('pageProduction|lines/hand');
  await expect(page.locator('.inv-page-active [data-flow="prodHand"]')).toHaveCount(0);
  // Forward still reaches Power, the screen left.
  await page.goForward();
  await expect.poll(() => v(page)).toBe('pagePower|cuts');
});

test('Stock → Enter by hand → its Back is a step back to Lines; back then leaves Stock, never reopening the form', async ({ page }) => {
  await loadAppWithState(page, longBook());
  await switchTab(page, 'pageStock');
  await expect.poll(() => v(page)).toBe('pageStock|list');
  const atList = await idx(page);
  await page.locator('[data-action="invStockManual"]').first().click();
  await expect.poll(() => v(page)).toBe('pageStock|manual');
  await page.locator('[data-action="invStockBack"]').first().click();
  await expect.poll(() => v(page)).toBe('pageStock|list');
  await expect.poll(() => idx(page)).toBe(atList);
  await page.goBack();
  await expect.poll(() => v(page)).not.toBe('pageStock|manual');
  await expect(page.locator('.inv-page-active [data-flow="stockManual"]')).toHaveCount(0);
});

test('Production → Enter by hand → Back goes back a step; a form opened another way still pushes its way out', async ({ page }) => {
  await loadAppWithState(page, longBook());
  await switchTab(page, 'pageProduction');
  const atMain = await idx(page), place = v(page);
  // Opened from the toolbar's More, a layer shut on the way: Back passes over it.
  await toolbarMore(page, 'Enter by hand');
  await expect.poll(() => v(page)).toContain('/hand');
  await page.locator('[data-action="invProdBack"]').first().click();
  await expect.poll(() => v(page)).toBe(place);
  await expect.poll(() => idx(page)).toBe(atMain);
  // Opened straight from another screen (an address, a link): the step before is not where its Back goes, so Back is a new step.
  await page.evaluate(() => (0, eval)("navOpen({ tab: 'pageStock', v: 'list' })"));
  await expect.poll(() => v(page)).toBe('pageStock|list');
  await page.evaluate(() => (0, eval)("navOpen({ tab: 'pageProduction', v: 'lines/hand' })"));
  await expect.poll(() => v(page)).toBe('pageProduction|lines/hand');
  const atForm = await idx(page);
  await page.locator('[data-action="invProdBack"]').first().click();
  await expect.poll(() => v(page)).toBe('pageProduction|lines');
  await expect.poll(() => idx(page)).toBe(atForm + 1);
  await page.goBack();
  await expect.poll(() => v(page)).toBe('pageProduction|lines/hand');
});
