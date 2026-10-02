import { test, expect } from '@playwright/test';
import { loadAppWithState, switchTab } from './fixtures';
import { sweepState } from './sweep-fixture';

// P147 (phone): the desktop's panes (UX overhaul 2, step 7) leave the phone as it was. Receivables opens a client under
// its row, a worker opens their sheet, History's row goes to the invoice, and Entries keeps each entry's actions on it.

test('the phone keeps each screen as it was: no pane, the record where it was', async ({ page }) => {
  await loadAppWithState(page, sweepState());
  await switchTab(page, 'pageFinance');
  await page.locator('#pageFinance .inv-viewtab[data-tab="receipts"]').click();
  await expect(page.locator('#pageFinance .inv-pane-host')).toHaveCount(0);
  await page.locator('#bankReceipts [data-action="invBankClient"]').first().click();
  await expect(page.locator('#bankReceipts .inv-row-children [data-open-inv]').first()).toBeVisible();
  expect(page.url()).not.toContain('&id=');

  await switchTab(page, 'pageProduction');
  await page.locator('#pageProduction .inv-viewtab[data-tab="entries"]').click();
  await expect(page.locator('#pageProduction .inv-pane-host, #pageProduction [data-action="invProdEntryOpen"]')).toHaveCount(0);
  await expect(page.locator('#prodEntries [data-action="invProdVoid"]').first()).toBeVisible();

  await switchTab(page, 'pageStaff');
  await page.locator('#pageStaff .inv-viewtab[data-view="roster"]').click();
  await expect(page.locator('#attRosterTable')).toHaveCount(0);
  await page.locator('#attRoster [data-action="invAttEditWorker"]').first().click();
  await expect(page.locator('.inv-dialog')).toBeVisible();
  await page.keyboard.press('Escape');

  await switchTab(page, 'pageHistory');
  await expect(page.locator('#historyHost')).toHaveCount(0);
  await page.locator('#historyList [data-action="invHistoryJumpInvoice"]').first().click();
  await expect(page.locator('#pageRegister')).toHaveClass(/inv-page-active/);
});
