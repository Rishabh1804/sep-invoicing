import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, openStatsTab, readStoredState, recentTs, switchTab, todayIso, type SepState } from './fixtures';

// P56: Finance → Bills & notes (moved from Stock, 26 Sep 2026). The electricity bill and the credit note each had no door the owner
// could find (26 Sep 2026); a stock line's name had none at all.

function prevMonth(): string {
  const d = new Date(todayIso() + 'T00:00:00'); d.setDate(1); d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function inv(n: number, date: string, taxable: number) {
  return {
    id: 'INV-' + n, invoiceNumber: String(n).padStart(5, '0'), displayNumber: 'SEP/TEST-' + String(n).padStart(5, '0'),
    date, status: 'active', invoiceState: 'dispatched', clientId: 1, clientName: 'ALPHA', clientGSTIN: '20AAAAA0000A1Z5',
    clientAddress: { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' }, gstType: 'intra',
    items: [{ partNumber: 'P', desc: 'P', hsn: '998873', unit: 'KG', qty: 100, rate: 13, amount: taxable, nosQty: null }],
    taxableValue: taxable, cgstPer: 9, cgstAmt: 0, sgstPer: 9, sgstAmt: 0, igstPer: 0, igstAmt: 0, grandTotal: taxable, amountInWords: '',
    challanNo: '', challanDate: '', poNumber: '', poDate: '', despatchDate: '', transport: '', remarks: '', createdAt: recentTs(),
  };
}

function state(): SepState {
  const s = emptyState();
  s.incomingMaterial = noSeedIM() as any;
  s.clients = [{ id: 1, name: 'ALPHA', billingMode: 'weight', gstType: 'intra', gstin: '20AAAAA0000A1Z5', address: '', isActive: true,
    add1: 'PLOT 1, ADITYAPUR', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20',
    rates: [{ ratePerKg: 13, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [] }] as never;
  s.invoices = [inv(1, prevMonth() + '-12', 5000), inv(2, todayIso(), 3000)] as never;
  (s as any).stock = { items: [{ id: 'SI1', name: 'Nitric Acid', key: 'NITRICACID', aliases: [], unit: 'kg', basis: 'draw' }], entries: [], pastes: [] };
  return s;
}

async function openBills(page: Page) {
  await switchTab(page, 'pageFinance');
  await page.locator('[data-action="invFinTab"][data-tab="bills"]').click();
}

test('a closed month with no electricity bill is listed, and Add fills in that month', async ({ page }) => {
  await loadAppWithState(page, state());
  await openBills(page);
  const m = prevMonth();
  const missing = page.locator(`[data-missing="${m}"]`);
  await expect(missing).toContainText('No electricity bill');
  await missing.locator('[data-action="invCostBillOpen"]').click();
  await expect(page.locator('#costBillMonth')).toHaveValue(m);
  await expect(page.locator('#costBillKind')).toHaveValue('power');
  await page.locator('#costBillAmount').fill('61234.50');
  await page.locator('#costBillUnits').fill('7100');
  await page.locator('[data-action="invCostBillSave"]').click();
  await expect(page.locator(`[data-missing="${m}"]`)).toHaveCount(0);
  await expect(page.locator('#billsPower [data-bill]')).toContainText('Electricity');
  const bills = (await readStoredState(page)).costBills;
  expect(bills).toHaveLength(1);
  expect(bills[0]).toMatchObject({ kind: 'power', month: m, amount: 61234.5, units: 7100 });
});

test('the To-do asks for last month\'s bill once it is due, and not before', async ({ page }) => {
  await loadAppWithState(page, state());
  const tasks = await page.evaluate(() => (window as any).TODO_RULE_FNS.power());
  const day = parseInt(todayIso().slice(8, 10), 10);
  if (day >= 10) {
    expect(tasks).toHaveLength(1);
    expect(tasks[0].go).toEqual({ kind: 'bills', month: prevMonth() });
  } else {
    expect(tasks).toHaveLength(0);
  }
});

test('a note already issued is recorded with its own number, and that number is never issued again', async ({ page }) => {
  await loadAppWithState(page, state());
  await openBills(page);
  await page.locator('[data-action="invCnFormOpen"][data-mode="record"]').click();
  await page.locator('#cnfNum').fill('4');
  await page.locator('#cnfClient').selectOption('1');
  await page.locator('#cnfInv').selectOption('__typed');
  await page.locator('#cnfInvNo').fill('000443');
  await page.locator('#cnfReason').selectOption('rebate');
  await page.locator('#cnfTaxable').fill('3749.29');
  // Recomputed, 3,749.29 at 9% + 9% rounds each half up to 337.44: ₹4,424.17 gross.
  await expect(page.locator('[data-cn-figures]')).toContainText('₹4,424.17');
  // CN/004 as the customer holds it reads ₹4,424.16: the tax is entered as printed.
  await page.locator('#cnfCgst').fill('337.44');
  await page.locator('#cnfSgst').fill('337.43');
  await expect(page.locator('[data-cn-figures]')).toContainText('₹4,424.16');
  await page.locator('[data-action="invCnFormSave"]').click();

  let s = await readStoredState(page);
  expect(s.creditNotes).toHaveLength(1);
  expect(s.creditNotes[0]).toMatchObject({ cnNumber: '004', kind: 'rebate', recorded: true, againstInvoice: '000443', grandTotal: 4424.16 });
  expect(s.cnNextNum).toBeGreaterThanOrEqual(5);

  // The same number again is refused.
  await page.locator('[data-action="invCnFormOpen"][data-mode="record"]').click();
  await page.locator('#cnfNum').fill('4');
  await page.locator('#cnfClient').selectOption('1');
  await page.locator('#cnfInv').selectOption('__typed');
  await page.locator('#cnfInvNo').fill('000500');
  await page.locator('#cnfTaxable').fill('10');
  await page.locator('[data-action="invCnFormSave"]').click();
  s = await readStoredState(page);
  expect(s.creditNotes).toHaveLength(1);
});

test('a new note for a rate correction takes the next number and prints no batch annex', async ({ page }) => {
  await loadAppWithState(page, state());
  await openBills(page);
  await page.locator('[data-action="invCnFormOpen"][data-mode="new"]').click();
  // The batch rebate is not offered here: it is raised from a Register selection.
  await expect(page.locator('#cnfReason option[value="rebate"]')).toHaveCount(0);
  await page.locator('#cnfClient').selectOption('1');
  await page.locator('#cnfInv').selectOption('INV-2');
  await page.locator('#cnfReason').selectOption('rate');
  await page.locator('#cnfTaxable').fill('150');
  await page.locator('[data-action="invCnFormSave"]').click();
  await expect(page.locator('#invPrintBody')).toContainText('Rate correction');
  await expect(page.locator('#invPrintBody .inv-cn-annex')).toHaveCount(0);

  const s = await readStoredState(page);
  expect(s.creditNotes[0]).toMatchObject({ kind: 'adjustment', reasonKey: 'rate', againstInvoice: 'SEP/TEST-00002', taxableValue: 150, grandTotal: 177 });
  // A rate correction is not a rebate: the batch reminder does not treat it as one.
  expect(await page.evaluate(() => (window as any).getCreditNotes().filter((c: any) => (window as any).cnIsRebate(c)).length)).toBe(0);
});

test('Other needs a description', async ({ page }) => {
  await loadAppWithState(page, state());
  await openBills(page);
  await page.locator('[data-action="invCnFormOpen"][data-mode="new"]').click();
  await page.locator('#cnfClient').selectOption('1');
  await page.locator('#cnfInv').selectOption('INV-2');
  await page.locator('#cnfReason').selectOption('other');
  await page.locator('#cnfTaxable').fill('50');
  await page.locator('[data-action="invCnFormSave"]').click();
  expect((await readStoredState(page)).creditNotes || []).toHaveLength(0);
  await page.locator('#cnfNote').fill('Packing charge refunded');
  await page.locator('[data-action="invCnFormSave"]').click();
  expect((await readStoredState(page)).creditNotes[0].reason).toBe('Other: Packing charge refunded');
});

test('a stock line is renamed and re-united, and a message in the old name still finds it', async ({ page }) => {
  await loadAppWithState(page, state());
  await switchTab(page, 'pageStock');
  await page.locator('[data-action="invDashStockView"][data-view="list"]').click();
  await page.locator('[data-action="invStockOpen"][data-id="SI1"]').click();
  await page.locator('#stockEditName').fill('Nitric acid 68%');
  await page.locator('#stockEditUnit').selectOption('L');
  await page.locator('[data-action="invStockEditSave"]').click();
  const it = (await readStoredState(page)).stock.items[0];
  expect(it).toMatchObject({ name: 'Nitric acid 68%', unit: 'L' });
  expect(await page.evaluate(() => { const w = window as any; return w.stockFindByKey(w.stockKey('Nitric Acid'))?.id; })).toBe('SI1');
  expect(await page.evaluate(() => { const w = window as any; return w.stockFindByKey(w.stockKey('Nitric acid 68%'))?.id; })).toBe('SI1');
});

test('a form left open on Stats does not capture the Finance form\'s Save', async ({ page }) => {
  await loadAppWithState(page, state());
  await openStatsTab(page, 'cost');
  await page.locator('#liveCost [data-action="invCostBillOpen"]').click();
  // Left open; the same ids now also exist on Finance, and Stats comes first in the page.
  await openBills(page);
  const m = prevMonth();
  await page.locator(`[data-missing="${m}"] [data-action="invCostBillOpen"]`).click();
  await expect(page.locator('#pageFinance #costBillAmount')).toBeFocused();
  await page.locator('#pageFinance #costBillAmount').fill('4200');
  await page.locator('#pageFinance [data-action="invCostBillSave"]').click();
  const bills = (await readStoredState(page)).costBills;
  expect(bills).toHaveLength(1);
  expect(bills[0]).toMatchObject({ kind: 'power', month: m, amount: 4200 });
});

test('the taxable value is typed key by key without the form redrawing under it', async ({ page }) => {
  await loadAppWithState(page, state());
  await openBills(page);
  await page.locator('[data-action="invCnFormOpen"][data-mode="new"]').click();
  await page.locator('#cnfClient').selectOption('1');
  await page.locator('#cnfInv').selectOption('INV-2');
  await page.locator('#cnfTaxable').pressSequentially('150');
  await expect(page.locator('#cnfTaxable')).toHaveValue('150');
  await expect(page.locator('#cnfTaxable')).toBeFocused();
  await expect(page.locator('[data-cn-figures]')).toContainText('177.00');
});

test('a note recorded from an earlier year holds no number in this year\'s series', async ({ page }) => {
  const s0 = state();
  s0.invPrefix = 'SEP/2026-27/';
  await loadAppWithState(page, s0);
  await openBills(page);
  const record = async (num: string, fy: string, invNo: string) => {
    await page.locator('[data-action="invCnFormOpen"][data-mode="record"]').click();
    await page.locator('#cnfNum').fill(num);
    await page.locator('#cnfFy').fill(fy);
    await page.locator('#cnfClient').selectOption('1');
    await page.locator('#cnfInv').selectOption('__typed');
    await page.locator('#cnfInvNo').fill(invNo);
    await page.locator('#cnfTaxable').fill('100');
    await page.locator('[data-action="invCnFormSave"]').click();
  };
  await record('40', '25-26', '000100');
  let s = await readStoredState(page);
  expect(s.creditNotes).toHaveLength(1);
  expect(s.creditNotes[0].displayNumber).toBe('CN/040/25-26');
  // A typed invoice still gives the note the client's address, so its place of supply is the client's.
  expect(s.creditNotes[0].clientAddress).toMatchObject({ add1: 'PLOT 1, ADITYAPUR', stateCode: '20' });
  expect(s.cnNextNum).toBe(6);
  // And the same number in this year's series is its own number, not a duplicate of last year's.
  await record('40', '26-27', '000101');
  s = await readStoredState(page);
  expect(s.creditNotes).toHaveLength(2);
  expect(s.cnNextNum).toBe(41);
});

test('an adjustment note reads as its reason in the Register list, with no batch to re-pick', async ({ page }) => {
  await loadAppWithState(page, state());
  await openBills(page);
  await page.locator('[data-action="invCnFormOpen"][data-mode="new"]').click();
  await page.locator('#cnfClient').selectOption('1');
  await page.locator('#cnfInv').selectOption('INV-2');
  await page.locator('#cnfTaxable').fill('150');
  await page.locator('[data-action="invCnFormSave"]').click();
  await page.locator('[data-action="invClosePrint"]').click();
  await page.evaluate(() => (window as any).renderCreditNoteList());
  const row = page.locator('.inv-overlay-card .inv-row').first();
  await expect(row).toContainText('Rate correction');
  await expect(row).not.toContainText('% of');
  await expect(row.locator('[data-action="invCnSetAgainst"]')).toHaveCount(0);
});
