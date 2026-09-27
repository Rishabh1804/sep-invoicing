import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { loadAppWithState, readStoredState, switchTab, recentTs } from './fixtures';
import { partState, partStateBilled, partInvoice } from './p77-part-invoice.fixture';

// P78: the two limits of a challan invoiced in parts each ask for a reason (owner, 27 Sep 2026: "For both the
// limits, ask for a reason"). A line billing MORE than is left on its challan line, and a line billed in ANOTHER
// UNIT than its challan line's, cannot be saved until a reason is picked under it — the red flag's and the ₹0
// line's contract. Made-up client and parts (the P77 fixture).

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);
const line = async (page: Page, id = 'IM-301-0') =>
  (await readStoredState(page)).incomingMaterial.flatMap((m: any) => m.items).find((it: any) => it.id === id);

async function pickChallan(page: Page, search: string, imId: string) {
  await switchTab(page, 'pageCreate');
  await page.locator('#invClientSearch').fill(search);
  await page.locator('[data-action="invSelectClient"]').first().click();
  await page.locator(`[data-action="invCreatePickChallan"][data-id="${imId}"]`).check();
}

test('an over-bill needs a reason: the save is held, Other takes a note, and the invoice says why', async ({ page }) => {
  const native: string[] = [];
  page.on('dialog', d => { native.push(d.message()); d.dismiss(); });
  await loadAppWithState(page, partStateBilled(200, 300));
  await pickChallan(page, 'samarth', 'IM-301');
  await page.locator('input[data-field="qty"][data-idx="0"]').fill('130');
  const box = page.locator('#invImShare0');
  await expect(box.locator('[data-ack="over"]')).toContainText('Why does this line bill more than is left?');
  await expect(box.locator('[data-action="invOverReason"]')).toHaveText(['Customer dispatched more than the challan', 'Challan quantity was wrong', 'Other']);
  await expect(page.locator('#invSaveBtn')).toBeDisabled();
  await expect(page.locator('#invErrorsArea')).toContainText('Line 1: 30 over what is left on challan 301 — pick a reason');

  await box.locator('[data-action="invOverReason"][data-reason="other"]').click();
  await expect(box.locator('[data-action="invOverReason"][data-reason="other"]')).toHaveAttribute('aria-checked', 'true');
  await box.locator('[data-action="invOverNote"]').fill('Thirty more came on the same truck');
  await expect(page.locator('#invSaveBtn')).toBeEnabled();
  await page.locator('#invSaveBtn').click();
  await expect.poll(async () => (await readStoredState(page)).invoices.length).toBe(3);
  const ack = (await readStoredState(page)).invoices[2].items[0].overBillAck;
  expect(ack).toMatchObject({ left: 100, reason: 'other', note: 'Thirty more came on the same truck' });
  expect(typeof ack.at).toBe('number');

  await g(page, "openInvoiceDetail('" + (await readStoredState(page)).invoices[2].id + "')");
  await expect(page.locator('[data-ack-tag]').first()).toContainText('Billed over the 100 left on its challan line: Other — Thirty more came on the same truck');
  expect(native).toEqual([]);
});

test('a unit changed on a challan line says it cannot be compared, asks why, and closes the line', async ({ page }) => {
  await loadAppWithState(page, partStateBilled(200));
  await pickChallan(page, 'samarth', 'IM-301');
  await page.locator('select[data-field="unit"][data-idx="0"]').selectOption('KG');
  const box = page.locator('#invImShare0');
  await expect(box.locator('[data-im-unit]')).toContainText('Cannot be compared with challan 301: it holds 600 NOS, 200 invoiced, and this line bills it in KG');
  await expect(box.locator('[data-im-unit]')).toContainText('this line closes the challan line');
  await expect(box.locator('[data-im-over]')).toHaveCount(0);
  await expect(box.locator('[data-action="invUnitReason"]')).toHaveText(['Customer bills this part by weight now', 'Challan unit was wrong', 'Other']);
  await expect(page.locator('#invErrorsArea')).toContainText('Line 1: billed in KG, challan 301 says NOS — pick a reason');
  await expect(page.locator('#invSaveBtn')).toBeDisabled();

  await page.locator('input[data-field="qty"][data-idx="0"]').fill('52.5');
  await page.locator('input[data-field="rate"][data-idx="0"]').fill('14.5');
  await box.locator('[data-action="invUnitReason"][data-reason="billing"]').click();
  await page.locator('#invSaveBtn').click();
  await expect.poll(async () => (await readStoredState(page)).invoices.length).toBe(2);
  const st = await readStoredState(page);
  expect(st.invoices[1].items[0]).toMatchObject({ unit: 'KG', qty: 52.5, imItemId: 'IM-301-0' });
  expect(st.invoices[1].items[0].unitChangeAck).toMatchObject({ from: 'NOS', to: 'KG', reason: 'billing' });
  // 52.5 kg cannot be netted against 400 pieces left: the line is billed whole, never left open for ever.
  expect(await line(page)).toMatchObject({ unit: 'NOS', qty: 600, billedQty: 600, invoiced: true });
  // The challan is the customer's paper: a new invoice never rewrites it.
  expect((await line(page)).corrections).toBeUndefined();
  await switchTab(page, 'pageIM');
  await expect(page.locator('[data-im="IM-301"] .inv-row-end .inv-dot')).toHaveText('Invoiced');
});

test('the unit put back asks nothing and keeps no record of a change', async ({ page }) => {
  await loadAppWithState(page, partState());
  await pickChallan(page, 'samarth', 'IM-301');
  const unit = page.locator('select[data-field="unit"][data-idx="0"]');
  await unit.selectOption('KG');
  await page.locator('#invImShare0 [data-action="invUnitReason"][data-reason="challan"]').click();
  await unit.selectOption('NOS');
  await expect(page.locator('#invImShare0 [data-im-unit]')).toHaveCount(0);
  await expect(page.locator('#invSaveBtn')).toBeEnabled();
  await page.locator('#invSaveBtn').click();
  await expect.poll(async () => (await readStoredState(page)).invoices.length).toBe(1);
  const li = (await readStoredState(page)).invoices[0].items[0];
  expect(li.unitChangeAck).toBeUndefined();
  expect(li.overBillAck).toBeUndefined();
  expect(await line(page)).toMatchObject({ billedQty: 600, invoiced: true });
});

test('"Challan unit was wrong" on a whole line carries the unit back as a correction; another reason does not', async ({ page }) => {
  // One invoice billing the whole 600 NOS line, edited to 150 KG.
  for (const [reason, carried] of [['challan', true], ['billing', false]] as const) {
    await loadAppWithState(page, partStateBilled(600));
    await g(page, "editInvoice('INV-1')");
    await page.locator('select[data-field="unit"][data-idx="0"]').selectOption('KG');
    await page.locator('input[data-field="qty"][data-idx="0"]').fill('150');
    await page.locator(`#invImShare0 [data-action="invUnitReason"][data-reason="${reason}"]`).click();
    await page.locator('#invSaveBtn').click();
    await expect(page.locator('.inv-toast')).toContainText('Invoice updated');
    const st = await readStoredState(page);
    expect(st.invoices[0].items[0].unitChangeAck).toMatchObject({ from: 'NOS', to: 'KG', reason });
    const it = await line(page);
    if (carried) expect(it).toMatchObject({ unit: 'KG', qty: 150, invoiced: true });
    else { expect(it).toMatchObject({ unit: 'NOS', qty: 600, invoiced: true, billedQty: 600 }); expect(it.corrections).toBeUndefined(); }
  }
});

test('an over-bill accepted before reasons were asked still loads and shows, and is asked for one only if edited while over', async ({ page }) => {
  const s = partStateBilled(200, 300);
  const old: any = partInvoice(3, 130);
  old.items[0].overBillAck = { at: recentTs(60_000), left: 100 };
  s.invoices = [...(s.invoices as any[]), old] as never;
  s.invNextNum = 4;
  await loadAppWithState(page, s);
  expect(await line(page)).toMatchObject({ billedQty: 630, invoiced: true });

  // Read: accepted, no reason recorded — not passed off as explained.
  await g(page, "openInvoiceDetail('INV-3')");
  await expect(page.locator('[data-ack-tag]')).toContainText('Billed over the 100 left on its challan line: accepted, no reason recorded');
  await g(page, 'closeOverlay()');

  // Edited while still over: the reason is asked for, and the save waits for it.
  await g(page, "editInvoice('INV-3')");
  const box = page.locator('#invImShare0');
  await expect(box.locator('[data-ack="over"]')).toContainText('Accepted earlier with no reason recorded');
  await expect(page.locator('#invSaveBtn')).toBeDisabled();
  await box.locator('[data-action="invOverReason"][data-reason="challan"]').click();
  await page.locator('#invSaveBtn').click();
  await expect(page.locator('.inv-toast')).toContainText('Invoice updated');
  const ack = (await readStoredState(page)).invoices[2].items[0].overBillAck;
  expect(ack).toMatchObject({ left: 100, reason: 'challan' });

  // Edited back within what is left: nothing is asked, and the acknowledgement goes.
  await g(page, "editInvoice('INV-3')");
  await page.locator('input[data-field="qty"][data-idx="0"]').fill('100');
  await expect(box.locator('[data-ack="over"]')).toHaveCount(0);
  await page.locator('#invSaveBtn').click();
  await expect(page.locator('.inv-toast')).toContainText('Invoice updated');
  expect((await readStoredState(page)).invoices[2].items[0].overBillAck).toBeUndefined();
});

test('an old over-bill no longer over is saved without a question', async ({ page }) => {
  const s = partStateBilled(200);
  // Over what was left when it was saved (a 300 invoice since deleted); within it now.
  const old: any = partInvoice(2, 380);
  old.items[0].overBillAck = { at: recentTs(60_000), left: 100 };
  s.invoices = [...(s.invoices as any[]), old] as never;
  s.invNextNum = 3;
  await loadAppWithState(page, s);
  await g(page, "editInvoice('INV-2')");
  await expect(page.locator('#invImShare0 [data-ack="over"]')).toHaveCount(0);
  await expect(page.locator('#invSaveBtn')).toBeEnabled();
  await page.locator('#invSaveBtn').click();
  await expect(page.locator('.inv-toast')).toContainText('Invoice updated');
  expect((await readStoredState(page)).invoices[1].items[0].overBillAck).toBeUndefined();
});
