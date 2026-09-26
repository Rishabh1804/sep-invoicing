import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import path from 'path';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, recentTs, switchTab, type SepState } from './fixtures';

// P57: Stock → Bank. The bank's own .xls export read as it is, rows merged across overlapping
// statements, receipts set against invoices, and the payments set against what the app records.
// The fixtures are FAKE statements in Bank of Baroda's layout (every name and figure invented);
// their dates are fixed because a file cannot carry todayIso(), so nothing here reads the clock.

const JUL = path.join(__dirname, '..', 'fixtures', 'bank-jul.xls');          // 1–31 Jul 2026, 312 rows
const JUL_AUG = path.join(__dirname, '..', 'fixtures', 'bank-jul-aug.xls');  // 15 Jul – 31 Aug, overlaps it

function inv(n: number, date: string, gross: number, clientId: number, clientName: string) {
  const taxable = Math.round(gross / 1.18 * 100) / 100;
  return {
    id: 'INV-' + n, invoiceNumber: String(n).padStart(5, '0'), displayNumber: 'SEP/TEST-' + String(n).padStart(5, '0'),
    date, status: 'active', invoiceState: 'dispatched', clientId, clientName, clientGSTIN: '', gstType: 'intra',
    clientAddress: { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' },
    items: [{ partNumber: 'P', desc: 'P', hsn: '998873', unit: 'KG', qty: 1, rate: taxable, amount: taxable, nosQty: null }],
    taxableValue: taxable, cgstPer: 9, cgstAmt: 0, sgstPer: 9, sgstAmt: 0, igstPer: 0, igstAmt: 0, grandTotal: gross, amountInWords: '',
    challanNo: '', challanDate: '', poNumber: '', poDate: '', despatchDate: '', transport: '', remarks: '', createdAt: recentTs(),
  };
}

function state(): SepState {
  const s = emptyState() as any;
  s.incomingMaterial = noSeedIM();
  s.clients = [
    { id: 1, name: 'ALPHA FORGINGS', billingMode: 'weight', gstType: 'intra', gstin: '', address: '', isActive: true, rates: [], itemRates: [] },
    { id: 2, name: 'BETA AUTO', billingMode: 'weight', gstType: 'intra', gstin: '', address: '', isActive: true, rates: [], itemRates: [] },
  ];
  s.invoices = [inv(1, '2026-07-01', 11800, 1, 'ALPHA FORGINGS'), inv(2, '2026-07-02', 5900, 1, 'ALPHA FORGINGS'),
    inv(3, '2026-07-20', 2360, 1, 'ALPHA FORGINGS'), inv(4, '2026-07-25', 5900, 2, 'BETA AUTO')];
  // Numbered ids, as real rosters have: the picker hands back text (CLAUDE.md, relay placements).
  s.staff = [
    { id: 7, name: 'Ramu Kumar', comp: 'monthly', dayRate: 500, hourRate: 0, area: 'vat-a1', onFloor: true, active: true },
    { id: 8, name: 'Gita Devi', comp: 'monthly', dayRate: 400, hourRate: 0, area: 'vat-a2', onFloor: true, active: true },
  ];
  s.payrollPaid = [{ id: 'PP1', month: '2026-06', status: 'paid', source: 'test', at: 1, rows: [
    { name: 'RAMU KUMAR', dayPay: 11500, ot: 500 }, { name: 'GITA DEVI', dayPay: 10000, ot: 0 }] }];
  s.stock = { items: [{ id: 'SI1', name: 'Nitric Acid', key: 'NITRICACID', aliases: [], unit: 'kg', basis: 'draw' }],
    entries: [{ id: 'SE1', itemId: 'SI1', kind: 'bill', date: '2026-07-08', qty: 100, price: 150, amount: 15000, supplier: 'Acme Chemicals', at: 1 }], pastes: [] };
  return s;
}

async function openBank(page: Page) {
  await switchTab(page, 'pageStock');
  await page.locator('[data-action="invStockTab"][data-tab="bank"]').click();
}
async function importXls(page: Page, file: string) {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-action="invBankImport"]').click()]);
  await chooser.setFiles(file);
}

test('the bank\'s own .xls is read as it is, and every balance follows from the row before', async ({ page }) => {
  await loadAppWithState(page, state());
  await openBank(page);
  await importXls(page, JUL);
  await expect(page.locator('#bankHead')).toContainText('312 rows');
  await expect(page.locator('#bankHead')).toContainText('001XXXXXXXX999');
  await expect(page.locator('[data-bank-breaks="0"]')).toBeVisible();
  const b = (await readStoredState(page)).bank;
  expect(b.rows).toHaveLength(312);
  // Newest-first in the file, oldest-first in the record, the bank's own order inside a day kept.
  expect(b.rows.find((r: any) => r.narration === 'TO SELF')).toMatchObject({ date: '2026-07-05', dr: 40000, cr: 0, chq: '000101' });
});

test('an overlapping statement adds only its new rows, and the join holds', async ({ page }) => {
  await loadAppWithState(page, state());
  await openBank(page);
  await importXls(page, JUL);
  await importXls(page, JUL_AUG);
  await expect(page.locator('#bankHead')).toContainText('316 rows');
  await expect(page.locator('[data-bank-breaks="0"]')).toBeVisible();
  const b = (await readStoredState(page)).bank;
  expect(b.imports.map((i: any) => i.added)).toEqual([312, 4]);
  // The August overdraft is read as one: a Dr balance is negative.
  expect(b.rows[b.rows.length - 1].balance).toBe(-84624.5);
});

test('a file that is not a statement is refused with a reason', async ({ page }) => {
  await loadAppWithState(page, state());
  await openBank(page);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-action="invBankImport"]').click()]);
  await chooser.setFiles({ name: 'notes.xls', mimeType: 'application/vnd.ms-excel', buffer: Buffer.from('not a spreadsheet') });
  await expect(page.locator('.inv-toast').last()).toContainText('Not an Excel 97–2003 file');
  expect((await readStoredState(page)).bank?.rows || []).toHaveLength(0);
});

test('each row is read for what it is, and every SELF draw is wages', async ({ page }) => {
  await loadAppWithState(page, state());
  await openBank(page);
  await importXls(page, JUL);
  const got = await page.evaluate(() => {
    const w = window as any, out: Record<string, any> = {};
    w.bankClassify().forEach((v: any) => { if (!/^Charges/.test(v.row.narration)) out[v.row.narration + '|' + (v.row.dr || v.row.cr)] = [v.cat, v.clientId ?? null, v.staffId ?? null, !!v.cash]; });
    return out;
  });
  expect(got['NEFT-HDFCH00000001-ALPHA FORGINGS PRIVATE LIM|17700']).toEqual(['receipt', 1, null, false]);
  expect(got['BY INST 100001 - MICR CLG (CTS)|50000']).toEqual(['receipt', null, null, false]);
  expect(got['NEFT-BARBP00000002-RAMU KUMAR-STATE BANK OF I|12000']).toEqual(['wages', null, 7, false]);
  expect(got['TO SELF|40000']).toEqual(['wages', null, null, true]);
  expect(got['SELF|5000']).toEqual(['wages', null, null, true]);
  expect(got['NEFT-BARBP00000004-JHARKHAND BIJLI VITRAN NIGAM|61234.5']).toEqual(['power', null, null, false]);
  expect(got['EBANK:1502170672\\26071100000001\\GST|8000']).toEqual(['gst', null, null, false]);
  expect(got['ACME CHEMICALS-MICR INWARD CLG (CTS)|15000']).toEqual(['supplier', null, null, false]);
  expect(got['REJECT:00000005:99:Advice not received|100']).toEqual(['reversal', null, null, false]);
});

test('a receipt that equals a run of invoices is exact; a cheque with no name is placed by hand', async ({ page }) => {
  await loadAppWithState(page, state());
  await openBank(page);
  await importXls(page, JUL);
  await importXls(page, JUL_AUG);
  const alpha = page.locator('[data-recv="1"]');
  await expect(alpha).toContainText('₹2,360.00');
  await alpha.locator('[data-action="invBankClient"]').click();
  await expect(page.locator('[data-alloc]').first()).toContainText('Exact');
  await expect(page.locator('[data-alloc]').first()).toContainText('SEP/TEST-00001, SEP/TEST-00002');
  await expect(page.locator('[data-open-inv="SEP/TEST-00003"]')).toBeVisible();
  await expect(page.locator('[data-recv="2"]')).toContainText('₹0.00');

  // Two cheques deposited carry no name. The ₹3,000 one is BETA's: it lands on the row, not on a payee.
  await expect(page.locator('#bankLoose [data-loose]')).toHaveCount(2);
  const cheque = page.locator('#bankLoose [data-loose]').filter({ hasText: '₹3,000.00' });
  await cheque.locator('select').selectOption('2');
  await expect(page.locator('#bankLoose [data-loose]')).toHaveCount(1);
  await expect(page.locator('[data-recv="2"]')).toContainText('paid ahead');
  const b = (await readStoredState(page)).bank;
  expect(Object.keys(b.parties)).toHaveLength(0);
  expect(b.rows.find((r: any) => r.cr === 3000).set).toMatchObject({ cat: 'receipt', clientId: 2 });
});

test('an electricity payment becomes the month\'s bill, and wages are set against the slip', async ({ page }) => {
  await loadAppWithState(page, state());
  await openBank(page);
  await importXls(page, JUL);
  await page.locator('[data-action="invBankTab"][data-tab="payments"]').click();
  const pay = page.locator('#bankPower [data-power]');
  await expect(pay).toHaveCount(1);
  await expect(pay.locator('select')).toHaveValue('2026-06');
  await pay.locator('[data-action="invBankAddBill"]').click();
  await expect(page.locator('#bankPower [data-power]')).toContainText('Bill on record');
  const bills = (await readStoredState(page)).costBills;
  expect(bills).toHaveLength(1);
  expect(bills[0]).toMatchObject({ kind: 'power', month: '2026-06', amount: 61234.5 });

  // July's transfers pay June's slip: Ramu as the slip, Gita ₹500 short of it.
  await expect(page.locator('[data-wage="2026-07:7"]')).toContainText('as the slip');
  await expect(page.locator('[data-wage="2026-07:8"]')).toContainText('short ₹500.00');
  await expect(page.locator('#bankWages')).toContainText('Cash drawn');
  await expect(page.locator('#bankSuppliers')).toContainText('stock bills recorded ₹15,000.00');
});

test('a SELF draw set to Other leaves the wages, and a payee setting reaches every row under that name', async ({ page }) => {
  await loadAppWithState(page, state());
  await openBank(page);
  await importXls(page, JUL);
  await page.locator('[data-action="invBankTab"][data-tab="statement"]').click();
  await page.locator('#bankSearch').fill('SELF');
  const selfRow = page.locator('[data-bank-row]').filter({ hasText: '5,000.00' });
  await selfRow.locator('[data-action="invBankEdit"]').click();
  // A cash draw has no payee to remember: the setting is the row's own.
  await expect(page.locator('#bankEditAll')).toHaveCount(0);
  await page.locator('#bankEditCat').selectOption('other');
  await page.locator('[data-action="invBankEditSave"]').click();
  const wagesCash = await page.evaluate(() => (window as any).bankClassify().filter((v: any) => v.cash && v.cat === 'wages').length);
  expect(wagesCash).toBe(1);

  await page.locator('#bankSearch').fill('ACME');
  await page.locator('[data-bank-row] [data-action="invBankEdit"]').first().click();
  await page.locator('#bankEditCat').selectOption('other');
  await expect(page.locator('#bankEditAll')).toBeChecked();
  await page.locator('[data-action="invBankEditSave"]').click();
  expect((await readStoredState(page)).bank.parties.ACMECHEMICALS).toMatchObject({ cat: 'other' });
});

test('a missing electricity month offers what the bank says was paid', async ({ page }) => {
  await loadAppWithState(page, state());
  await openBank(page);
  await importXls(page, JUL);
  // Bills & notes asks only for the last six closed months, so read the offer off the renderer
  // for June 2026 directly rather than off a list that depends on today's date.
  const offer = await page.evaluate(() => {
    const w = window as any;
    return w.bankPowerRows().filter((v: any) => w.bankBillMonth(v.row) === '2026-06').map((v: any) => v.row.dr);
  });
  expect(offer).toEqual([61234.5]);
});
