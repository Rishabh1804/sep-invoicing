import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, openSettingsAt, readStoredState, recentTs, switchTab, todayIso, type SepState } from './fixtures';

// P61: the live cost closes in on what was paid (docs/FINANCE_INTELLIGENCE_SPEC.md, Phase 4). The bank is a
// second instrument beside the app's own record: attributed to the month it pays for, used before the model
// where the record is thin, and set beside the record where both exist. Names and figures are made up; the
// statement has fixed dates and every assertion reads a range those dates fix, except Derive, which is
// judged on the six closed months before today and so is built relative to today.

const W = { id: 7, name: 'Ramu Kumar', comp: 'monthly', dayRate: 500, hourRate: 0, area: 'vat-a1', onFloor: true, active: true };

let seq = 0;
function row(date: string, narration: string, dr: number, cr: number, set?: any) {
  const r: any = { id: 'BK-T' + (++seq), date, valueDate: date, narration, chq: '', dr, cr, balance: 100000, dayIdx: 0, importId: 'BI-T' };
  if (set) r.set = set;
  return r;
}
function bankState(rows: any[]) {
  return { rows, imports: [{ id: 'BI-T', at: 1, file: 'test.xls', account: '', from: rows[0].date, to: rows[rows.length - 1].date, rows: rows.length, added: rows.length, closing: 100000 }],
    parties: {}, opening: {}, gstNotes: {} };
}

// Statement 1 Jul – 30 Sep 2026.
function statement() {
  seq = 0;
  return bankState([
    row('2026-07-01', 'NEFT-ALPHA FORGINGS', 0, 100000),
    row('2026-07-10', 'NEFT-GAMMA TRADERS', 40000, 0),                           // nothing recognises the payee: unsorted
    row('2026-08-01', 'SELF', 7000, 0),                                          // week Sun 26 Jul – Sat 1 Aug: 6 days July, 1 August
    row('2026-08-05', 'NEFT-HARDWARE MART', 3000, 0, { cat: 'other' }),
    row('2026-08-06', 'NEFT-PARTNER A', 20000, 0, { cat: 'other', notCost: true }), // drawings: not a cost
    row('2026-08-08', 'SELF', 7000, 0),                                          // week Sun 2 – Sat 8 Aug: August
    row('2026-08-10', 'BIJLI BIL JBVNL', 50000, 0),                              // settles July
    row('2026-08-14', 'NEFT-RAMU KUMAR', 12000, 0, { cat: 'wages', staffId: 7 }), // July's salary
    row('2026-08-20', 'EBANK:ABC123 GST', 9000, 0),                              // GST: never a cost
    row('2026-09-14', 'NEFT-RAMU KUMAR', 13000, 0, { cat: 'wages', staffId: 7 }), // August's salary
    row('2026-09-30', 'NEFT-ALPHA FORGINGS', 0, 1),
  ]);
}

function state(extra: any = {}): SepState {
  const s = emptyState() as any;
  s.incomingMaterial = noSeedIM();
  s.staff = [W];
  s.bank = statement();
  return Object.assign(s, extra);
}
const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);

test('a salary leg pays the month before, cash its pay week, electricity its bill month; GST and drawings are not cost', async ({ page }) => {
  await loadAppWithState(page, state());
  const m = await ev(page, `(function() { var b = bankCostByMonth().months, r = function(x) { return Math.round(x * 100) / 100; };
    return { julNamed: r(b['2026-07'].labour.named), julCash: r(b['2026-07'].labour.cash), augNamed: r(b['2026-08'].labour.named), augCash: r(b['2026-08'].labour.cash),
      julPower: b['2026-07'].power.amount, augPower: b['2026-08'].power.amount, augOther: b['2026-08'].other.amount }; })()`);
  expect(m).toEqual({ julNamed: 12000, julCash: 6000, augNamed: 13000, augCash: 8000, julPower: 50000, augPower: 0, augOther: 3000 });
  // Labour is known only where the salary run after the month is on the statement: August yes (to 30 Sep), September no.
  const k = await ev(page, `(function() { var b = bankCostByMonth(); return ['2026-07', '2026-08', '2026-09'].map(function(m) { return bankMonthKnown(b, m, 'labour'); }); })()`);
  expect(k).toEqual([true, true, false]);
  // An unsorted payment is neither supplier nor cost, and its month cannot speak for other costs.
  const u = await ev(page, `(function() { var b = bankCostByMonth(); return { jul: b.months['2026-07'].unsorted.amount, julOther: bankMonthKnown(b, '2026-07', 'other'), augOther: bankMonthKnown(b, '2026-08', 'other') }; })()`);
  expect(u).toEqual({ jul: 40000, julOther: false, augOther: true });
});

test('precedence: recorded at 90% or more, else the bank, else the model, and the tag says which', async ({ page }) => {
  // Every working day of August recorded for the one hand.
  const att: any = {};
  for (let d = 1; d <= 31; d++) {
    const iso = '2026-08-' + String(d).padStart(2, '0');
    if (new Date(iso + 'T00:00:00').getDay() !== 0) att[iso] = { marks: { 7: { st: 'P', ot: 0, hours: 8, area: 'vat-a1' } }, extra: [], note: '' };
  }
  await loadAppWithState(page, state());
  const src = (from: string, to: string) => ev(page, `(function() { var c = liveCost('${from}', '${to}', 10000);
    var o = {}; c.rows.forEach(function(r) { o[r.key] = { source: r.source, amount: r.amount }; }); return o; })()`);

  // August, no attendance: labour is what the bank paid for it; other is the month's payment; power has none for August.
  let aug = await src('2026-08-01', '2026-08-31') as any;
  expect(aug.labour).toEqual({ source: 'bank', amount: 21000 });
  expect(aug.other).toEqual({ source: 'bank', amount: 3000 });
  expect(aug.power.source).toBe('model');
  // July's electricity comes from the bank until a bill is entered, and then from the bill.
  let jul = await src('2026-07-01', '2026-07-31') as any;
  expect(jul.power).toEqual({ source: 'bank', amount: 50000 });
  expect(jul.other.source).toBe('model');
  const julOther = await ev(page, `liveCost('2026-07-01', '2026-07-31', 10000).rows.find(function(r) { return r.key === 'other'; }).detail.map(function(d) { return d.label + ' ' + d.amount; })`);
  expect(julOther).toContain('Paid to payees not yet sorted, not counted 40000');
  // May is before the statement: the model.
  expect(((await src('2026-05-01', '2026-05-31')) as any).labour.source).toBe('model');

  await loadAppWithState(page, state({ attendance: att, costBills: [{ id: 'CB1', kind: 'power', month: '2026-07', amount: 45000, units: null, note: '', at: 1 }] }));
  aug = await src('2026-08-01', '2026-08-31');
  expect(aug.labour.source).toBe('measured');
  jul = await src('2026-07-01', '2026-07-31');
  expect(jul.power).toEqual({ source: 'measured', amount: 45000 });

  // Recorded against paid, over the months where both exist.
  const chk = await ev(page, `liveCostPaidCheck('2026-07-01', '2026-08-31')`) as any[];
  const power = chk.find(r => r.key === 'power');
  expect(power).toMatchObject({ recorded: 45000, paid: 50000, delta: 5000, flag: true, months: ['2026-07'] });
  const lab = chk.find(r => r.key === 'labour');
  expect(lab.months).toEqual(['2026-08']);           // July has no attendance, so it is not compared
  expect(lab.skipped).toEqual(['2026-07']);
  expect(lab.paid).toBe(21000);
  expect(lab.note).toContain('not Jul 2026: attendance under 90% of days');
  const html = await ev(page, `_costPaidHtml('2026-07-01', '2026-08-31')`) as string;
  expect(html).toContain('over 10% apart');
  expect(html).toContain('recorded ₹45,000.00 · paid ₹50,000.00 · over Jul 2026');
  expect(html).toContain('+₹5,000.00 (+11%)');
});

test('a payment marked not a cost on the statement leaves the live cost', async ({ page }) => {
  await loadAppWithState(page, state());
  await switchTab(page, 'pageFinance');
  await page.locator('[data-action="invFinTab"][data-tab="bank"]').click();
  const hw = page.locator('[data-bank-row] [data-action="invBankEdit"]', { hasText: 'HARDWARE MART' });
  await hw.click();
  await page.locator('#bankEditNotCost').check();
  await page.locator('[data-action="invBankEditSave"]').click();
  await expect(page.locator('[data-bank-row]', { hasText: 'HARDWARE MART' })).toContainText('not a cost');
  const other = await ev(page, `bankCostByMonth().months['2026-08'].other.amount`);
  expect(other).toBe(0);
  const rows = (await readStoredState(page)).bank.rows;
  expect(rows.find((r: any) => r.narration === 'NEFT-HARDWARE MART').set).toMatchObject({ cat: 'other', notCost: true });

  // Payments lists the unsorted payee; Sort opens its row on the statement, and setting it clears the list.
  await page.locator('[data-action="invFinTab"][data-tab="payments"]').click();
  await expect(page.locator('#bankUnsorted [data-unsorted]')).toHaveCount(1);
  await page.locator('#bankUnsorted [data-action="invBankSort"]').click();
  await expect(page.locator('[data-bank-edit]')).toBeVisible();
  await page.locator('#bankEditCat').selectOption('supplier');
  await page.locator('[data-action="invBankEditSave"]').click();
  expect(await ev(page, `bankCostByMonth().months['2026-07'].supplies.amount`)).toBe(40000);
  await page.locator('[data-action="invFinTab"][data-tab="payments"]').click();
  await expect(page.locator('#bankUnsorted')).toHaveCount(0);
});

test('Derive from the bank offers paid ÷ tonnage over six closed months, and changes nothing until saved', async ({ page }) => {
  const today = todayIso(), ym = (k: number) => { const d = new Date(today.slice(0, 7) + '-01T00:00:00'); d.setMonth(d.getMonth() + k); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  seq = 0;
  const rows: any[] = [row(ym(-7) + '-01', 'NEFT-ALPHA FORGINGS', 0, 50000)];
  const invoices: any[] = [];
  for (let k = -6; k <= -1; k++) {
    rows.push(row(ym(k) + '-10', 'NEFT-HARDWARE MART', 1000, 0, { cat: 'other' }));
    rows.push(row(ym(k + 1) + '-01', 'BIJLI BIL JBVNL', 2000, 0));    // settles the month before
    invoices.push({ id: 'INV-' + k, invoiceNumber: String(10 + k), displayNumber: 'T/' + (10 + k), date: ym(k) + '-15', status: 'active', invoiceState: 'dispatched',
      clientId: 1, clientName: 'ALPHA FORGINGS', gstType: 'intra', items: [{ partNumber: 'P', desc: 'P', hsn: '998873', unit: 'KG', qty: 500, rate: 10, amount: 5000 }],
      taxableValue: 5000, cgstAmt: 450, sgstAmt: 450, igstAmt: 0, grandTotal: 5900, createdAt: recentTs() });
  }
  rows.push(row(today, 'NEFT-ALPHA FORGINGS', 0, 1));
  await loadAppWithState(page, state({ bank: bankState(rows), invoices,
    clients: [{ id: 1, name: 'ALPHA FORGINGS', billingMode: 'weight', gstType: 'intra', gstin: '', address: '', isActive: true, rates: [], itemRates: [] }] }));
  const before = await ev(page, 'costModelCfg().power');
  await openSettingsAt(page, 'fallbacks');
  await page.locator('[data-action="invCostDeriveBank"][data-which="fallbacks"]').click();
  const out = page.locator('#costDeriveOut');
  // 6 × ₹1,000 ÷ 3.0 t = ₹2.00/kg; 6 × ₹2,000 ÷ 3.0 t = ₹4.00/kg.
  await expect(out.locator('[data-derive="other"]')).toContainText('₹1,000.00 ÷ 0.5 t = ₹2.00/kg');
  await expect(out).toContainText('6 months: ₹6,000.00 ÷ 3.0 t = ₹2.00/kg');
  await expect(out).toContainText('6 months: ₹12,000.00 ÷ 3.0 t = ₹4.00/kg');
  await page.locator('[data-action="invCostUseDerived"][data-field="setCostPower"]').click();
  await expect(page.locator('#setCostPower')).toHaveValue('4');
  await expect(page.locator('details[data-sec="fallbacks"]')).toHaveClass(/inv-set-dirty/);
  expect(await ev(page, 'costModelCfg().power')).toBe(before);
});
