import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAsk, closeFilter, emptyState, loadAppWithState, noSeedIM, readStoredState, recentTs, switchTab, todayIso, waitForBoot, type SepState } from './fixtures';
import { longBook } from './load-fixture';

// P186: Money's map (docs/TAB_MAP.md TM3a, TM3c). Bills & notes split: the bills went to Payments, beside what the bank paid for
// them, drawn with or without a statement; the credit notes to Office → Invoices → Credit notes, whose head carries Record issued
// and New note and whose saves follow into the Register's badge and marks. Each of Money's screens is in one look: Receivables,
// Payments and Bank lead with their verdict card and one toolbar row, then what needs the owner; the Overview leads with its
// heroes; GST is a row a month on the phone. Names and figures are made up; dates are built from today.

const isoOf = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const day = (n: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + n); return isoOf(d); };
const ym = (k: number) => { const d = new Date(todayIso().slice(0, 7) + '-01T00:00:00'); d.setMonth(d.getMonth() + k); return isoOf(d).slice(0, 7); };
const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);
// Where the app is: a jump made by a call, not a tap, takes no step of its own, so the address bar is not read for it.
const where = (p: Page) => p.evaluate(() => { const l = (window as any).navLoc(); return [l.tab, l.v || '']; });
const finTab = (page: Page, t: string) => page.locator(`.inv-viewtab[data-action="invFinTab"][data-tab="${t}"]`).click();
const ids = (page: Page, sel: string) => page.locator('#pageFinance').evaluate((p, s) => Array.from(p.querySelectorAll(s)).map(e => e.id || (e as HTMLElement).dataset.fold || e.className), sel);

let seq = 0;
function row(date: string, narration: string, dr: number, cr: number, set?: any, balance = 100000) {
  const r: any = { id: 'BK-M' + (++seq), date, valueDate: date, narration, chq: '', dr, cr, balance, dayIdx: seq, importId: 'BI-M' };
  if (set) r.set = set;
  return r;
}
function bank(rows: any[]) {
  rows.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.dayIdx - b.dayIdx);
  // Every balance follows from the row before it, so the balance check passes.
  let bal = 100000;
  rows.forEach(r => { bal = Math.round((bal - r.dr + r.cr) * 100) / 100; r.balance = bal; });
  return { rows, imports: [{ id: 'BI-M', at: 1, file: 't.xls', account: '', from: rows[0].date, to: rows[rows.length - 1].date, rows: rows.length, added: rows.length, closing: 0 }],
    parties: {}, opening: {}, gstNotes: {}, bounces: {}, cheques: [] };
}
function inv(n: number, date: string, total: number, clientId = 1) {
  const taxable = Math.round(total / 1.18 * 100) / 100, tax = Math.round((total - taxable) / 2 * 100) / 100;
  return { id: 'INV-' + n, invoiceNumber: String(n).padStart(5, '0'), displayNumber: 'T/' + String(n).padStart(5, '0'), date, status: 'active', invoiceState: 'dispatched',
    clientId, clientName: 'ALPHA FORGINGS', gstType: 'intra', clientAddress: { add1: 'PLOT 1', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' },
    items: [{ partNumber: 'P', desc: 'P', hsn: '998873', unit: 'KG', qty: 1, rate: taxable, amount: taxable }],
    taxableValue: taxable, cgstPer: 9, cgstAmt: tax, sgstPer: 9, sgstAmt: tax, igstPer: 0, igstAmt: 0, grandTotal: total, createdAt: recentTs() };
}
function state(extra: any = {}): SepState {
  const s = emptyState() as any;
  s.incomingMaterial = noSeedIM();
  s.clients = [{ id: 1, name: 'ALPHA FORGINGS', billingMode: 'weight', gstType: 'intra', gstin: '20ABCDE1234F1Z5', address: '', isActive: true, rates: [], itemRates: [],
    add1: 'PLOT 1, ADITYAPUR', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' }];
  return Object.assign(s, extra);
}
/* A book whose Payments has something of each kind: a payee nobody recognised, a month with no electricity bill that the bank paid
   for, a bill entered and a bill voided; and receipts set against invoices, so a client's line says how fast it pays. */
function paymentsBook(withStatement = true) {
  seq = 0;
  const invoices = [inv(1, ym(-2) + '-05', 23600), inv(2, ym(-1) + '-05', 11800), inv(3, day(-3), 5900)];
  const costBills = [
    { id: 'CB-1', kind: 'power', month: ym(-2), amount: 41234.5, note: 'JBVNL, read on the 2nd', at: 1 },
    { id: 'CB-2', kind: 'power', month: ym(-3), amount: 99999, at: 2, voided: 3, voidReason: 'entered twice' }
  ];
  if (!withStatement) return state({ invoices, costBills });
  const rows = [row(ym(-3) + '-02', 'SMS CHARGES', 1, 0),
    row(ym(-2) + '-25', 'NEFT-ALPHA FORGINGS', 0, 23600, { cat: 'receipt', clientId: 1 }),
    row(ym(0) + '-01', 'BIJLI JBVNL BILL', 30000, 0),
    row(ym(-1) + '-12', 'NEFT-HARDWARE MART', 5000, 0),
    row(day(-1), 'SMS CHARGES', 1, 0)];
  return state({ invoices, costBills, bank: bank(rows) });
}

test.describe('P186: Money’s map', () => {
  test('Money’s row is five; a remembered Bills & notes tab and its old address open Payments', async ({ page }) => {
    await page.addInitScript(() => { if (!sessionStorage.getItem('p186')) { sessionStorage.setItem('p186', '1'); localStorage.setItem('sep_inv_fin_tab', 'bills'); } });
    await loadAppWithState(page, paymentsBook());
    await switchTab(page, 'pageFinance');
    expect(await page.locator('#pageFinance .inv-viewtab').allInnerTexts()).toEqual(['Overview', 'Receivables', 'Payments', 'Bank', 'GST']);
    await expect(page.locator('.inv-viewtab[data-tab="payments"]')).toHaveAttribute('aria-selected', 'true');
    await page.goto('/?tab=pageFinance&v=bills');
    await waitForBoot(page);
    await expect.poll(() => where(page)).toEqual(['pageFinance', 'payments']);
    await expect.poll(() => new URL(page.url()).searchParams.get('v')).toBe('payments');
    await expect(page.locator('#bankPayVerdict')).toBeVisible();
    // Search names the bills where they are now; no screen says Bills & notes.
    const hits = await g(page, `(function() { var r = srchQuery('bills'), d = srchData(); return r.groups.reduce(function(a, x) { return a.concat(x.items.map(function(i) { return d.list[i].title + ' @ ' + d.list[i].sub; })); }, []); })()`) as string[];
    expect(hits).toContain('Bills @ Money › Payments');
    expect(await page.locator('body').innerText()).not.toContain('Bills & notes');
  });

  test('Payments opens on what needs the owner, then the bills, then what was paid: with a statement and without one', async ({ page }) => {
    await loadAppWithState(page, paymentsBook());
    await switchTab(page, 'pageFinance');
    await finTab(page, 'payments');
    // The verdict card, the toolbar's one primary, then the payees not yet sorted, the bills, the sections.
    expect(await ids(page, '#bankPayVerdict, [data-bank-toolbar="payments"], #bankUnsorted, #billsPower, #bankPower, #bankSuppliers, #bankOther'))
      .toEqual(['bankPayVerdict', 'inv-toolbar', 'bankUnsorted', 'billsPower', 'bankPower', 'bankSuppliers', 'bankOther']);
    await expect(page.locator('#bankPayVerdict .inv-hero-title')).toHaveText('1 payee not sorted · 1 month with no electricity bill');
    await expect(page.locator('#pageFinance .inv-btn-primary')).toHaveCount(1);
    await expect(page.locator('[data-bank-toolbar="payments"] .inv-btn-primary')).toHaveText('Add a bill');
    // The month the bank paid for is offered as a line of its own under it; one action a row's end.
    const miss = page.locator(`[data-missing="${ym(-1)}"]`);
    await expect(miss).toContainText('No electricity bill for');
    await expect(miss.locator('.inv-btn')).toHaveCount(1);
    await expect(page.locator(`[data-missing-paid="${ym(-1)}"]`)).toContainText('₹30,000.00 paid');
    // The bills entered fold to one row led by the latest that stands; inside, each with its note and its Void, the void muted.
    const fold = page.locator('details[data-fold="bills-entered"]');
    await expect(fold).not.toHaveAttribute('open', '');
    await expect(fold.locator('summary')).toContainText('1 bill entered, the latest');
    await expect(fold.locator('summary')).toContainText('₹41,234.50');
    await fold.locator('summary').click();
    await expect(fold.locator('[data-bill="CB-1"]')).toContainText('JBVNL, read on the 2nd');
    await expect(fold.locator('[data-bill="CB-2"]')).toHaveClass(/inv-row-muted/);
    // Electricity paid no longer points at a tab that is gone.
    await expect(page.locator('#bankPower [data-action="invGoBills"]')).toHaveCount(0);

    // Add on the missing month opens the form on it, the toolbar goes and the form's Save is the one primary.
    await miss.locator('[data-action="invCostBillOpen"]').click();
    await expect(page.locator('[data-bill-form] #costBillMonth')).toHaveValue(ym(-1));
    await expect(page.locator('[data-bank-toolbar="payments"]')).toHaveCount(0);
    await expect(page.locator('#pageFinance .inv-btn-primary')).toHaveText('Save bill');
    await page.locator('[data-bill-form] #costBillAmount').fill('28500');
    await page.locator('[data-bill-form] [data-action="invCostBillSave"]').click();
    expect(((await readStoredState(page)) as any).costBills.some((b: any) => b.month === ym(-1) && b.amount === 28500)).toBe(true);

    // With no statement: the verdict, the toolbar, the bills, then where the statement comes in.
    await loadAppWithState(page, paymentsBook(false));
    await switchTab(page, 'pageFinance');
    await finTab(page, 'payments');
    expect(await ids(page, '#bankPayVerdict, [data-bank-toolbar="payments"], #billsPower, [data-bank-none]'))
      .toEqual(['bankPayVerdict', 'inv-toolbar', 'billsPower', 'inv-panel']);
    await expect(page.locator(`[data-missing="${ym(-1)}"]`)).toBeVisible();
  });

  test('every door to a bill opens Payments’ form: the To-do’s task on its month, Add’s Bill, Power’s and Live cost’s Add a bill', async ({ page }) => {
    await loadAppWithState(page, paymentsBook());
    await g(page, `todoGo({ kind: 'bills', month: '${ym(-1)}' })`);
    await expect.poll(() => where(page)).toEqual(['pageFinance', 'payments']);
    await expect(page.locator('[data-bill-form] #costBillMonth')).toHaveValue(ym(-1));
    await page.locator('[data-bill-form] [data-action="invCostBillCancel"]').click();
    // A task of the owner's own saved naming the old tab reads as what it does now.
    expect(await g(page, `todoGoLabel({ goLabel: 'Bills & notes' })`)).toBe('Add the bill');
    // Live cost: the bills are entered on Payments; its link opens the form there.
    await switchTab(page, 'pageStats');
    await page.locator('#statsToolbar [data-action="invStatsTab"][data-tab="cost"]').click();
    const link = page.locator('[data-cost-bills]');
    await expect(link).toContainText('Bills are entered in Money → Payments');
    await expect(page.locator('#pageStats [data-bill]')).toHaveCount(0);
    await expect(page.locator('[data-where="stats"]')).toHaveCount(0);
    await link.locator('[data-action="invCostBillGo"]').click();
    await expect.poll(() => where(page)).toEqual(['pageFinance', 'payments']);
    await expect(page.locator('[data-bill-form] #costBillMonth')).toHaveValue(ym(-1));
  });

  test('credit notes are made in Office → Invoices → Credit notes, empty and not; the Register’s badge and marks follow', async ({ page }) => {
    await loadAppWithState(page, state({ invoices: [inv(1, todayIso(), 23600), inv(2, todayIso(), 11800)] }));
    await switchTab(page, 'pageRegister');
    const badge = page.locator('#pageRegister [data-action="invCnList"] .inv-badge');
    await expect(badge).toHaveCount(0);
    await page.locator('#pageRegister [data-action="invCnList"]').click();
    const dlg = page.locator('[data-cn-dialog]');
    await expect(dlg.locator('.inv-dialog-head [data-action="invCnFormOpen"]')).toHaveText(['Record issued', 'New note']);
    await expect(dlg.locator('.inv-dialog-head .inv-btn-primary')).toHaveCount(0);
    await expect(dlg).toContainText('No credit notes yet');

    // A note already on paper, recorded with its own number: the form stays for the next, the list and the badge show it.
    await dlg.locator('[data-action="invCnFormOpen"][data-mode="record"]').click();
    await expect(dlg.locator('[data-cn-form]')).toBeVisible();
    await expect(dlg.locator('.inv-dialog-head [data-action="invCnFormOpen"]')).toHaveCount(0);
    await dlg.locator('#cnfNum').fill('4');
    await dlg.locator('#cnfClient').selectOption('1');
    await dlg.locator('#cnfInv').selectOption('INV-1');
    await dlg.locator('#cnfReason').selectOption('rate');
    await dlg.locator('#cnfTaxable').fill('1000');
    await dlg.locator('[data-action="invCnFormSave"]').click();
    await expect(dlg.locator('[data-cn-row]')).toHaveCount(1);
    await expect(dlg.locator('[data-cn-form]')).toBeVisible();
    await expect(badge).toHaveText('1');
    // Its line says two things, the date and the invoice it names; the reason a line of its own.
    const r1 = dlg.locator('[data-cn-row]').first();
    await expect(r1.locator('.inv-row-meta').first()).toHaveText(/^.+ · against T\/00001$/);
    await expect(r1.locator('[data-cn-reason]')).toContainText('Rate correction');

    // A new note against the other invoice opens its preview; the Register's row is marked.
    await dlg.locator('[data-action="invCnFormCancel"]').click();
    await dlg.locator('[data-action="invCnFormOpen"][data-mode="new"]').click();
    await dlg.locator('#cnfClient').selectOption('1');
    await dlg.locator('#cnfInv').selectOption('INV-2');
    await dlg.locator('#cnfTaxable').fill('500');
    await dlg.locator('[data-action="invCnFormSave"]').click();
    await expect(page.locator('#invPrintView')).toHaveClass(/inv-print-view-active/);
    await page.locator('[data-action="invClosePrint"]').first().click();
    await expect(badge).toHaveText('2');
    await expect(page.locator('#pageRegister [data-cn-mark]')).toHaveCount(2);

    // Cancelled from the list: the badge and the mark follow.
    const newOne = ((await readStoredState(page)) as any).creditNotes.find((c: any) => c.againstInvoiceId === 'INV-2').id;
    if (!(await dlg.count())) await page.locator('#pageRegister [data-action="invCnList"]').click();
    await dlg.locator(`[data-cn-row="${newOne}"] [data-action="invCnCancel"]`).click();
    await answerAsk(page, 'ok');
    await expect(badge).toHaveText('1');
    await expect(page.locator('#pageRegister [data-cn-mark]')).toHaveCount(1);
    // Closed by its ×, the form goes with it: the list opens again on its doors.
    await dlg.locator('[data-action="invCnFormOpen"][data-mode="new"]').click();
    await dlg.locator('.inv-dialog-close').click();
    await expect(dlg).toHaveCount(0);
    await page.locator('#pageRegister [data-action="invCnList"]').click();
    await expect(dlg.locator('[data-cn-form]')).toHaveCount(0);
    await expect(dlg.locator('.inv-dialog-head [data-action="invCnFormOpen"]')).toHaveCount(2);
  });

  test('Receivables: a client’s line is two facts, what makes up owed is in its fold, one line on the face', async ({ page }) => {
    await loadAppWithState(page, paymentsBook());
    await switchTab(page, 'pageFinance');
    await finTab(page, 'receipts');
    expect(await ids(page, '#bankRecvVerdict, [data-bank-toolbar="receipts"], #bankReceipts')).toEqual(['bankRecvVerdict', 'inv-toolbar', 'bankReceipts']);
    await expect(page.locator('#bankRecvVerdict [data-recv-loose="0"]')).toHaveCount(1);
    await expect(page.locator('[data-recv-from]')).toHaveText(/^Since .+\. A receipt pays the invoices it adds up to exactly, else the oldest first\.$/);
    const meta = await page.locator('[data-recv="1"] .inv-row-meta').first().innerText();
    expect(meta).toMatch(/^pays in \d+ d( \(\d+ receipts?\))? · oldest \d+ d$/);
    await page.locator('[data-action="invBankClient"][data-id="1"]').click();
    await expect(page.locator('[data-recv-fact="invoiced"]')).toContainText('₹41,300.00');
    await expect(page.locator('[data-recv-fact="received"]')).toContainText('₹23,600.00');
  });

  test('Bank: the verdict, one toolbar row with search, Filter and More; the statement first, the balance check and the imports folded', async ({ page }) => {
    await loadAppWithState(page, paymentsBook());
    await switchTab(page, 'pageFinance');
    await finTab(page, 'bank');
    const tb = page.locator('[data-bank-toolbar="bank"]');
    await expect(tb.locator('#bankSearch')).toBeVisible();
    await expect(tb.locator('[data-action="invTbFilter"]')).toBeVisible();
    await expect(tb.locator('[data-action="invTbMore"]')).toBeVisible();
    expect(await ids(page, '#bankVerdict, [data-bank-toolbar="bank"], #bankStatement, details[data-fold="bank-check"], details[data-fold="bank-imports"]'))
      .toEqual(['bankVerdict', 'inv-toolbar', 'bankStatement', 'bankCheck', 'bankImports']);
    await expect(page.locator('#bankVerdict')).toHaveAttribute('data-bank-breaks', '0');
    await expect(page.locator('details[data-fold="bank-check"]')).not.toHaveAttribute('open', '');
    // Filter on the phone: the category in its dialog, said under the row as a token that clears it.
    await tb.locator('[data-action="invTbFilter"]').click();
    await page.locator('[data-tb-filter-dialog="bank"] #bankCatFilter').selectOption('charges');
    await closeFilter(page);
    await expect(page.locator('.inv-tokens .inv-token')).toContainText('Bank charges');
    await expect(page.locator('#bankStatement [data-bank-row]')).toHaveCount(2);
    await page.locator('.inv-tokens .inv-token').click();
    await expect(page.locator('#bankStatement [data-bank-row]')).toHaveCount(5);
    // Import and the exports are behind More.
    await tb.locator('[data-action="invTbMore"]').click();
    expect(await page.locator('[data-tb-more-dialog] [data-tb-pick]').allInnerTexts()).toEqual(['Import a statement', 'Export Excel', 'Export JSON for soma-internal']);
  });

  test('GST is a row a month on the phone, nothing cut; the Overview leads with its four heroes inside the first screen', async ({ page }) => {
    await loadAppWithState(page, longBook());
    await switchTab(page, 'pageFinance');
    await finTab(page, 'gst');
    await expect(page.locator('#finGstVerdict')).toBeVisible();
    const cut = await page.locator('#finGst').evaluate(el => {
      const box = el.getBoundingClientRect();
      return Array.from(el.querySelectorAll('[data-gst] *')).filter(c => { const r = (c as HTMLElement).getBoundingClientRect(); return r.width > 0 && r.right > box.right + 1; }).length;
    });
    expect(cut).toBe(0);
    await expect(page.locator('#finGst [data-gst] .inv-row-end-stack').first()).toBeVisible();

    await finTab(page, 'overview');
    const heroes = page.locator('[data-fin-heroes] > .inv-hero');
    await expect(heroes).toHaveCount(4);
    await expect(heroes.first()).toHaveAttribute('data-verdict', '');
    const top = await heroes.first().evaluate(h => h.getBoundingClientRect().top);
    expect(top).toBeLessThan(await page.evaluate(() => window.innerHeight));
    // The charts follow, each a fold shut on the phone.
    const shut = await page.locator('#pageFinance details.inv-panel-fold').evaluateAll(els => els.map(e => (e as HTMLDetailsElement).open));
    expect(shut.length).toBeGreaterThan(3);
    expect(shut.every(o => !o)).toBe(true);
  });
});
