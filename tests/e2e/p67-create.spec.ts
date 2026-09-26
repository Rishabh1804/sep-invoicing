import { test, expect } from '@playwright/test';
import { loadAppWithState, switchTab, readStoredState } from './fixtures';
import { imState } from './im-fixture';

// P67: Create on the v2.0 components. The chosen client's unbilled challans are tick boxes that
// bring their lines in; only what the invoice still carries is marked invoiced; optional details
// fold, and the Enter chain steps over them while folded; the page carries one primary.

async function openWithClient(page) {
  const st = imState();
  st.invNextNum = 2;   // the fixture's billed challan holds 00001
  await loadAppWithState(page, st);
  await switchTab(page, 'pageCreate');
  await page.locator('#invClientSearch').fill('dilip');
  await page.locator('[data-action="invSelectClient"]').first().click();
}

test('ticking an unbilled challan brings its lines, challan no. and vehicle; unticking takes them out', async ({ page }) => {
  await openWithClient(page);
  const tick = page.locator('[data-action="invCreatePickChallan"][data-id="IM-101"]');
  await expect(page.locator('[data-action="invCreatePickChallan"]')).toHaveCount(1);   // the billed challan is not offered
  await tick.check();
  await expect(page.locator('.inv-line')).toHaveCount(1);
  await expect(page.locator('#invChallanNo')).toHaveValue('101');
  await expect(page.locator('#invTransport')).toHaveValue('JH 05AN 0878');
  await expect(page.locator('#invOptional')).toHaveAttribute('open', '');
  await expect(page.locator('#invGrandTotal')).toHaveText('₹1,534.00');
  await page.locator('[data-action="invCreatePickChallan"][data-id="IM-101"]').uncheck();
  await expect(page.locator('.inv-line')).toHaveCount(0);
  await expect(page.locator('#invChallanNo')).toHaveValue('');
});

test('a challan line removed before saving stays unbilled', async ({ page }) => {
  await openWithClient(page);
  await page.locator('[data-action="invCreatePickChallan"]').check();
  await page.locator('[data-action="invAddLineItem"]').click();
  await page.locator('input[data-field="qty"][data-idx="1"]').fill('10');
  await page.locator('[data-action="invRemoveLineItem"][data-idx="0"]').click();
  await page.locator('#invSaveBtn').click();
  await expect.poll(async () => (await readStoredState(page)).invoices.length).toBe(2);
  const st = await readStoredState(page);
  const im = st.incomingMaterial.find((m: any) => m.id === 'IM-101');
  expect(im.items[0].invoiced).toBe(false);
  expect(st.invoices.find((i: any) => i.id !== 'INV-1').linkedIMIds).toEqual([]);
});

test('a ticked challan is marked invoiced on save', async ({ page }) => {
  await openWithClient(page);
  await page.locator('[data-action="invCreatePickChallan"]').check();
  await page.locator('#invSaveBtn').click();
  await expect.poll(async () => (await readStoredState(page)).invoices.length).toBe(2);
  const st = await readStoredState(page);
  expect(st.incomingMaterial.find((m: any) => m.id === 'IM-101').items[0].invoiced).toBe(true);
  expect(st.invoices.find((i: any) => i.id !== 'INV-1').linkedIMIds).toEqual(['IM-101']);
});

test('optional details start folded, and Enter steps over them to the next open field', async ({ page }) => {
  await openWithClient(page);
  await expect(page.locator('#invOptional')).not.toHaveAttribute('open', '');
  await page.locator('[data-action="invAddLineItem"]').click();
  await page.locator('input[data-field="rate"][data-idx="0"]').focus();
  await page.keyboard.press('Enter');
  // Amount is read-only on a weight line; the next field in reach is not inside the fold.
  const inFold = await page.evaluate(() => !!document.activeElement?.closest('#invOptional'));
  expect(inFold).toBe(false);
  await expect(page.locator('#pageCreate .inv-btn-primary:visible')).toHaveCount(1);
});
