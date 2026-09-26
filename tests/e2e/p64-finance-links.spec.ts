import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, recentTs, switchTab, todayIso, type SepState } from './fixtures';

// P64: finance linked into every screen (docs/FINANCE_INTELLIGENCE_SPEC.md, Phase 6). Each screen carries the
// figure that belongs to it and a link that lands on the right place in Finance. Dates are built from today;
// names and figures are made up.

const day = (n: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

let seq = 0;
function row(date: string, narration: string, dr: number, cr: number, set?: any, balance = 250000) {
  const r: any = { id: 'BK-L' + (++seq), date, valueDate: date, narration, chq: '', dr, cr, balance, dayIdx: seq, importId: 'BI-L' };
  if (set) r.set = set;
  return r;
}
function inv(n: number, date: string, total: number) {
  const taxable = Math.round(total / 1.18 * 100) / 100, tax = Math.round((total - taxable) / 2 * 100) / 100;
  return { id: 'INV-' + n, invoiceNumber: String(n).padStart(5, '0'), displayNumber: 'T/' + String(n).padStart(5, '0'), date, status: 'active', invoiceState: 'dispatched',
    clientId: 1, clientName: 'ALPHA FORGINGS', gstType: 'intra', clientAddress: { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' },
    items: [{ partNumber: 'P', desc: 'P', hsn: '998873', unit: 'KG', qty: 100, rate: taxable / 100, amount: taxable }],
    taxableValue: taxable, cgstPer: 9, cgstAmt: tax, sgstPer: 9, sgstAmt: tax, igstPer: 0, igstAmt: 0, grandTotal: total, createdAt: recentTs() };
}
function state(withBank = true): SepState {
  const s = emptyState() as any;
  s.incomingMaterial = noSeedIM();
  s.clients = [{ id: 1, name: 'ALPHA FORGINGS', billingMode: 'weight', gstType: 'intra', gstin: '', address: '', isActive: true, rates: [], itemRates: [] }];
  s.staff = [{ id: 7, name: 'Ramu Kumar', comp: 'monthly', dayRate: 500, hourRate: 0, area: 'vat-a1', onFloor: true, active: true }];
  // 11,800 invoiced 40 days back and paid exactly 20 days later; 5,900 invoiced 10 days back, open.
  s.invoices = [inv(1, day(-40), 11800), inv(2, day(-10), 5900)];
  s.stock = { items: [{ id: 'SI1', name: 'Nitric acid', key: 'NITRIC', unit: 'L', active: true }],
    entries: [{ id: 'SE1', itemId: 'SI1', kind: 'bill', date: day(-30), billDate: day(-30), qty: 100, price: 150, amount: 15000, supplier: 'Acme Chemicals', at: 1 }], pastes: [] };
  if (withBank) {
    seq = 0;
    const rows = [row(day(-60), 'SMS CHARGES', 10, 0), row(day(-25), 'NEFT-ACME CHEMICALS', 15000, 0, { cat: 'supplier' }),
      row(day(-20), 'NEFT-ALPHA FORGINGS', 0, 11800, { cat: 'receipt', clientId: 1 }), row(day(-15), 'NEFT-RAMU KUMAR', 12000, 0, { cat: 'wages', staffId: 7 }),
      row(day(-1), 'SMS CHARGES', 10, 0)];
    s.bank = { rows, imports: [{ id: 'BI-L', at: 1, file: 't.xls', account: '', from: rows[0].date, to: rows[rows.length - 1].date, rows: rows.length, added: rows.length, closing: 250000 }],
      parties: {}, opening: {}, gstNotes: {} };
  }
  return s;
}
const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
const onFinanceTab = async (page: Page, tab: string) => {
  await expect(page.locator('#pageFinance')).toHaveClass(/inv-page-active/);
  await expect(page.locator(`[data-action="invFinTab"][data-tab="${tab}"]`)).toHaveAttribute('aria-selected', 'true');
};

test('Home: the Money strip reads the balance, what is owed and the runway, and each opens Finance', async ({ page }) => {
  await loadAppWithState(page, state());
  const strip = page.locator('#homeFin');
  await expect(strip.locator('[data-home-fin="Balance"]')).toContainText('₹2,50,000');
  await expect(strip.locator('[data-home-fin="Owed to us"]')).toContainText('₹5,900');
  await expect(strip.locator('[data-home-fin="Runway"]')).toBeVisible();
  await strip.locator('[data-home-fin="Owed to us"]').click();
  await onFinanceTab(page, 'receipts');
});

test('Home with no statement offers the import, which opens the file picker on Finance → Bank', async ({ page }) => {
  await loadAppWithState(page, state(false));
  await expect(page.locator('#homeFin')).toContainText('No bank statement yet');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-action="invHomeImportBank"]').click()]);
  expect(chooser).toBeTruthy();
  await onFinanceTab(page, 'bank');
});

test('Register: an invoice says what paid it, or how long it has been open', async ({ page }) => {
  await loadAppWithState(page, state());
  await switchTab(page, 'pageRegister');
  await ev(page, `openInvoiceDetail('INV-1')`);
  const paid = page.locator('[data-inv-payment]').first().locator('xpath=..');
  await expect(paid).toContainText('Paid, exact');
  await expect(paid).toContainText('₹11,800.00');
  await ev(page, `closeOverlay(); openInvoiceDetail('INV-2')`);
  await expect(page.locator('[data-inv-payment]').first().locator('xpath=..')).toContainText('Open, 10 days');
  await page.locator('[data-inv-payment] [data-action="invFinGo"]').first().click();
  await onFinanceTab(page, 'receipts');
  await expect(page.locator('[data-recv="1"] [data-action="invBankClient"]')).toHaveAttribute('aria-expanded', 'true');
});

test('Clients: a client carries what it owes, how fast it pays, and its last receipt', async ({ page }) => {
  await loadAppWithState(page, state());
  await switchTab(page, 'pageClients');
  await ev(page, `openClientEdit(1)`);
  const m = page.locator('[data-client-money="1"]').first();
  await expect(m).toContainText('Owed');
  await expect(m).toContainText('₹5,900.00');
  await expect(m).toContainText('20 days');               // 40 days back, paid 20 days back
  await expect(m).toContainText('Last receipt');
  // Performance carries the same panel.
  expect(await ev(page, `(function() { var d = document.createElement('div'); renderClientPerformance(d); return !!d.querySelector('[data-client-money="1"]'); })()`)).toBe(true);
  await m.locator('[data-action="invFinGo"]').click();
  await onFinanceTab(page, 'receipts');
});

test('Stats: In one line carries the cash, and contribution by client says what each owes and how fast it pays', async ({ page }) => {
  await loadAppWithState(page, state());
  await ev(page, `_statsPeriod = 'all'`);
  await switchTab(page, 'pageStats');
  await page.locator('[data-action="invStatsTab"][data-tab="overview"]').click();
  await expect(page.locator('#statsCash')).toContainText('₹2,50,000.00');
  await expect(page.locator('#statsCash')).toContainText('clients pay in 20 days');
  await page.locator('[data-action="invStatsTab"][data-tab="clients"]').click();
  await expect(page.locator('#statsMargin [data-client-owed]')).toContainText('owes ₹5,900.00 · pays in 20 d');
});

test('Staff → Pay shows the bank’s salary legs, and Payments links to it and back', async ({ page }) => {
  await loadAppWithState(page, state());
  await ev(page, `_attView = 'pay'`);
  await switchTab(page, 'pageStaff');
  await expect(page.locator('#payBankWages')).toContainText('Ramu Kumar');
  await expect(page.locator('#payBankWages')).toContainText('₹12,000.00');
  await page.locator('#payBankWages [data-action="invFinGo"]').click();
  await onFinanceTab(page, 'payments');
  await page.locator('#bankWages [data-action="invGoPay"]').click();
  await expect(page.locator('#pageStaff')).toHaveClass(/inv-page-active/);
  await expect(page.locator('#payBankWages')).toBeVisible();
  // Payments' other sections link home too.
  await switchTab(page, 'pageFinance');
  await page.locator('[data-action="invFinTab"][data-tab="payments"]').click();
  await page.locator('#bankSuppliers [data-action="invGoStock"]').click();
  await expect(page.locator('#pageStock')).toHaveClass(/inv-page-active/);
});

test('Stock: a supplier on a line says what the bank paid them', async ({ page }) => {
  await loadAppWithState(page, state());
  await ev(page, `todoGo({ kind: 'stock', id: 'SI1' })`);
  await expect(page.locator('#pageStock')).toContainText('the bank paid them ₹15,000.00 in 1 payment');
});
