import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, type SepState } from './fixtures';
import { partState } from './p77-part-invoice.fixture';

// P114: the owner's rulings on what the QA sweep left to them (30 Sep 2026).
//   - GST rounding: "change it". To the paisa on the decimal figure, half away from zero.
//   - Dues: "yes, unless stated otherwise and notification cleared". A balance carries across pay periods until it is
//     paid, worked off, or cleared with a reason, and the To-do asks until then.
//   - A second electricity bill in a month: arrears of a month paid late, with a penalty. The arrears are not counted twice.
//   - "night hold is night shift": on an in-time roll too, 8 PM to 6 AM, never read as the morning.
//   - A correction made on a new invoice reaches its challan, with a note.
//   - Home's month to date is net of credit notes, and says so.
// Names are made up; the repo is public.

const g = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** Sunday of the pay week `weeks` from this one, plus `day` days (0 = Sunday). */
function wd(weeks: number, day: number): string {
  const d = new Date(todayIso() + 'T00:00:00');
  d.setDate(d.getDate() - d.getDay() + weeks * 7 + day);
  return isoOf(d);
}
function monthsBack(n: number): string {
  const d = new Date(todayIso() + 'T00:00:00'); d.setDate(1); d.setMonth(d.getMonth() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

test('GST rounding is to the paisa on the figure as written, half away from zero', async ({ page }) => {
  await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM() } as SepState);
  // Math.round(val * 100) / 100 gave 1.00 for 1.005 (held as 1.00499…) and 2.67 for 2.675.
  expect(await g(page, '[gstRound(1.005), gstRound(2.675), gstRound(0.1 + 0.2), gstRound(-1.005), gstRound(337.4361), gstRound(0)]'))
    .toEqual([1.01, 2.68, 0.3, -1.01, 337.44, 0]);
});

test.describe('P114: a balance carries from one pay period to the next', () => {
  const STAFF = [{ id: 7, name: 'Bala', comp: 'hourly', area: 'barrel', hourRate: 50, active: true, onFloor: true }];
  const lastWeek = () => {
    const att: Record<string, any> = {};
    for (let day = 1; day <= 5; day++) att[wd(-1, day)] = { marks: { 7: { st: 'P', hours: 8, ot: 0, area: 'barrel' } }, extra: [], note: '' };
    return att;   // 40 h at ₹50 = ₹2,000
  };
  const pay = (id: string, date: string, amount: number) => ({ id, staffId: 7, date, amount, kind: 'payment', note: '', at: 1 });
  const load = (page: Page, payments: any[]) => loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM(), staff: STAFF,
    attendance: lastWeek(), staffPayments: payments, labour: { holidays: [] } } as unknown as SepState);
  const row = (page: Page) => g(page, `(function(){ var r = payDue(attWeekStartOf(localDateStr())).rows.find(function(x){ return x.w.id === 7; }); return { due: r.due, carried: r.carried }; })()`);

  test('what was left unpaid last week is owed this week, and the To-do asks until it is cleared with a reason', async ({ page }) => {
    await load(page, [pay('P1', wd(-1, 6), 1500)]);
    expect(await row(page)).toEqual({ due: 500, carried: 500 });
    const tasks = await g(page, 'TODO_RULE_FNS.payCarry()');
    expect(tasks).toHaveLength(1);
    expect(tasks[0].sub).toContain('Bala owed ₹500.00');

    await switchTab(page, 'pageStaff');
    await page.locator('[data-action="invAttView"][data-view="pay"]').click();
    await expect(page.locator('[data-carried-row="7"]')).toContainText('Owed from before');
    await page.locator('[data-carried-row="7"] [data-action="invPayClear"]').click();
    await answerAsk(page, 'ok', 'Paid in cash, not recorded');
    await expect(page.locator('[data-carried-row="7"]')).toHaveCount(0);
    await expect(page.locator('[data-pay-clear]')).toContainText('Paid in cash, not recorded');
    expect(await row(page)).toEqual({ due: 0, carried: 0 });
    expect(await g(page, 'TODO_RULE_FNS.payCarry()')).toHaveLength(0);
    const stored = await readStoredState(page);
    expect(stored.payCarryClears[0]).toMatchObject({ staffId: 7, through: wd(-1, 6), amount: 500, reason: 'Paid in cash, not recorded' });

    // Undone, the balance carries again.
    await page.locator('[data-action="invPayClearVoid"]').click();
    await answerAsk(page, 'ok');
    await expect(page.locator('[data-carried-row="7"]')).toHaveCount(1);
  });

  test('an advance not worked off carries as an advance, and nothing carries before the first payment typed here', async ({ page }) => {
    await load(page, [pay('P1', wd(-1, 6), 2500)]);
    expect(await row(page)).toEqual({ due: -500, carried: -500 });
    // No payment recorded at all: last week's wages were settled outside the app, so nothing is owed from before.
    await load(page, []);
    expect(await row(page)).toEqual({ due: 0, carried: 0 });
  });

  test("a monthly hand's salary paid next month pays the month it was for", async ({ page }) => {
    // The pay month is the one the week's Sunday is in (P107), and last month the one before it. Dates are pinned in the
    // month (P124): a salary dated on or before the 20th pays the month before, so "today" would move the answer.
    const ws = wd(0, 0), pm = ws.slice(0, 7);
    const pd = new Date(pm + '-01T00:00:00'); pd.setMonth(pd.getMonth() - 1);
    const prev = `${pd.getFullYear()}-${String(pd.getMonth() + 1).padStart(2, '0')}`;
    const att: Record<string, any> = {};
    ['-03', '-04', '-05'].forEach(d => { att[prev + d] = { marks: { 8: { st: 'P', hours: 8, ot: 0, area: 'vat-a1' } }, extra: [], note: '' }; });
    await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM(), attendance: att, labour: { holidays: [] },
      staff: [{ id: 8, name: 'Arun', comp: 'monthly', area: 'vat-a1', dayRate: 500, active: true, onFloor: true }] } as unknown as SepState);
    const earned = await g(page, `labourForRange('${prev}-01', payMonthEnd('${prev}-01')).byWorker[8].total`);
    const row = () => g(page, `(function(){ var r = payDue('${ws}').rows.find(function(x){ return x.w.id === 8; }); return { due: r.due, carried: r.carried, earned: r.earned.total, paid: r.paid }; })()`);
    // Paid on the 14th, as salaries go out: it pays last month, so nothing carries and nothing comes off this month.
    await g(page, `S.staffPayments.push({ id: 'PM1', staffId: 8, date: '${pm}-14', amount: ${earned}, kind: 'payment', note: '', at: 1 })`);
    let r = await row();
    expect(r).toMatchObject({ carried: 0, paid: 0 });
    expect(r.due).toBe(r.earned);
    // Paid after the 20th it is counted in its own month: last month's wage carries in, and this payment settles it.
    await g(page, `S.staffPayments[0].date = '${pm}-25'`);
    r = await row();
    expect(r.carried).toBe(earned);
    expect(r.due).toBe(r.earned);
  });
});

test.describe('P114: a second electricity bill in a month', () => {
  const book = () => {
    const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
    s.costBills = [{ id: 'CB-1', kind: 'power', month: monthsBack(1), amount: 40000, units: 5000, note: '', at: 1 }];
    return s as SepState;
  };
  async function openForm(page: Page) {
    await switchTab(page, 'pageFinance');
    await page.locator('[data-action="invFinTab"][data-tab="bills"]').click();
    await page.locator('#billsPower [data-action="invCostBillOpen"]').first().click();
    await page.locator('#costBillMonth').fill(monthsBack(1));
  }

  test('records its arrears and penalty, and counts the arrears once', async ({ page }) => {
    await loadAppWithState(page, book());
    await openForm(page);
    await page.locator('#costBillAmount').fill('52000');
    await page.locator('#costBillArrears').fill('45000');
    await page.locator('#costBillArrearsOf').fill(monthsBack(3));
    await page.locator('#costBillPenalty').fill('1200');
    await page.locator('[data-action="invCostBillSave"]').click();
    const bills = (await readStoredState(page)).costBills;
    expect(bills).toHaveLength(2);
    expect(bills[1]).toMatchObject({ month: monthsBack(1), amount: 52000, arrears: 45000, arrearsOf: monthsBack(3), penalty: 1200 });
    await expect(page.locator(`#billsPower [data-bill="${bills[1].id}"]`)).toContainText('arrears ₹45,000.00');
    await expect(page.locator(`#billsPower [data-bill="${bills[1].id}"]`)).toContainText('penalty ₹1,200.00');
    // The month's electricity is its own bill and this one less its arrears: 40,000 + 7,000.
    expect(await g(page, `costBillCost(S.costBills[1])`)).toBe(7000);
  });

  test('a second one with no arrears asks first, and Cancel saves nothing', async ({ page }) => {
    await loadAppWithState(page, book());
    await openForm(page);
    await page.locator('#costBillAmount').fill('5000');
    await page.locator('[data-action="invCostBillSave"]').click();
    const asked = await answerAsk(page, 'cancel');
    expect(asked).toContain('second electricity bill');
    expect((await readStoredState(page)).costBills).toHaveLength(1);
    await page.locator('[data-action="invCostBillSave"]').click();
    await answerAsk(page, 'ok');
    await expect.poll(async () => (await readStoredState(page)).costBills.length).toBe(2);
  });

  test('arrears and penalty cannot be more than the bill', async ({ page }) => {
    await loadAppWithState(page, book());
    await openForm(page);
    await page.locator('#costBillAmount').fill('1000');
    await page.locator('#costBillArrears').fill('900');
    await page.locator('#costBillPenalty').fill('200');
    await page.locator('[data-action="invCostBillSave"]').click();
    await expect(page.locator('.inv-toast').last()).toContainText('cannot be more than its amount');
    expect((await readStoredState(page)).costBills).toHaveLength(1);
  });
});

test('a night hold on an in-time roll is the night shift, not the morning', async ({ page }) => {
  const [y, m, d] = todayIso().split('-');
  const staff = ['ALFA', 'BRAVO'].map((n, i) => ({ id: i + 1, name: n, comp: 'hourly', area: 'flex', hourRate: 50, active: true, onFloor: true }));
  await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM(), staff, attendance: {} } as unknown as SepState);
  const roll = `${d}/${m}/${y.slice(2)}/ IN TIME\n----night hold 8 pm----\n----berral----\n1) ALFA\nEXTRA 10 HOURS\n----8:30 AM----\nVAT A 1\n2) BRAVO`;
  const extra = await page.evaluate(t => {
    const r = (0, eval)('parseRelayRoll')(t, (0, eval)('relayRoster({})'), null);
    return r.days[r.date].extra.map((x: any) => ({ from: x.from, to: x.to, hours: x.hours }));
  }, roll);
  // "8 pm" ahead of the 8:30 shift was taken for a mislabelled morning (8 AM) with no end.
  expect(extra[0]).toEqual({ from: '20:00', to: '06:00', hours: 10 });
});

test('a rate corrected on a new invoice reaches its challan, with a note; a quantity dispatched in part does not', async ({ page }) => {
  await loadAppWithState(page, partState());
  const pick = async (search: string, imId: string) => {
    await switchTab(page, 'pageCreate');
    await page.locator('#invClientSearch').fill(search);
    await page.locator('[data-action="invSelectClient"]').first().click();
    await page.locator(`[data-action="invCreatePickChallan"][data-id="${imId}"]`).check();
  };
  await pick('kg test', 'IM-401');
  const rate = page.locator('input[data-field="rate"][data-idx="0"]');
  await rate.fill('13.2');
  await rate.dispatchEvent('change');
  await page.locator('#invSaveBtn').click();
  await expect.poll(async () => (await readStoredState(page)).invoices.length).toBe(1);
  const line = (await readStoredState(page)).incomingMaterial.find((x: any) => x.id === 'IM-401').items[0];
  expect(line).toMatchObject({ rate: 13.2, amount: 1320, qty: 100 });
  expect(line.corrections).toHaveLength(1);
  expect(line.corrections[0]).toMatchObject({ invoice: 'SEP/TEST-00001', from: { rate: 13, amount: 1300 }, to: { rate: 13.2, amount: 1320 } });
  expect(await g(page, `challanCorrectionText(S.incomingMaterial.find(function(x){ return x.id === 'IM-401'; }).items[0], S.incomingMaterial.find(function(x){ return x.id === 'IM-401'; }).items[0].corrections[0])`))
    .toBe('from SEP/TEST-00001: rate 13 → 13.2');
  await switchTab(page, 'pageIM');
  await page.locator('[data-action="invIMTab"][data-tab="invoiced"]').click();
  const im = page.locator('[data-im="IM-401"]');
  if (!(await im.locator('[data-im-correction]').count())) await im.locator('[data-action]').first().click();
  await expect(page.locator('[data-im-correction]').first()).toContainText('from SEP/TEST-00001: rate 13 → 13.2');

  // 200 of the 600 pieces invoiced is a dispatch, and the challan still reads 600.
  await pick('samarth', 'IM-301');
  await page.locator('input[data-field="qty"][data-idx="0"]').fill('200');
  await page.locator('#invSaveBtn').click();
  await expect.poll(async () => (await readStoredState(page)).invoices.length).toBe(2);
  const part = (await readStoredState(page)).incomingMaterial.find((x: any) => x.id === 'IM-301').items[0];
  expect(part).toMatchObject({ qty: 600, amount: 1500 });
  expect(part.corrections).toBeUndefined();
});

test("Home's month to date is net of credit notes, and says so", async ({ page }) => {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
  s.clients = [{ id: 1, name: 'ALPHA', billingMode: 'weight', gstType: 'intra', gstin: '', address: '', isActive: true,
    rates: [{ ratePerKg: 10, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [] }];
  s.invoices = [{ id: 'INV-1', invoiceNumber: '00001', displayNumber: 'SEP/TEST-00001', date: todayIso(), status: 'active', invoiceState: 'created',
    clientId: 1, clientName: 'ALPHA', clientGSTIN: '', clientAddress: {}, gstType: 'intra',
    items: [{ partNumber: 'P', desc: 'P', hsn: '998873', unit: 'KG', qty: 1000, rate: 10, amount: 10000, nosQty: null }],
    taxableValue: 10000, cgstPer: 9, cgstAmt: 900, sgstPer: 9, sgstAmt: 900, igstPer: 0, igstAmt: 0, grandTotal: 11800, amountInWords: '',
    challanNo: '', challanDate: '', poNumber: '', poDate: '', despatchDate: '', transport: '', remarks: '', createdAt: 1 }];
  s.creditNotes = [{ id: 'CN-1', cnNumber: '001', displayNumber: 'CN/001/TEST', date: todayIso(), status: 'active', kind: 'adjustment',
    clientId: 1, invoiceIds: ['INV-1'], taxableValue: 200, createdAt: 1 }];
  await loadAppWithState(page, s);
  await switchTab(page, 'pageHome');
  await expect(page.locator('#mtdRevenue')).toContainText('9,800.00');
  await expect(page.locator('#mtdRevenueSub')).toContainText('net of ₹200.00 in credit notes');
});
