import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import path from 'path';
import { emptyState, loadAppWithState, noSeedIM, recentTs, switchTab, type SepState } from './fixtures';

// P59: Finance. Bank and Bills & notes moved out of Stock into a page of their own, which opens on an
// overview read across them (owner, 26 Sep 2026: "The entire finance sector of our app needs a
// dashboard"). The statement fixtures are fake and carry fixed dates, so every assertion here reads
// a figure the statement fixes; nothing depends on today's date except the ageing, which is asserted
// only as a whole.

const JUL = path.join(__dirname, '..', 'fixtures', 'bank-jul.xls');
const JUL_AUG = path.join(__dirname, '..', 'fixtures', 'bank-jul-aug.xls');

function inv(n: number, date: string, taxable: number, clientId: number, clientName: string) {
  const tax = Math.round(taxable * 0.09 * 100) / 100;
  return {
    id: 'INV-' + n, invoiceNumber: String(n).padStart(5, '0'), displayNumber: 'SEP/TEST-' + String(n).padStart(5, '0'),
    date, status: 'active', invoiceState: 'dispatched', clientId, clientName, clientGSTIN: '', gstType: 'intra',
    clientAddress: { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' },
    items: [{ partNumber: 'P', desc: 'P', hsn: '998873', unit: 'KG', qty: 1, rate: taxable, amount: taxable, nosQty: null }],
    taxableValue: taxable, cgstPer: 9, cgstAmt: tax, sgstPer: 9, sgstAmt: tax, igstPer: 0, igstAmt: 0,
    grandTotal: Math.round((taxable + 2 * tax) * 100) / 100, amountInWords: '',
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
  // 10,000 + 5,000 + 2,000 taxable in July = 1,800 + 900 + 360 of CGST + SGST; 2,000 in June = 360.
  s.invoices = [inv(1, '2026-07-01', 10000, 1, 'ALPHA FORGINGS'), inv(2, '2026-07-02', 5000, 1, 'ALPHA FORGINGS'),
    inv(3, '2026-07-20', 2000, 1, 'ALPHA FORGINGS'), inv(4, '2026-06-25', 2000, 2, 'BETA AUTO')];
  s.creditNotes = [{ id: 'CN1', cnNumber: '001', displayNumber: 'CN/001/26-27', kind: 'adjustment', date: '2026-07-15', clientId: 1, clientName: 'ALPHA FORGINGS',
    taxableValue: 100, cgstAmt: 9, sgstAmt: 9, igstAmt: 0, grandTotal: 118, status: 'active' }];
  s.staff = [{ id: 7, name: 'Ramu Kumar', comp: 'monthly', dayRate: 500, hourRate: 0, area: 'vat-a1', onFloor: true, active: true }];
  return s;
}

async function importXls(page: Page, file: string) {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-action="invBankImport"]').click()]);
  const before = await page.evaluate(() => ((window as any).bankData().imports || []).length);
  await chooser.setFiles(file);
  await page.waitForFunction(n => (window as any).bankData().imports.length > n, before);
}
const finTab = (page: Page, t: string) => page.locator(`[data-action="invFinTab"][data-tab="${t}"]`).click();

test('Finance is reached from More, and Stock keeps only the chemicals', async ({ page }) => {
  await loadAppWithState(page, state());
  await page.locator('.inv-navbar-more').click();
  await page.locator('.inv-more-item[data-tab="pageFinance"]').click();
  await expect(page.locator('#pageFinance')).toHaveClass(/inv-page-active/);
  await expect(page.locator('#financeContent [data-action="invFinTab"]')).toHaveText(['Overview', 'Receivables', 'Payments', 'Bank', 'Bills & notes', 'GST']);
  await switchTab(page, 'pageStock');
  await expect(page.locator('#pageStock [data-action="invStockTab"]')).toHaveCount(0);
});

test('with no statement the overview says so, and GST due still reads from the invoices', async ({ page }) => {
  await loadAppWithState(page, state());
  await switchTab(page, 'pageFinance');
  await expect(page.locator('[data-fin-tile="balance"]')).toContainText('no statement imported');
  await expect(page.locator('#finGst')).toBeVisible();
  const g = await page.evaluate(() => (window as any).finGstByMonth(['2026-06', '2026-07'], []));
  expect(g.map((r: any) => r.due)).toEqual([360, 3060 - 18]);   // three July invoices; July's note takes its own tax off
});

test('the overview reads the statement: balance, cash by month, what went where, and GST paid', async ({ page }) => {
  await loadAppWithState(page, state());
  await switchTab(page, 'pageFinance');
  await finTab(page, 'bank');
  await importXls(page, JUL);
  await importXls(page, JUL_AUG);
  await finTab(page, 'overview');

  // The balance tile names the day it is from, and an overdraft reads as one.
  const bal = page.locator('[data-fin-tile="balance"]');
  await expect(bal).toContainText('-₹84,624.50');
  await expect(bal).toContainText('on 14 Aug 2026');
  await expect(bal).toHaveClass(/inv-tile-danger/);
  // Two cheque deposits name nobody: the owed figure reads high until they are placed, and says so.
  await expect(page.locator('[data-fin-tile="owed"]')).toContainText('2 receipts not placed');
  await expect(page.locator('[data-fin-tile="owed"]')).toHaveClass(/inv-tile-warning/);

  // July: 50,000 + 17,700 + 3,000 received, and a returned 100 in and out.
  await expect(page.locator('[data-cash="2026-07"] td').nth(1)).toHaveText('₹70,800');   // the overview reads in whole rupees

  // Where money went, in July: the JBVNL payment and every SELF draw (40,000 + 5,000) as cash wages.
  await page.locator('#finMonthPick').selectOption('2026-07');
  const went = page.locator('#finWent');
  await expect(went).toContainText('Electricity');
  await expect(went).toContainText('₹61,234.50');
  await expect(went).toContainText('Wages (cash)');
  await expect(went).toContainText('₹45,000.00');

  // July's GST payment (11 Jul) pays June's return.
  const g = await page.evaluate(() => { const w = window as any; return w.finGstByMonth(['2026-06'], w.bankClassify())[0]; });
  expect(g).toMatchObject({ month: '2026-06', due: 360, paid: 8000 });

  // What is owed ages into bands that add up to the total, and a debtor opens on Receivables.
  const owed = await page.evaluate(() => { const w = window as any; const r = w.bankReceivables(w.bankClassify());
    return { total: r.reduce((s: number, x: any) => s + Math.max(0, x.owed), 0), bands: w.finAgeing(r).reduce((s: number, b: any) => s + b.amount, 0) }; });
  expect(Math.round(owed.bands * 100)).toBe(Math.round(owed.total * 100));
  await page.locator('#finOwed [data-action="invFinClient"][data-id="1"]').click();
  await expect(page.locator('[data-action="invFinTab"][data-tab="receipts"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-recv="1"] [data-action="invBankClient"]')).toHaveAttribute('aria-expanded', 'true');
});

test('the To-do\'s missing electricity bill opens Finance on Bills & notes', async ({ page }) => {
  await loadAppWithState(page, state());
  await page.evaluate(() => (window as any).todoGo({ kind: 'bills', month: '2026-08' }));
  await expect(page.locator('#pageFinance')).toHaveClass(/inv-page-active/);
  await expect(page.locator('[data-action="invFinTab"][data-tab="bills"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#pageFinance #costBillMonth')).toHaveValue('2026-08');
});
