import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, openFoldAt, readStoredState, switchTab, todayIso, toolbarMore, type SepState } from './fixtures';

// P208: suppliers, what is owed to each and how long each takes (owner, 10 Oct 2026: "Balance payment remaining from us to <a
// supplier>, no way to record this in the app"; lead times of none for three suppliers and "3-4 working days … they offer a cheaper
// price but the material comes from Kolkata"). A supplier is every spelling that names it ("&" is AND); a payee whose initials are a
// supplier's short name is offered; the balance counts from a figure off their statement; a cheque recorded here clears once; the
// reorder list weighs a cheaper supplier's lead time against the days left. Made-up suppliers; every date from today.

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const day = (n: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); };
const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
let seq = 0;
const row = (date: string, narration: string, dr: number, chq = '') =>
  ({ id: 'BK-' + (++seq), date, valueDate: date, narration, chq, dr, cr: 0, balance: 500000, dayIdx: seq, importId: 'BI-1' });
const bill = (id: string, itemId: string, date: string, qty: number, price: number, supplier: string, billNo: string) =>
  ({ id, itemId, kind: 'bill', qty, price, amount: Math.round(qty * price * 100) / 100, date, billDate: date, supplier, billNo, at: 1 });

function book(): SepState {
  seq = 0;
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
  s.stock = {
    items: [{ id: 'B', name: 'Brightener K', key: 'BRIGHTENER K', unit: 'L', basis: 'draw', aliases: [] },
      { id: 'Q', name: 'Salt Q', key: 'SALT Q', unit: 'kg', basis: 'draw', aliases: [] },
      { id: 'A', name: 'Acid L', key: 'ACID L', unit: 'L', basis: 'draw', aliases: [] }],
    entries: [
      // Brightener: 5 L a day, 70 on the shelf (14 days). Last from Kappa at 205; Mu sold it at 186.
      { id: 'c1', itemId: 'B', kind: 'count', qty: 120, date: day(-10), at: 1, seq: 3 },
      { id: 'u1', itemId: 'B', kind: 'used', qty: 50, days: 10, from: day(-10), date: day(-1), at: 2, seq: 2 },
      bill('k101', 'B', day(-20), 30, 200, 'Kappa & Brothers', 'K/101'),
      bill('m55', 'B', day(-15), 30, 186, 'Mu Traders', 'M/55'),
      bill('k120', 'B', day(-5), 30, 205, 'Kappa & Brothers', 'K/120'),
      // Salt: 1 kg a day, 2 on the shelf (2 days). Last from Mu at 300; Kappa sold it at 350.
      { id: 'c2', itemId: 'Q', kind: 'count', qty: 12, date: day(-10), at: 1, seq: 3 },
      { id: 'u2', itemId: 'Q', kind: 'used', qty: 10, days: 10, from: day(-10), date: day(-1), at: 2, seq: 2 },
      bill('k090', 'Q', day(-30), 20, 350, 'Kappa & Brothers', 'K/090'),
      bill('m60', 'Q', day(-10), 50, 300, 'Mu Traders', 'M/60'),
      // The same bill number on another day (one may be typed wrong), and a supplier known by its initials.
      bill('k101b', 'A', day(-18), 5, 100, 'Kappa & Brothers', 'K/101'),
      bill('l9', 'A', day(-30), 10, 100, 'LMI', 'L/9')],
    pastes: [] };
  const rows = [
    row(day(-40), 'NEFT-UTR1-KAPPA AND BROTHERS-STATE BANK OF I', 10000),
    row(day(-33), 'KAPPA AND BROTHERS-MICR INWARD CLG (CTS)', 2000, '000700'),
    row(day(-12), 'NEFT-UTR2-LAMBDA METAL INDUSTRIES-STATE BANK OF I', 5000),
    row(day(-3), 'KAPPA AND BROTHERS-MICR INWARD CLG (CTS)', 7080, '000777'),
    row(day(-1), 'SMS CHARGES', 10)];
  s.bank = { rows, imports: [{ id: 'BI-1', at: 1, file: 't.xls', account: '', from: rows[0].date, to: rows[rows.length - 1].date, rows: rows.length, added: rows.length, closing: 500000 }],
    parties: {}, opening: {}, gstNotes: {}, bounces: {}, cheques: [] };
  return s;
}
async function payments(page: Page) {
  await switchTab(page, 'pageFinance');
  await page.locator('[data-action="invFinTab"][data-tab="payments"]').click();
}
async function openSupplier(page: Page, name: string) {
  await payments(page);
  await openFoldAt(page, 'pay-suppliers');
  await page.locator('#bankSuppliers [data-supplier]').filter({ hasText: name }).locator('[data-action="invSuppOpen"]').click();
  await expect(page.locator('[data-supp-dialog]')).toBeVisible();
}
const owed = (page: Page) => page.locator('[data-supp-dialog] [data-supp-owed]').getAttribute('data-supp-owed');

test.describe('P208: suppliers, what is owed and how long each takes', () => {
  test('a supplier is every spelling of it; a payee is offered by its initials; bills carry their GST, one number on two days said', async ({ page }) => {
    await loadAppWithState(page, book());
    // "&" on the bills is AND on the statement: the three payments are the bills' supplier's.
    expect(await ev(page, `(function() { var sp = suppOfName('KAPPA AND BROTHERS'); return [sp.name, sp.bank.length, sp.bills.length]; })()`)).toEqual(['Kappa & Brothers', 3, 4]);
    // A bill is its lines with 18% GST, rounded to the rupee; its number on two days is flagged on both.
    expect(await ev(page, `suppOfName('Kappa & Brothers').bills.map(function(b) { return [b.no, b.total, b.twins.length]; })`))
      .toEqual([['K/090', 8260, 0], ['K/101', 7080, 1], ['K/101', 590, 1], ['K/120', 7257, 0]]);
    await payments(page);
    await openFoldAt(page, 'pay-suppliers');
    await expect(page.locator('#bankSuppliers [data-supplier]')).toHaveCount(3);
    await expect(page.locator('#bankSuppliers [data-supplier]').filter({ hasText: 'Kappa & Brothers' })).toContainText('No balance set');
    // The payee nothing recognised, whose initials are a supplier's short name, is offered as that supplier; taken, it is theirs.
    const offer = page.locator('[data-supp-offer="LAMBDA METAL INDUSTRIES"]');
    await expect(offer).toContainText('May be LMI: its initials');
    await offer.locator('[data-action="invSuppSame"]').click();
    const lmi = (await readStoredState(page)).suppliers.find((r: any) => r.name === 'LMI');
    expect(lmi.names).toEqual(['LAMBDA METAL INDUSTRIES']);
    expect(await ev(page, `suppOfName('LMI').bank.length`)).toBe(1);
    await expect(page.locator('[data-supp-offer]')).toHaveCount(0);
  });

  test('the balance off their statement: owed since, a cheque handed over counted once, a payment in their figure, a void, a total as printed', async ({ page }) => {
    await loadAppWithState(page, book());
    await openSupplier(page, 'Kappa & Brothers');
    expect(await owed(page)).toBe('');
    await page.locator('[data-supp-dialog] [data-action="invSuppForm"][data-form="balance"]').click();
    await page.locator('#suppBalAmount').fill('10000');
    await page.locator('#suppBalDate').fill(day(-35));
    // What it comes to now: the bills after the day (8,260 + 7,080 + 590 + 7,257) less the statement's payments after it (2,000 + 7,080).
    await expect(page.locator('#suppBalPreview')).toContainText('Owed now: ₹24,107.00');
    await page.locator('[data-action="invSuppSaveBalance"]').click();
    expect(await owed(page)).toBe('24107');
    expect((await readStoredState(page)).suppliers.find((r: any) => r.name === 'Kappa & Brothers').opening).toMatchObject({ amount: 10000, date: day(-35) });

    // The cheque handed over on the 6th day back is the statement's row of its number: one payment, on the day it was handed over.
    await page.locator('[data-supp-dialog] [data-action="invSuppForm"][data-form="pay"]').click();
    await page.locator('#suppPayDate').fill(day(-6));
    await page.locator('#suppPayAmount').fill('7080');
    await page.locator('#suppPayChq').fill('000777');
    await page.locator('[data-action="invSuppSavePay"]').click();
    expect(await owed(page)).toBe('24107');
    const ledger = page.locator('[data-supp-dialog] [data-supp-ledger]');
    await expect(ledger.locator('[data-supp-line^="hand|"]')).toContainText('Cheque 000777');
    await expect(ledger.locator('[data-supp-line^="hand|"]')).toContainText('cleared');

    // A cheque they had credited before the day that cleared after it: marked as in their figure, it stops counting.
    await ledger.locator('[data-action="invSuppInOpening"]').first().click();
    expect(await owed(page)).toBe('26107');

    // Cash recorded and voided with a reason.
    await page.locator('[data-supp-dialog] [data-action="invSuppForm"][data-form="pay"]').click();
    await page.locator('#suppPayDate').fill(day(-1));
    await page.locator('#suppPayAmount').fill('1000');
    await page.locator('#suppPayHow').selectOption('cash');
    await page.locator('[data-action="invSuppSavePay"]').click();
    expect(await owed(page)).toBe('25107');
    const cash = page.locator('[data-supp-dialog] [data-supp-line^="hand|"]').filter({ hasText: 'Cash' });
    await cash.locator('[data-action="invSuppVoidPay"]').click();
    await answerAsk(page, 'ok', 'Typed twice');
    expect(await owed(page)).toBe('26107');
    expect((await readStoredState(page)).supplierPays.find((p: any) => p.how === 'cash')).toMatchObject({ voidReason: 'Typed twice' });

    // A bill's total as printed wins over its lines with GST.
    await page.locator('[data-supp-dialog] [data-action="invSuppBillTotal"][data-key="K/120|' + day(-5) + '"]').click();
    await answerAsk(page, 'ok', '7300');
    expect(await owed(page)).toBe('26150');

    // What is still unpaid is read oldest first: the balance set is not yet paid off, 35 days on; the To-do says so, only to know.
    const t = await ev(page, `TODO_RULE_FNS.supplierOwed()`) as any[];
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ tone: 'info', title: 'Pay Kappa & Brothers: ₹26,150.00 owed' });
    // Payments' card and fold say what is owed.
    await page.locator('[data-supp-dialog] [data-action="invCloseConfirm"]').last().click();
    await expect(page.locator('#bankPayVerdict [data-pay-supp-owed]')).toHaveAttribute('data-pay-supp-owed', '26150');
    await expect(page.locator('#bankSuppliers [data-supp-owed-all]')).toHaveAttribute('data-supp-owed-all', '26150');

    // A role that does not see money sees no figure owed and no ledger.
    await ev(page, `window.grdSeesMoney = function() { return false; }; suppOpen(suppOfName('Kappa & Brothers').id, '')`);
    await expect(page.locator('[data-supp-dialog] [data-supp-ledger]')).toHaveCount(0);
    await expect(page.locator('[data-supp-dialog] [data-supp-facts]')).toContainText('what is owed is shown to a role that sees money');
  });

  test('lead times: the cheaper supplier when it can deliver in time, the fast one when it cannot, said on the reorder list and the task', async ({ page }) => {
    await loadAppWithState(page, book());
    // Mu takes 3 to 4 working days, set on its form; Kappa delivers the same day.
    await openSupplier(page, 'Mu Traders');
    await page.locator('[data-supp-dialog] [data-action="invSuppForm"][data-form="set"]').click();
    await page.locator('#suppSetLeadMin').fill('3');
    await page.locator('#suppSetLeadMax').fill('4');
    await page.locator('[data-action="invSuppSaveSet"]').click();
    await expect(page.locator('[data-supp-dialog] [data-supp-lead]')).toContainText('3–4 working days');
    expect((await readStoredState(page)).suppliers.find((r: any) => r.name === 'Mu Traders')).toMatchObject({ leadMin: 3, leadMax: 4 });
    await ev(page, `(function() { var r = suppRecord(suppOfName('Kappa & Brothers')); r.leadMin = 0; r.leadMax = 0; saveState(); })()`);

    const L = await ev(page, `stockReorderList().groups.map(function(g) { return [g.supplier, g.rows.map(function(r) {
      return [r.item.id, r.qty, r.price, r.pick.orderBy, r.pick.why]; })]; })`) as any[];
    const by = Object.fromEntries(L.map((g: any) => [g[0], g[1]]));
    // Brightener: 14 days on the shelf, Mu's 4 fit: from Mu at 186, 5 L a day × (4 + 30) − 70 = 100, in packs of 30.
    expect(by['Mu Traders']).toEqual([['B', 120, 186, await ev(page, `suppAddWorkingDays(localDateStr(), 10)`), '₹19.00 a unit less than Kappa & Brothers, 3–4 working days']]);
    // Salt: 2 days left, Mu cannot make it: from Kappa the same day, 1 kg a day × 30 − 2, and what the hurry costs.
    expect(by['Kappa & Brothers'][0].slice(0, 3)).toEqual(['Q', 28, 350]);
    expect(by['Kappa & Brothers'][0][4]).toBe('Mu Traders takes 3–4 working days: it would run out first; ₹50.00 a unit more from Kappa & Brothers');
    // The line's task names who to order from.
    const task = (await ev(page, `todoAppAll(['stock']).filter(function(t) { return t.itemId === 'Q'; })[0]`)) as any;
    expect(task.facts.find((f: any) => f[0] === 'Order from')[1]).toMatch(/^Kappa & Brothers: same day, order by /);
    // On the list itself, under the supplier it is ordered from.
    await page.locator('[data-supp-dialog] [data-action="invCloseConfirm"]').last().click();
    await switchTab(page, 'pageStock');
    await toolbarMore(page, 'Reorder list');
    await expect(page.locator('#stockReorder .inv-row-group').filter({ hasText: 'Mu Traders' })).toBeVisible();
    await expect(page.locator('#stockReorder')).toContainText('Mu Traders: 3–4 working days, order by');
  });

  test('a rename keeps the old name as a spelling; the suppliers travel in the stock file, merged by id', async ({ page }) => {
    await loadAppWithState(page, book());
    await openSupplier(page, 'Kappa & Brothers');
    await page.locator('[data-supp-dialog] [data-action="invSuppForm"][data-form="set"]').click();
    await page.locator('#suppSetName').fill('Kappa Chemicals');
    await page.locator('[data-action="invSuppSaveSet"]').click();
    expect(await ev(page, `[suppOfName('Kappa & Brothers').name, suppOfName('KAPPA AND BROTHERS').bills.length]`)).toEqual(['Kappa Chemicals', 4]);
    const rec = (await readStoredState(page)).suppliers.find((r: any) => r.name === 'Kappa Chemicals');
    expect(rec.names).toContain('Kappa & Brothers');
    // The export carries them; an import adds what it does not hold, and never writes over what it does.
    const out = await ev(page, `(function() { var o = null, d = downloadJson; downloadJson = function(n, x) { o = x; }; try { stockExport(); } finally { downloadJson = d; } return [o.suppliers.length, o.supplierPays.length]; })()`);
    expect(out).toEqual([1, 0]);
    const added = await ev(page, `stockMergeImport({ format: 'sep-stock', version: 1, items: [], entries: [],
      suppliers: [{ id: '${rec.id}', name: 'Overwritten', names: [] }, { id: 'SUP-x', name: 'Nu Chemicals', names: ['NU CHEM'], leadMin: 2, leadMax: 2, opening: { amount: 500, date: '${day(-3)}' } }],
      supplierPays: [{ id: 'SPY-x', supplierId: 'SUP-x', date: '${day(-1)}', amount: 200, how: 'cash' }] })`) as any;
    expect([added.suppliers, added.supplierPays]).toEqual([1, 1]);
    expect(await ev(page, `[suppById('${rec.id}').name, suppLedger(suppById('SUP-x')).balance, suppLeadText(suppLead(suppById('SUP-x')))]`)).toEqual(['Kappa Chemicals', 300, '2 working days']);
  });
});
