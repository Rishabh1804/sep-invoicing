import { test, expect } from '@playwright/test';
import { loadAppWithState, switchTab, setFilter } from './fixtures';
import { imState } from './im-fixture';

// P55: the Challans (IM) screen on the v2.0 components. The worklist leads with material still to bill,
// the filters speak through change and never click, and the page carries one primary action.

test('material still to bill is the default tab, grouped by day; billed material is its own tab, month by month', async ({ page }) => {
  await loadAppWithState(page, imState());
  await switchTab(page, 'pageIM');
  const tabs = page.locator('#imToolbar [data-action="invIMTab"]');
  await expect(tabs).toHaveText(['Awaiting invoice 2', 'Invoiced 1']);
  await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
  // The list carries no head of its own: its count and what it bills are the card's (the tab map, TM5b; asserted below).
  await expect(page.locator('#imList .inv-panel-title')).toHaveCount(0);
  const order = await page.locator('#imList [data-im]').evaluateAll(els => els.map(e => e.getAttribute('data-im')));
  expect(order).toEqual(['IM-102', 'IM-101']);
  await expect(page.locator('#imList .inv-row-group').first()).toContainText('₹1,300.00');
  // The count and what it bills are the card's (the tab map, TM5b).
  await expect(page.locator('[data-im-summary] .inv-hero-title')).toHaveText('2 challans waiting · ₹2,600 to bill');

  await tabs.nth(1).click();
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#imList [data-im]')).toHaveCount(1);
  await expect(page.locator('#imList [data-im="IM-103"]')).toBeVisible();
  // One status on this tab: no status filter; the month pager instead, with nothing before or after.
  await expect(page.locator('#imStatusFilter')).toHaveCount(0);
  await expect(page.locator('[data-im-month]')).toContainText('1 challan · ₹1,300.00');
  await expect(page.locator('[data-action="invIMMonth"][data-step="-1"]')).toBeDisabled();
});

test('Invoiced steps back a month at a time', async ({ page }) => {
  const s: any = imState();
  const old = JSON.parse(JSON.stringify(s.incomingMaterial[2]));
  old.id = 'IM-104'; old.challanNo = '104'; old.challanDate = '2026-01-10'; old.items[0].id = 'IM-104-0';
  s.incomingMaterial.push(old);
  await loadAppWithState(page, s);
  await switchTab(page, 'pageIM');
  await page.locator('[data-action="invIMTab"][data-tab="invoiced"]').click();
  await expect(page.locator('#imList [data-im]')).toHaveText([/103/]);
  await page.locator('[data-action="invIMMonth"][data-step="-1"]').click();
  await expect(page.locator('[data-im-month]')).toHaveAttribute('data-im-month', '2026-01');
  await expect(page.locator('#imList [data-im]')).toHaveText([/104/]);
  await expect(page.locator('[data-action="invIMMonth"][data-step="-1"]')).toBeDisabled();
  await expect(page.locator('[data-action="invIMMonth"][data-step="1"]')).toBeEnabled();
});

test('the filters carry no click action, and a change filters the list', async ({ page }) => {
  await loadAppWithState(page, imState());
  await switchTab(page, 'pageIM');
  await expect(page.locator('#imToolbar select[data-action]')).toHaveCount(0);
  await setFilter(page, '#imStatusFilter', 'partial');
  await expect(page.locator('#imList [data-im]')).toHaveCount(0);
  await setFilter(page, '#imStatusFilter', 'pending');
  await expect(page.locator('#imList [data-im]')).toHaveCount(2);
});

test('one primary button on the page, and Add challan is reached once', async ({ page }) => {
  await loadAppWithState(page, imState());
  await switchTab(page, 'pageIM');
  await page.locator('[data-action="invToggleIM"][data-id="IM-102"]').click();
  await page.locator('[data-action="invCheckIMItem"]').first().check();
  await expect(page.locator('#pageIM .inv-btn-primary:visible')).toHaveCount(1);
  await expect(page.locator('#pageIM [data-action="invShowAddChallan"]')).toHaveCount(1);
});
