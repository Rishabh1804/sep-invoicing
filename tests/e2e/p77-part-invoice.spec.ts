import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { loadAppWithState, readStoredState, switchTab, openStatsTab, openPulse } from './fixtures';
import { partState, partStateBilled, partInvoice } from './p77-part-invoice.fixture';

// P77: a challan invoiced in parts. What a challan line has billed is derived from the
// invoices naming it; the picker brings what is left; more than is left warns and is
// stamped; cancel and delete free a share; an edit changes only its own share.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);
const line = async (page: Page, id = 'IM-301-0') =>
  (await readStoredState(page)).incomingMaterial.flatMap((m: any) => m.items).find((it: any) => it.id === id);

async function pickChallan(page: Page, search: string, imId: string) {
  await switchTab(page, 'pageCreate');
  await page.locator('#invClientSearch').fill(search);
  await page.locator('[data-action="invSelectClient"]').first().click();
  await page.locator(`[data-action="invCreatePickChallan"][data-id="${imId}"]`).check();
}

async function invoiceQty(page: Page, qty: number | null, count: number) {
  await pickChallan(page, 'samarth', 'IM-301');
  if (qty != null) await page.locator('input[data-field="qty"][data-idx="0"]').fill(String(qty));
  await page.locator('#invSaveBtn').click();
  await expect.poll(async () => (await readStoredState(page)).invoices.length).toBe(count);
}

async function imStatus(page: Page) {
  await switchTab(page, 'pageIM');
  // A challan billed whole is listed under Invoiced.
  if (!(await page.locator('[data-im="IM-301"]').count())) await page.locator('[data-action="invIMTab"][data-tab="invoiced"]').click();
  return page.locator('[data-im="IM-301"] .inv-row-end .inv-dot');
}

test('600 invoiced as 200, 300 and 100: the share left, the status and the unbilled amounts follow', async ({ page }) => {
  await loadAppWithState(page, partState());
  await openPulse(page);

  await invoiceQty(page, 200, 1);
  let it = await line(page);
  expect(it).toMatchObject({ billedQty: 200, invoiced: false });
  expect(it.invoiceIds).toEqual([(await readStoredState(page)).invoices[0].id]);
  expect((await readStoredState(page)).invoices[0].items[0]).toMatchObject({ qty: 200, amount: 500, imItemId: 'IM-301-0' });
  await expect(await imStatus(page)).toHaveText('Part invoiced');
  // Home: the unbilled amount is the open share, never the whole line.
  await openPulse(page);
  await expect(page.locator('#homeUnbilledCard')).toContainText('₹2,300.00');   // 400 × 2.50 + challan 401's 1,300

  // The picker offers what is left, and says what went before.
  await pickChallan(page, 'samarth', 'IM-301');
  await expect(page.locator('[data-im-share]').first()).toContainText('600 on challan 301 · 200 invoiced (SEP/TEST-00001) · 400 left');
  await expect(page.locator('input[data-field="qty"][data-idx="0"]')).toHaveValue('400');
  await expect(page.locator('input[data-field="amount"][data-idx="0"]')).toHaveValue('1000.00');
  await page.locator('input[data-field="qty"][data-idx="0"]').fill('300');
  await expect(page.locator('input[data-field="amount"][data-idx="0"]')).toHaveValue('750.00');
  await page.locator('#invSaveBtn').click();
  await expect.poll(async () => (await readStoredState(page)).invoices.length).toBe(2);
  it = await line(page);
  expect(it.billedQty).toBe(500);
  expect(it.invoiceIds).toHaveLength(2);
  // What is left to bill is Pipeline's first stage (Stats → Billing's Unbilled card went there: the tab map, TM2b).
  await switchTab(page, 'pagePipeline');
  await expect(page.locator('[data-pipe-stage="awaiting"]')).toContainText('₹1,550.00');   // 100 × 2.50 + 1,300

  // The third takes what is left without typing, and closes the line.
  await invoiceQty(page, null, 3);
  it = await line(page);
  expect(it).toMatchObject({ billedQty: 600, invoiced: true });
  expect(it.invoiceIds).toHaveLength(3);
  expect((await readStoredState(page)).invoices[2].items[0]).toMatchObject({ qty: 100, amount: 250 });
  await expect(await imStatus(page)).toHaveText('Invoiced');
  await switchTab(page, 'pageCreate');
  await page.locator('#invClientSearch').fill('samarth');
  await page.locator('[data-action="invSelectClient"]').first().click();
  await expect(page.locator('[data-action="invCreatePickChallan"][data-id="IM-301"]')).toHaveCount(0);
});

test('cancelling the 300 invoice reopens 300; deleting the 100 frees it too', async ({ page }) => {
  await loadAppWithState(page, partStateBilled(200, 300, 100));
  // The boot sync derives the billing from the invoices alone.
  expect(await line(page)).toMatchObject({ billedQty: 600, invoiced: true, invoiceId: 'INV-3' });

  await g(page, "confirmCancelInvoice('INV-2')");
  await expect.poll(async () => (await line(page)).billedQty).toBe(300);
  expect(await line(page)).toMatchObject({ invoiced: false, invoiceIds: ['INV-1', 'INV-3'] });
  await expect(await imStatus(page)).toHaveText('Part invoiced');

  await g(page, "deleteInvoice('INV-3')");
  await page.locator('#invDeleteReason').fill('test: dispatch not sent');
  await page.locator('[data-action="invConfirmDelete"]').click();
  await expect.poll(async () => (await line(page)).billedQty).toBe(200);
  expect(await line(page)).toMatchObject({ invoiced: false, invoiceIds: ['INV-1'], invoiceId: 'INV-1' });

  // The picker now offers the 400 the two freed.
  await pickChallan(page, 'samarth', 'IM-301');
  await expect(page.locator('input[data-field="qty"][data-idx="0"]')).toHaveValue('400');
});

test('editing the 200 invoice to 250 changes its share only, never the challan', async ({ page }) => {
  await loadAppWithState(page, partStateBilled(200, 300));
  await g(page, "editInvoice('INV-1')");
  const qty = page.locator('input[data-field="qty"][data-idx="0"]');
  await expect(qty).toHaveValue('200');
  await qty.fill('250');
  // Its own 200 counts as available while it is edited: 600 − 300 = 300 left, so 250 is not over.
  await expect(page.locator('#invImShare0 [data-im-share]')).toContainText('600 on challan 301 · 300 invoiced (SEP/TEST-00002) · 300 left');
  await expect(page.locator('#invImShare0 [data-im-over]')).toHaveCount(0);
  await expect(page.locator('input[data-field="amount"][data-idx="0"]')).toHaveValue('625.00');
  await page.locator('#invSaveBtn').click();
  await expect(page.locator('.inv-toast')).toContainText('Invoice updated');
  await expect(page.locator('.inv-toast')).not.toContainText('corrected');

  const st = await readStoredState(page);
  const it = st.incomingMaterial[0].items[0];
  expect(it).toMatchObject({ qty: 600, amount: 1500, billedQty: 550, invoiced: false });
  expect(it.corrections).toBeUndefined();
  expect(st.invoices[0].items[0]).toMatchObject({ qty: 250, amount: 625 });
});

test('billing more than is left warns, asks for a reason, and stamps the line', async ({ page }) => {
  await loadAppWithState(page, partStateBilled(200, 300));
  await pickChallan(page, 'samarth', 'IM-301');
  await page.locator('input[data-field="qty"][data-idx="0"]').fill('130');
  await expect(page.locator('#invImShare0 [data-im-over]')).toContainText('30 over what is left on challan 301');

  // No reason yet: once the field is left (the tab map, TM5h: no error before), the save is held and the error names the line.
  await page.locator('input[data-field="qty"][data-idx="0"]').blur();
  await expect(page.locator('#invSaveBtn')).toBeDisabled();
  await expect(page.locator('#invErrorsArea')).toContainText('Line 1: 30 over what is left on challan 301');
  expect((await readStoredState(page)).invoices).toHaveLength(2);

  // A reason: saved, and the line says why it was billed over what was left.
  await page.locator('#invImShare0 [data-action="invOverReason"][data-reason="dispatched"]').click();
  await page.locator('#invSaveBtn').click();
  await expect.poll(async () => (await readStoredState(page)).invoices.length).toBe(3);
  const st = await readStoredState(page);
  expect(st.invoices[2].items[0].overBillAck).toMatchObject({ left: 100, reason: 'dispatched' });
  expect(typeof st.invoices[2].items[0].overBillAck.at).toBe('number');
  expect(await line(page)).toMatchObject({ billedQty: 630, invoiced: true });
});

test('a legacy fully-invoiced line stays invoiced after migration, and after its invoice is edited', async ({ page }) => {
  const s = partState();
  // Saved before invoice lines named their challan line, on a quantity that differs from it.
  (s.incomingMaterial[0] as any).items[0].invoiced = true;
  (s.incomingMaterial[0] as any).items[0].invoiceId = 'INV-9';
  const inv: any = partInvoice(9, 590);
  delete inv.items[0].imItemId;
  s.invoices = [inv] as never;
  s.invNextNum = 10;
  await loadAppWithState(page, s);
  expect(await line(page)).toMatchObject({ invoiced: true, billedQty: 600, billedLegacy: true, invoiceIds: ['INV-9'] });
  await expect(await imStatus(page)).toHaveText('Invoiced');

  await g(page, "editInvoice('INV-9')");
  await page.locator('#invSaveBtn').click();
  await expect(page.locator('.inv-toast')).toContainText('Invoice updated');
  const st = await readStoredState(page);
  // Linked now, as billing the whole line — nothing is reopened.
  expect(st.invoices[0].items[0]).toMatchObject({ imItemId: 'IM-301-0', imWhole: true, qty: 590 });
  expect(st.incomingMaterial[0].items[0]).toMatchObject({ invoiced: true, billedQty: 600, qty: 600 });
  expect(st.incomingMaterial[0].items[0].billedLegacy).toBeUndefined();
});

test('a KG line part-invoiced by kilograms carries its pieces in proportion', async ({ page }) => {
  await loadAppWithState(page, partState());
  await pickChallan(page, 'kg test', 'IM-401');
  await page.locator('input[data-field="qty"][data-idx="0"]').fill('40');
  await expect(page.locator('input[data-field="nosQty"][data-idx="0"]')).toHaveValue('160');
  await expect(page.locator('input[data-field="amount"][data-idx="0"]')).toHaveValue('520.00');
  await page.locator('#invSaveBtn').click();
  await expect.poll(async () => (await readStoredState(page)).invoices.length).toBe(1);
  expect(await line(page, 'IM-401-0')).toMatchObject({ billedQty: 40, billedNos: 160, invoiced: false });

  await pickChallan(page, 'kg test', 'IM-401');
  await expect(page.locator('input[data-field="qty"][data-idx="0"]')).toHaveValue('60');
  await expect(page.locator('input[data-field="nosQty"][data-idx="0"]')).toHaveValue('240');
  await expect(page.locator('input[data-field="amount"][data-idx="0"]')).toHaveValue('780.00');
  await expect(page.locator('[data-im-share]').first()).toContainText('100 kg on challan 401 · 40 kg invoiced (SEP/TEST-00001) · 60 kg left');
});

test('the IM line shows what was billed, what is left, and the invoices it went on', async ({ page }) => {
  await loadAppWithState(page, partStateBilled(200, 300));
  await switchTab(page, 'pageIM');
  await page.locator('[data-action="invToggleIM"][data-id="IM-301"]').click();
  const row = page.locator('[data-im-item]').filter({ hasText: 'TEST BRACKET 77' });
  await expect(row.locator('[data-im-share]')).toContainText('500 billed · 100 left');
  await expect(row.locator('[data-action="invViewInvoiceDetail"]')).toHaveCount(2);
  // Still tickable: 100 is left to bill.
  await expect(row.locator('[data-action="invCheckIMItem"]')).toHaveCount(1);
  await row.locator('[data-action="invViewInvoiceDetail"]').first().click();
  await expect(page.locator('.inv-scrim-dialog')).toContainText('SEP/TEST-00001');
  // A part-invoiced challan cannot be edited any more than an invoiced one.
  expect(await g(page, "imLineBilled(S.incomingMaterial[0].items[0])")).toBe(true);
});
