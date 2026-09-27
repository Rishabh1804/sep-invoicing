import { test, expect } from '@playwright/test';
import { loadAppWithState, readStoredState, switchTab } from './fixtures';
import { partStateBilled } from './p77-part-invoice.fixture';

// P77 desktop: a challan invoiced in parts, in the IM table and pane and on the Create form.

test.use({ viewport: { width: 1280, height: 900 } });

test('the IM table reads Part invoiced, and the pane shows billed, left and each invoice', async ({ page }) => {
  await loadAppWithState(page, partStateBilled(200, 300));
  await switchTab(page, 'pageIM');
  const tr = page.locator('#imMaster tr[data-im="IM-301"]');
  await expect(tr.locator('.inv-dot')).toHaveText('Part invoiced');
  // Still tickable: 100 is left.
  await expect(tr.locator('[data-action="invCheckIMChallan"]')).toHaveCount(1);
  await tr.locator('button[data-action="invSelectIMRow"]').click();
  const pane = page.locator('#imDetail');
  await expect(pane.locator('[data-im-share]')).toContainText('500 billed · 100 left');
  const links = pane.locator('[data-action="invViewInvoiceDetail"]');
  await expect(links).toHaveText(['Invoice 00001', 'Invoice 00002']);
  // Part invoiced locks the challan like invoiced did: Edit says why, Delete is not offered.
  await expect(pane.locator('[data-action="invDeleteChallan"]')).toHaveCount(0);
  await links.nth(1).click();
  await expect(page.locator('.inv-scrim-dialog')).toContainText('SEP/TEST-00002');
});

test('the Create picker offers what is left, and a line over it says so', async ({ page }) => {
  await loadAppWithState(page, partStateBilled(200, 300));
  await switchTab(page, 'pageCreate');
  await page.locator('#invClientSearch').fill('samarth');
  await page.locator('[data-action="invSelectClient"]').first().click();
  const pick = page.locator('[data-action="invCreatePickChallan"][data-id="IM-301"]');
  const row = page.locator('.inv-row').filter({ has: pick });
  await expect(row).toContainText('600 on challan 301 · 500 invoiced (SEP/TEST-00001, SEP/TEST-00002) · 100 left');
  await expect(row.locator('.inv-row-end')).toHaveText('₹250.00');
  await pick.check();
  await expect(page.locator('input[data-field="qty"][data-idx="0"]')).toHaveValue('100');
  await expect(page.locator('#invImShare0 [data-im-share]')).toContainText('100 left');
  await page.locator('input[data-field="qty"][data-idx="0"]').fill('120');
  await expect(page.locator('#invImShare0 [data-im-over]')).toContainText('20 over what is left on challan 301');
  await page.locator('#invImShare0 [data-action="invOverReason"][data-reason="challan"]').click();
  await page.locator('#invSaveBtn').click();
  await expect.poll(async () => (await readStoredState(page)).invoices.length).toBe(3);
  expect((await readStoredState(page)).invoices[2].items[0].overBillAck.left).toBe(100);
});
