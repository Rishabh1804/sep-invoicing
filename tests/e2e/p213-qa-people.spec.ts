import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, type SepState } from './fixtures';
import { PINS, unlock, withUsers } from './p140-guard.fixture';

// P213: People after its QA (the audit before PR 146, A4). What it pins, each a finding reproduced on the build before:
// - Pay and the slip foot: a hand off the month's payroll as paid (A4-1), a month whose earnings nobody recorded paid by the bank
//   (A4-4, settled, never carried as the whole salary paid over), the paise dropped from a payment (A4-6).
// - An advance typed on Pay that also went out by bank is one payment (A4-2); a typed payment the statement holds is listed once
//   (A4-7); a salary leg after the 20th is its own month's on Pay, in the bank's cost and in the To-do alike (A4-8).
// - The bank's legs are money: a role that sees wages and not money sees what was paid, never the statement's legs (A4-3); a leg
//   the statement's name only reads as a hand is said on the slip (A4-17).
// - A card naming an area short is never green (A4-5); the floor over its number is info (A4-13); a week's worked holiday is not a
//   day recorded past the working days (A4-12); the register's agreeing cell is ok in its dialog (A4-14).
// - Every disagreement on the extra can be explained (A4-15), and only by a role that may make a floor entry (A4-16).
// - A night block from midnight is read as the night's (A4-9); the hours to check are on Pay's card face (A4-10); a Sunday's snacks
//   stay out of the week's pace (A4-11); the paste box goes back to People (A4-19); the dead helpers are gone (A4-18).
// Names, wages and the statement are made up; dates are built from today.

const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const shift = (from: string, n: number) => { const d = new Date(from + 'T00:00:00'); d.setDate(d.getDate() + n); return isoOf(d); };
/* 'YYYY-MM' n months before this one. */
function monthBack(n: number): string {
  const d = new Date(todayIso().slice(0, 7) + '-01T00:00:00');
  d.setMonth(d.getMonth() - n);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1);
}
const M2 = monthBack(2), M1 = monthBack(1);
/* The first n days of a month that are not Sundays, from its 2nd. */
function workdaysIn(month: string, n: number): string[] {
  const out: string[] = [];
  for (let d = 2; out.length < n; d++) { const iso = month + '-' + pad(d); if (new Date(iso + 'T00:00:00').getDay() !== 0) out.push(iso); }
  return out;
}
/* Last pay week's Sunday: whole, and in the past. */
const WS = (() => { const t = new Date(todayIso() + 'T00:00:00'); t.setDate(t.getDate() - t.getDay() - 7); return isoOf(t); })();

const STAFF = [
  { id: 1, name: 'Ravi Test', comp: 'monthly', dayRate: 500, area: 'vat-a1', onFloor: true, active: true },
  { id: 2, name: 'Sita Test', comp: 'monthly', dayRate: 375, area: 'vat-a2', onFloor: true, active: true },
  { id: 3, name: 'Mohan Test', comp: 'monthly', dayRate: 300, monthWage: 8600, area: 'gate', onFloor: false, active: true },
  { id: 4, name: 'Gopal Test', comp: 'monthly', dayRate: 380, area: 'barrel', onFloor: true, active: true },
  { id: 5, name: 'Hari Test', comp: 'hourly', hourRate: 50, area: 'barrel', onFloor: true, active: true }];
let seq = 0;
function leg(date: string, payee: string, dr: number) {
  return { id: 'BK-Q' + (++seq), date, valueDate: date, narration: 'NEFT-BARBT00000000' + seq + '-' + payee + '-STATE BANK OF I', chq: '', dr, cr: 0, balance: 400000, dayIdx: seq, importId: 'BI-Q' };
}
function bankOf(rows: any[]) {
  rows.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  return { rows, imports: [{ id: 'BI-Q', at: 1, file: 't.xls', account: '', from: rows[0].date, to: rows[rows.length - 1].date, rows: rows.length, added: rows.length, closing: 0 }],
    parties: {}, opening: {}, gstNotes: {}, bounces: {}, cheques: [] };
}
const present = (area: string) => ({ st: 'P', area, hours: 8, ot: 0 });
/* The roster above, no paid holiday, and whatever the test adds. */
function book(extra: any = {}): SepState {
  seq = 0;
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM(), staff: STAFF, labour: { holidays: [] }, attendance: {} };
  return Object.assign(s, extra);
}
const slipRow = (name: string, dayPay: number) => ({ name, rate: 0, worked: 24, restDays: 0, dayPay, otHours: 0, ot: 0, paid: null, note: '' });
const paidMonth = (month: string, rows: any[]) => ({ id: 'PRL-' + month, month, source: 'slip', status: 'paid', note: '', at: 1, rows });
/* payDue's row for one hand, for the monthly hands' month `month`. */
const dueOf = (page: Page, month: string, id: number) => ev(page, `(function() { var r = payDue(psMonthWeek('${month}')).rows.find(function(x) { return x.w.id === ${id}; });
  return { due: r.due, paid: r.paid, carried: r.carried, earned: r.earned.total, offSlip: !!r.offSlip, unknown: !!r.unknown, rounded: r.rounded || 0 }; })()`) as Promise<any>;
async function openPay(page: Page, month: string) {
  await switchTab(page, 'pageStaff');
  await ev(page, `_attDate = psMonthWeek('${month}'); _attView = 'pay'; _attWeekStart = psMonthWeek('${month}'); renderAttendance()`);
  await page.locator('#payForecast').waitFor({ state: 'attached' });
}
async function printSlips(page: Page) {
  await page.locator('[data-action="invPsOpen"]').click();
  await page.locator('[data-ps-dialog] [data-action="invPsPrint"]').click();
  await page.locator('#invPrintBody [data-ps-slip]').first().waitFor();
}
/* A printed slip's arithmetic: Earned, each line under it (a payment, what settled the period, what is carried) with its sign,
   and what it says is due (an advance negative). It foots when Earned plus the lines is the due. */
function slipSums(page: Page, id: number) {
  return page.locator(`#invPrintBody [data-ps-slip="${id}"]`).evaluate(slip => {
    const num = (t: string) => { const s = t.replace(/\s/g, ''); const n = Number(s.replace(/[^\d.]/g, '')); return /^[−-]/.test(s) ? -n : n; };
    const rows = Array.from(slip.querySelectorAll('tbody tr'));
    const gi = rows.findIndex(r => r.querySelector('[data-ps-gross]'));
    const gross = num(rows[gi].querySelector('[data-ps-gross]')!.textContent || '');
    const dueRow = rows.find(r => r.querySelector('[data-ps-due]'))!;
    const dueAbs = num(dueRow.querySelector('[data-ps-due]')!.textContent || '');
    const due = /Advance/.test(dueRow.textContent || '') ? -dueAbs : dueAbs;
    const lines = rows.slice(gi + 1).filter(r => r !== dueRow).map(r => num((r.lastElementChild as HTMLElement).textContent || ''));
    return { gross, lines, due, sum: Math.round((gross + lines.reduce((t, x) => t + x, 0)) * 100) / 100 };
  });
}

test.describe('P213: Pay and the slip foot', () => {
  test('A4-1: a hand off the month’s payroll as paid says so on Pay, and the slip takes it off, so it foots', async ({ page }) => {
    const s: any = book({ payrollPaid: [paidMonth(M2, [slipRow('Ravi Test', 12000)])] });
    workdaysIn(M2, 3).forEach(d => { s.attendance[d] = { marks: { 4: present('barrel') }, extra: [], note: '' }; });
    await loadAppWithState(page, s);
    // Earned from the marks, nothing paid, nothing due: the month was paid off its payroll (P205).
    expect(await dueOf(page, M2, 4)).toMatchObject({ earned: 1140, paid: 0, due: 0 });
    await openPay(page, M2);
    const row = page.locator('[data-pay-row="4"]');
    await expect(row.locator('summary .inv-row-meta')).toHaveText('earned ₹1,140.00 · not on the slip');
    await row.locator('summary').click();
    await expect(row).toContainText('Not on the month’s slip');
    await expect(row).toContainText('− ₹1,140.00');
    await printSlips(page);
    await expect(page.locator('#invPrintBody [data-ps-slip="4"] [data-ps-settle="offslip"]')).toContainText('Paid outside the month');
    const sums = await slipSums(page, 4);
    expect(sums.gross).toBe(1140);
    expect(sums.sum).toBe(sums.due);
  });

  test('A4-4: a closed month with no earnings recorded, paid by the bank, is settled: never carried as the salary paid over', async ({ page }) => {
    // Balances counted from the month two back; Sita has no mark that month and is on no slip, and the bank paid her salary for it.
    await loadAppWithState(page, book({ labour: { holidays: [], payCarryFrom: M2 }, bank: bankOf([leg(M1 + '-14', 'SITA TEST', 9000)]) }));
    expect(await dueOf(page, M2, 2)).toMatchObject({ paid: 9000, due: 0, unknown: true });
    expect((await dueOf(page, M1, 2)).carried).toBe(0);
    // Her history says the month's earnings are not recorded, and carries nothing after it.
    expect(await ev(page, `payHistoryRows(staffById(2)).filter(function(r) { return r.from === '${M2}-01'; }).map(function(r) { return Math.abs(r.balanceAfter.amount) < 1; })`)).toEqual([true]);
    await openPay(page, M2);
    const row = page.locator('[data-pay-row="2"]');
    await expect(row.locator('summary .inv-row-meta')).toHaveText('no earnings recorded · paid ₹9,000.00');
    await printSlips(page);
    const sums = await slipSums(page, 2);
    expect(sums.sum).toBe(sums.due);
    expect(sums.due).toBe(0);
  });

  test('A4-4: Count from a month offers only the months whose earnings are known', async ({ page }) => {
    const s: any = book();
    workdaysIn(M2, 2).forEach(d => { s.attendance[d] = { marks: { 4: present('barrel') }, extra: [], note: '' }; });
    await loadAppWithState(page, s);
    // Last month holds no slip and no attendance: nothing to set its salaries against.
    expect(await ev(page, 'payCarryFromMonths()')).toEqual([M2]);
  });

  test('A4-6: a salary paid to the rupee says the paise dropped, on Pay and on the slip, so the slip foots', async ({ page }) => {
    await loadAppWithState(page, book({ payrollPaid: [paidMonth(M2, [{ ...slipRow('Mohan Test', 7767.74), rate: 277.4194, worked: 22, restDays: 6 }])],
      bank: bankOf([leg(M1 + '-14', 'MOHAN TEST', 7767)]) }));
    expect(await dueOf(page, M2, 3)).toMatchObject({ earned: 7767.74, paid: 7767, due: 0, rounded: 0.74 });
    await openPay(page, M2);
    const row = page.locator('[data-pay-row="3"]');
    await row.locator('summary').click();
    await expect(row).toContainText('Rounded to the rupee');
    await printSlips(page);
    await expect(page.locator('#invPrintBody [data-ps-slip="3"] [data-ps-settle="rounded"]')).toContainText('−₹0.74');
    const sums = await slipSums(page, 3);
    expect(sums.gross).toBe(7767.74);
    expect(sums.sum).toBe(sums.due);
  });
});

test.describe('P213: what was paid, counted and listed once', () => {
  test('A4-2: an advance typed on Pay that went out by bank is one advance, for the month it is dated in', async ({ page }) => {
    await loadAppWithState(page, book({ bank: bankOf([leg(M1 + '-05', 'RAVI TEST', 2000)]),
      staffPayments: [{ id: 'PAY-A', staffId: 1, date: M1 + '-05', amount: 2000, kind: 'advance', note: 'festival', at: 1 }] }));
    expect(await ev(page, `payPaymentsOf(1).map(function(p) { return [p.how, p.kind, p.amount, p.typed || '']; })`)).toEqual([['bank', 'advance', 2000, 'PAY-A']]);
    // Paid once, against the month it is dated in; the month before is paid nothing.
    expect(await ev(page, `[payPaidFor(staffById(1), '${M2}-01', payMonthEnd('${M2}-01')), payPaidFor(staffById(1), '${M1}-01', payMonthEnd('${M1}-01'))]`)).toEqual([0, 2000]);
  });

  test('A4-7: a payment typed on Pay that the statement holds is listed once, on the leg’s row', async ({ page }) => {
    await loadAppWithState(page, book({ bank: bankOf([leg(M1 + '-14', 'MOHAN TEST', 7250)]),
      staffPayments: [{ id: 'PAY-1', staffId: 3, date: M1 + '-15', amount: 7250, kind: 'payment', note: 'by NEFT', at: 1 }] }));
    await openPay(page, M2);
    await expect(page.locator('[data-payment="PAY-1"]')).toHaveCount(0);
    await expect(page.locator('[data-payment^="bank:"]')).toHaveCount(1);
    await expect(page.locator('[data-payment^="bank:"]')).toContainText('typed on Pay too, counted once');
  });

  test('A4-8: a salary leg after the 20th is its own month’s, in the bank’s cost and the To-do as on Pay', async ({ page }) => {
    await loadAppWithState(page, book({ payrollPaid: [paidMonth(M2, [slipRow('Ravi Test', 9000)])],
      bank: bankOf([leg(M1 + '-14', 'RAVI TEST', 9000), leg(M1 + '-25', 'RAVI TEST', 2000)]) }));
    // Pay: the 14th pays the month before, the 25th its own month.
    expect(await ev(page, `payPaymentsOf(1).map(function(p) { return payMonthPaidFor(p).slice(0, 7); })`)).toEqual([M2, M1]);
    const named = await ev(page, `(function() { var m = bankCostByMonth().months; return [m['${M2}'] ? m['${M2}'].labour.named : 0, m['${M1}'] ? m['${M1}'].labour.named : 0]; })()`);
    expect(named).toEqual([9000, 2000]);
    // The month two back was paid as its slip says: no salary differs from it.
    expect(await ev(page, 'TODO_RULE_FNS.wageVsSlip()')).toEqual([]);
  });
});

test.describe('P213: the bank’s legs are money', () => {
  test.describe.configure({ timeout: 90_000 });

  test('A4-3: a role that sees wages and not money sees what each hand was paid, never the statement’s legs', async ({ page }) => {
    // The month two back on its slip, its two salaries paid by bank to each other's account.
    await loadAppWithState(page, book({ payrollPaid: [paidMonth(M2, [slipRow('Ravi Test', 12000), slipRow('Sita Test', 9000)])],
      bank: bankOf([leg(M1 + '-14', 'RAVI TEST', 9000), leg(M1 + '-14', 'SITA TEST', 12000)]) }));
    await withUsers(page, { roles: { supervisor: { wages: true } } });
    await unlock(page, 'U-sup', PINS.super);
    expect(await ev(page, '[grdSeesWages(), grdSeesMoney()]')).toEqual([true, false]);
    await openPay(page, M2);
    // Paid is still what was paid, and the crossing is still said: with no word of the bank.
    const row = page.locator('[data-pay-row="1"]');
    await row.locator('summary').click();
    await expect(row).toContainText('− ₹9,000.00');
    await expect(row).toContainText('Crossed with another hand');
    await expect(row).not.toContainText('bank');
    await expect(page.locator('[data-payment^="bank:"]')).toHaveCount(0);
    await expect(page.locator('[data-pay-carry-from]')).toHaveCount(0);
    await printSlips(page);
    await expect(page.locator('#invPrintBody [data-ps-slip="1"]')).toContainText('Paid on');
    await expect(page.locator('#invPrintBody')).not.toContainText('bank');
  });

  test('A4-17: a leg the statement’s name only reads as a hand is printed as one to confirm', async ({ page }) => {
    const s: any = book({ bank: bankOf([leg(M1 + '-14', 'RAVVI TEST', 9000)]) });
    workdaysIn(M2, 3).forEach(d => { s.attendance[d] = { marks: { 1: present('vat-a1') }, extra: [], note: '' }; });
    await loadAppWithState(page, s);
    expect(await ev(page, 'payBankLegs().map(function(l) { return [l.staffId, l.guess]; })')).toEqual([[1, true]]);
    await openPay(page, M2);
    await printSlips(page);
    await expect(page.locator('#invPrintBody [data-ps-slip="1"]')).toContainText('payee to confirm');
  });
});

/* Today's floor: VAT A1 three against its four, VAT A2 six against its four, the office and the gate; everybody in. The floor's
   nine heads are over its eight, though VAT A1 is short. */
function floorBook(): SepState {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM(), labour: { holidays: [] } };
  const areas = ['vat-a1', 'vat-a1', 'vat-a1', 'vat-a2', 'vat-a2', 'vat-a2', 'vat-a2', 'vat-a2', 'vat-a2', 'office', 'gate'];
  s.staff = areas.map((a, i) => ({ id: i + 1, name: 'Hand ' + 'ABCDEFGHIJK'[i] + ' Test', comp: 'hourly', area: a, hourRate: 60, active: true, onFloor: a !== 'office' && a !== 'gate' }));
  const marks: any = {};
  s.staff.forEach((w: any) => { marks[w.id] = present(w.area); });
  s.attendance = { [todayIso()]: { marks, extra: [], note: '' } };
  s.areaTargets = { 'vat-a1': 4, 'vat-a2': 4 };
  return s;
}

test.describe('P213: a card naming a shortfall is never green', () => {
  test('A4-5: VAT A1 short while the floor’s total meets its number: Floor’s People and Day’s verdict warn', async ({ page }) => {
    await loadAppWithState(page, floorBook());
    // On site 11 of 11 and the floor's nine over its eight: the gate and the floor's total alone read ok.
    expect(await ev(page, `attOnSiteTone(attDaySummary('${todayIso()}'))`)).toBe('ok');
    await switchTab(page, 'pageFloor');
    const people = page.locator('#flrHeroes [data-card="flr-people"]');
    await expect(people.locator('.inv-hero-title')).toHaveText('VAT A1 short 1');
    await expect(people).toHaveClass(/inv-hero-warning/);
    await switchTab(page, 'pageStaff');
    const verdict = page.locator('#attDayVerdict');
    await expect(verdict.locator('.inv-hero-title')).toContainText('VAT A1 short 1');
    await expect(verdict).toHaveClass(/inv-hero-warning/);
  });

  test('A4-13: the floor over its number is info, said as how many over, as each area’s is', async ({ page }) => {
    await loadAppWithState(page, floorBook());
    await switchTab(page, 'pageFloor');
    const onFloor = page.locator('#flrAtt .inv-tile', { hasText: 'On the floor' });
    await expect(onFloor).toHaveClass(/inv-tile-info/);
    await expect(onFloor).toContainText('1 over the complement');
  });

  test('A4-12: a paid holiday somebody worked is not a day recorded past the week’s working days', async ({ page }) => {
    const hol = shift(WS, 3);
    const s: any = book({ labour: { holidays: [hol] } });
    for (let i = 1; i <= 6; i++) s.attendance[shift(WS, i)] = { marks: { 5: { st: 'P', area: 'barrel', hours: 8 } }, extra: [], note: '' };
    await loadAppWithState(page, s);
    await switchTab(page, 'pageStaff');
    await ev(page, `_attDate = '${shift(WS, 1)}'; _attView = 'week'; _attWeekStart = '${WS}'; renderAttendance()`);
    const v = page.locator('#attWeekVerdict');
    await expect(v.locator('.inv-hero-sub')).toContainText('5 days recorded of 5');
    await expect(v.locator('.inv-tile', { hasText: 'Days recorded' }).locator('.inv-tile-value')).toHaveText('5/5');
  });

  test('A4-14: a register cell that agrees with the day reads ok in its dialog', async ({ page }) => {
    const [d] = workdaysIn(M2, 1);
    const s: any = book();
    s.attendance[d] = { marks: { 1: present('vat-a1') }, extra: [], note: '' };
    await loadAppWithState(page, s);
    const res: any = await ev(page, `aregImportData(${JSON.stringify({ kind: 'sep-att-register', version: 1, months: [{ month: M2, title: 'A PAGE', columns: ['RAVI'],
      days: [{ date: d, written: d.slice(8), kind: 'work', cells: [{ raw: 'P' }] }], totals: [], notes: [] }] })})`);
    expect(res).toMatchObject({ added: 1 });
    await switchTab(page, 'pageStaff');
    await ev(page, `_aregMonth = '${M2}'; _attView = 'register'; renderAttendance()`);
    await page.locator('#aregGrid [data-d="0"][data-c="0"]').click();
    const dot = page.locator('[data-areg-cell] .inv-dot', { hasText: 'Agrees with the day' });
    await expect(dot).toHaveClass(/inv-dot-ok/);
  });
});

/* Barrel's complement of one with its one hand on it, and eight hours booked each day: booked at complement, a disagreement a day. */
function extraBook(days: string[]): SepState {
  const s: any = book({ areaTargets: { barrel: 1 } });
  days.forEach(d => { s.attendance[d] = { marks: { 5: present('barrel') }, extra: [{ area: 'barrel', hours: 8 }], note: '' }; });
  return s;
}
async function openAreas(page: Page, weeks: number) {
  await switchTab(page, 'pageStaff');
  await ev(page, `_attDate = localDateStr(); _attWeekStart = attWeekStartOf(localDateStr()); _areaSpan = ${weeks}; _attView = 'areas'; renderAttendance()`);
  await page.locator('[data-card="extra"]').waitFor();
}

test.describe('P213: the extra, explained', () => {
  test.describe.configure({ timeout: 90_000 });

  test('A4-15: past the eighth, the rest are one tap away, each with its Explain', async ({ page }) => {
    // Last week's six working days and four of the week before's: ten disagreements.
    const days = [1, 2, 3, 4, 5, 6].map(i => shift(WS, i)).concat([1, 2, 3, 4].map(i => shift(WS, i - 7)));
    await loadAppWithState(page, extraBook(days));
    await openAreas(page, 4);
    const card = page.locator('[data-card="extra"]');
    await expect(card.locator('[data-action="invAreaExplain"]:visible')).toHaveCount(8);
    await expect(card.locator('[data-more-btn="area-explain"]')).toContainText('Show 2 more to explain');
    await card.locator('[data-more-btn="area-explain"] [data-action="invShowMore"]').click();
    await expect(card.locator('[data-action="invAreaExplain"]:visible')).toHaveCount(10);
  });

  test('A4-16: Explain and Reopen are a floor entry: a role that may not make one is told so', async ({ page }) => {
    await loadAppWithState(page, extraBook([shift(WS, 1), shift(WS, 2)]));
    // Explained once, with the guard off.
    await openAreas(page, 4);
    await page.locator('[data-action="invAreaExplain"]').first().click();
    await page.locator('#areaExReason').fill('checked against the sheet');
    await page.locator('[data-action="invAreaExplainSave"]').click();
    await expect(page.locator('[data-action="invAreaUnexplain"]')).toHaveCount(1);
    // A supervisor whose role may make no floor entry.
    await withUsers(page, { roles: { supervisor: { may: [] } } });
    await unlock(page, 'U-sup', PINS.super);
    await openAreas(page, 4);
    await page.locator('[data-action="invAreaExplain"]').first().click();
    expect(await answerAsk(page, 'ok')).toContain('explain an exception');
    await expect(page.locator('#areaExReason')).toHaveCount(0);
    await page.locator('[data-action="invAreaUnexplain"]').first().click();
    expect(await answerAsk(page, 'ok')).toContain('reopen an exception');
    const ex = (await readStoredState(page)).extraExceptions;
    expect(ex).toHaveLength(1);
    expect(ex[0].reopenedAt).toBeUndefined();
  });
});

test.describe('P213: the week’s payout', () => {
  test('A4-9: a block from midnight is the night’s: its crew is read by their outs, never their ins', async ({ page }) => {
    const d = shift(WS, 2);
    const s: any = book();
    s.staff = STAFF.concat([{ id: 6, name: 'Kanu Test', comp: 'hourly', hourRate: 50, area: 'vat-a1', onFloor: true, active: true }]);
    s.attendance[d] = { marks: { 5: { st: 'P', area: 'vat-a1', inMin: 510, outMin: 1800, hours: 21, ot: 0 }, 6: { st: 'P', area: 'vat-a1', inMin: 510, outMin: 1020, hours: 8, ot: 0 } },
      extra: [{ kind: 'block', area: 'vat-a1', areas: ['vat-a1'], from: '00:00', to: '06:00', hours: 0, crew: [5, 6] }], note: '' };
    await loadAppWithState(page, s);
    // Hari stayed through to 6 AM; Kanu went home at 5 PM, before the block.
    const gaps = await ev(page, `payCrewGaps('${d}', '${d}').map(function(g) { return [g.staffId, g.why]; })`);
    expect(gaps).toEqual([[6, 'out at 5 PM']]);
  });

  test('A4-10: hands on a block their times do not reach are on Pay’s card face, and the card warns', async ({ page }) => {
    const d = shift(WS, 2);
    const s: any = book();
    s.attendance[d] = { marks: { 5: { st: 'P', area: 'vat-a1', inMin: 510, outMin: 1020, hours: 8, ot: 0 } },
      extra: [{ kind: 'block', area: 'vat-a1', areas: ['vat-a1'], from: '20:00', to: '06:00', hours: 10, crew: [5] }], note: '' };
    await loadAppWithState(page, s);
    await switchTab(page, 'pageStaff');
    await ev(page, `_attDate = '${d}'; _attView = 'pay'; _attWeekStart = '${WS}'; renderAttendance()`);
    const card = page.locator('#payForecast');
    await expect(card.locator(':scope > summary')).toContainText('1 hand with hours to check');
    await expect(card).toHaveClass(/inv-hero-warning/);
  });

  test('A4-11: a Sunday’s snacks are the Sunday’s, never spread over the week’s pace', async ({ page }) => {
    // Wednesday of last week: the week is open, Sunday, Monday and Tuesday recorded.
    await page.clock.install({ time: new Date(shift(WS, 3) + 'T10:00:00') });
    const s: any = book();
    // The Sunday: eleven hours and an evening block (a snack at ₹20); Monday and Tuesday eight hours each, out at 5 PM.
    s.attendance[WS] = { marks: { 5: { st: 'P', area: 'barrel', inMin: 510, outMin: 1200, hours: 11, ot: 0 } },
      extra: [{ kind: 'block', area: 'barrel', areas: ['barrel'], from: '17:00', to: '20:00', hours: 0, crew: [5] }], note: '' };
    [1, 2].forEach(i => { s.attendance[shift(WS, i)] = { marks: { 5: { st: 'P', area: 'barrel', inMin: 510, outMin: 1020, hours: 8, ot: 0 } }, extra: [], note: '' }; });
    await loadAppWithState(page, s);
    const f: any = await ev(page, `(function(f) { return { open: f.open, basis: f.basis, pace: f.pace, snacks: f.week.snacks.amount }; })(payForecast('${WS}'))`);
    expect(f).toMatchObject({ open: true, basis: 'pace', snacks: 20 });
    // The two working days paid ₹400 each.
    expect(f.pace).toBe(400);
  });
});

test.describe('P213: the screens', () => {
  test('A4-19: the paste box goes back to People', async ({ page }) => {
    await loadAppWithState(page, floorBook());
    await switchTab(page, 'pageStaff');
    await page.locator('#pageStaff [data-action="invAttView"][data-view="paste"]').first().click();
    await expect(page.locator('#attContent .inv-pagehead-back')).toHaveText('People');
  });

  test('A4-18: the helpers nothing called are gone', async ({ page }) => {
    await loadAppWithState(page, book());
    expect(await ev(page, `[typeof payPaidBetween, typeof _areaFlagList, typeof _attStepper, typeof _attWeekLabel, typeof _attPasteBar]`))
      .toEqual(['undefined', 'undefined', 'undefined', 'undefined', 'undefined']);
  });
});
