import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, type SepState } from './fixtures';

// P205: what each hand was paid, month by month (owner, 10 Oct 2026: "no way to see and print the pay slip of each employee
// and/or what they have been paid": two salaries had gone to each other's accounts and a ruled figure was paid short, to be
// adjusted the month after). The bank's salary legs are payments; a month on the payroll as paid is set
// against them, not read as settled; balances carry from a month the owner sets, each month named; a hand's history; any
// month's slip. Names, wages and the statement are made up; dates are built from today.

const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
/* 'YYYY-MM' n months before this one. */
function monthBack(n: number, from = todayIso()): string {
  const d = new Date(from.slice(0, 7) + '-01T00:00:00');
  d.setMonth(d.getMonth() - n);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
const M2 = monthBack(2), M1 = monthBack(1);
let seq = 0;
function leg(date: string, payee: string, dr: number) {
  return { id: 'BK-P' + (++seq), date, valueDate: date, narration: 'NEFT-BARBT00000000' + seq + '-' + payee + '-STATE BANK OF I', chq: '', dr, cr: 0, balance: 400000, dayIdx: seq, importId: 'BI-P' };
}
const STAFF = [
  { id: 1, name: 'Asha Kumari', comp: 'monthly', dayRate: 500, area: 'vat-a1', onFloor: true, active: true },
  { id: 2, name: 'Bina Devi', comp: 'monthly', dayRate: 375, area: 'vat-a2', onFloor: true, active: true },
  { id: 3, name: 'Chandu Oraon', comp: 'monthly', dayRate: 300, monthWage: 9000, area: 'gate', onFloor: false, active: true },
  { id: 4, name: 'Dinesh Munda', comp: 'monthly', dayRate: 380, area: 'barrel', onFloor: true, active: true },
  { id: 5, name: 'Eshan Soren', comp: 'hourly', hourRate: 50, area: 'barrel', onFloor: true, active: true }];
/* The month two back on its slip (Chandu at the ruled figure), Dinesh not on it but worked; the salaries for it paid on the 14th
   of last month, Asha's and Bina's to each other's account, Chandu's short. */
function book(extra: any = {}): SepState {
  seq = 0;
  const s: any = emptyState();
  s.incomingMaterial = noSeedIM();
  s.labour = { holidays: [] };
  s.staff = STAFF;
  s.attendance = {};
  ['-03', '-04', '-05'].forEach(d => { s.attendance[M2 + d] = { marks: { 4: { st: 'P', area: 'barrel', hours: 8, ot: 0 } }, extra: [], note: '' }; });
  s.payrollPaid = [{ id: 'PRL-1', month: M2, source: 'slip', status: 'paid', note: '', at: 1, rows: [
    { name: 'Asha Kumari', rate: 500, worked: 24, restDays: 0, dayPay: 12000, otHours: 0, ot: 0, paid: null, note: '' },
    { name: 'Bina Devi', rate: 375, worked: 24, restDays: 0, dayPay: 9000, otHours: 0, ot: 0, paid: null, note: '' },
    { name: 'Chandu Oraon', rate: 290.3226, worked: 22, restDays: 6, dayPay: 8129.03, otHours: 0, ot: 0, paid: null, note: 'ruled' }] }];
  const rows = [leg(M1 + '-14', 'ASHA KUMARI', 9000), leg(M1 + '-14', 'BINA DEVI', 12000), leg(M1 + '-14', 'CHANDU ORAON', 7650)];
  s.bank = { rows, imports: [{ id: 'BI-P', at: 1, file: 't.xls', account: '', from: rows[0].date, to: rows[2].date, rows: 3, added: 3, closing: 0 }],
    parties: {}, opening: {}, gstNotes: {}, bounces: {}, cheques: [] };
  return Object.assign(s, extra);
}
const due = (page: Page, month: string) => ev(page, `payDue(psMonthWeek('${month}')).rows.filter(function(r) { return !r.weekly; }).map(function(r) {
  return { id: r.w.id, paid: r.paid, due: r.due, carried: r.carried, compared: !!r.compared, crossed: r.crossed ? r.crossed.name : null }; })`) as Promise<any[]>;
const byId = (rows: any[], id: number) => rows.find(r => r.id === id);
async function openPay(page: Page, month: string) {
  await switchTab(page, 'pageStaff');
  await ev(page, `_attView = 'pay'; _attWeekStart = psMonthWeek('${month}'); renderAttendance()`);
}

test.describe('P205: what each hand was paid', () => {
  test('a salary on the statement is paid; a month on its slip is set against it, the crossed legs named; nothing carries until a month is set', async ({ page }) => {
    await loadAppWithState(page, book());
    const m2 = await due(page, M2);
    expect(byId(m2, 1)).toMatchObject({ paid: 9000, due: 3000, compared: true, crossed: 'Bina Devi' });
    expect(byId(m2, 2)).toMatchObject({ paid: 12000, due: -3000, compared: true, crossed: 'Asha Kumari' });
    expect(byId(m2, 3)).toMatchObject({ paid: 7650, due: 479.03, compared: true, crossed: null });
    // Not on the month's slip and nothing paid to them: paid off the slip, never left owed the month.
    expect(byId(m2, 4)).toMatchObject({ paid: 0, due: 0 });
    await openPay(page, M2);
    const asha = page.locator('[data-pay-row="1"]');
    await asha.locator('summary').click();
    await expect(asha).toContainText('Earned, as the slip says');
    await expect(asha).toContainText(', by bank');
    await expect(asha).toContainText('The bank legs crossed');
    // The legs are listed with the payments, without a Void: the statement is their record.
    await expect(page.locator('[data-payment^="bank:"]')).toHaveCount(3);
    await expect(page.locator('[data-payment^="bank:"] [data-action="invPayVoid"]')).toHaveCount(0);
    // No month set: the statement's legs start no balance, and the screen asks for the month.
    const now = await due(page, todayIso().slice(0, 7));
    now.forEach(r => expect(r.carried).toBe(0));
    await expect(page.locator('[data-pay-carry-from=""] [data-action="invPayCarryFrom"]')).toBeVisible();
    // The differences are still asked about, month by month, while nothing carries.
    const wvs = await ev(page, 'TODO_RULE_FNS.wageVsSlip()') as any[];
    expect(wvs).toHaveLength(1);
    expect(wvs[0].sub).toContain('Asha Kumari short ₹3,000.00');
  });

  test('counted from a month, each difference carries to the next month, named on Pay, the history and the slip', async ({ page }) => {
    await loadAppWithState(page, book());
    await openPay(page, M1);
    await page.locator('[data-action="invPayCarryFrom"]').first().click();
    await page.locator('#payCfMonth').selectOption(M2);
    await page.locator('[data-action="invPayCarryFromSave"]').click();
    await expect(page.locator(`[data-pay-carry-from="${M2}"]`)).toBeVisible();
    expect((await readStoredState(page)).labour.payCarryFrom).toBe(M2);
    const m1 = await due(page, M1);
    expect(byId(m1, 1)).toMatchObject({ carried: 3000, due: 3000 });
    expect(byId(m1, 2)).toMatchObject({ carried: -3000, due: -3000 });
    expect(byId(m1, 3)).toMatchObject({ carried: 479.03, due: 479.03 });
    expect(byId(m1, 4)).toMatchObject({ carried: 0 });
    // The brought-forward line names the month and what happened in it.
    await expect(page.locator('[data-carried-row="1"]')).toContainText('paid ₹9,000.00 against ₹12,000.00 on the slip, the bank legs crossed with Bina Devi’s');
    await expect(page.locator('[data-carried-row="3"]')).toContainText('paid ₹7,650.00 against ₹8,129.03 on the slip');
    // Pay asks about it as a balance now; the month's own task goes, since Pay carries it.
    expect(await ev(page, 'TODO_RULE_FNS.wageVsSlip()')).toHaveLength(0);
    const tasks = await ev(page, 'TODO_RULE_FNS.payCarry()') as any[];
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('3 workers carry a balance from an earlier period');

    // Asha's history: the month two back paid short by bank, the crossing, the balance after it; its slip prints from there.
    await page.locator('[data-pay-row="1"] summary').click();
    await page.locator('[data-pay-row="1"] [data-action="invPayHistory"]').click();
    const hist = page.locator('[data-pay-history-dialog]');
    await expect(hist.locator('[data-pay-history-now]')).toHaveAttribute('data-pay-history-now', '3000');
    const month = hist.locator(`[data-pay-period="${M2}-01"]`);
    await expect(month).toContainText('paid short');
    await month.locator('summary').click();
    await expect(month).toContainText('The bank legs crossed');
    await expect(month).toContainText('Owed after it');
    await month.locator('[data-action="invPsOne"]').click();
    const slip = page.locator('#invPrintBody [data-ps-slip="1"]');
    await expect(slip).toContainText(', by bank');
    await expect(slip.locator('[data-ps-due]')).toContainText('3,000.00');
  });

  test('Pay slips for a month picked: the monthly hands of that month, the brought-forward line naming where it came from', async ({ page }) => {
    await loadAppWithState(page, book({ labour: { holidays: [], payCarryFrom: M2 } }));
    await openPay(page, todayIso().slice(0, 7));
    await page.locator('[data-action="invPsOpen"]').click();
    await page.locator('#psMonth').selectOption(M1);
    const dlg = page.locator('[data-ps-dialog]');
    await expect(dlg).toContainText('Monthly · ' + await ev(page, `_monthLabel('${M1}')`));
    await expect(dlg.locator('[data-ps-pick="5"]')).toHaveCount(0);   // the weekly hands stay the week's
    await dlg.locator('[data-action="invPsPrint"]').click();
    const asha = page.locator('#invPrintBody [data-ps-slip="1"]');
    await expect(asha.locator('[data-ps-carried]')).toContainText('the bank legs crossed with Bina Devi’s');
    await expect(page.locator('#invPrintBody [data-ps-slip="2"] [data-ps-carried]')).toContainText('Paid over before, taken back');
  });

  test('a payment typed on Pay that the statement holds is counted once', async ({ page }) => {
    await loadAppWithState(page, book({ staffPayments: [{ id: 'PAY-1', staffId: 3, date: M1 + '-15', amount: 7650, kind: 'payment', note: 'by NEFT', at: 1 }] }));
    expect(byId(await due(page, M2), 3)).toMatchObject({ paid: 7650, due: 479.03 });
    const pays = await ev(page, `payPaymentsOf(3).map(function(p) { return [p.how, p.amount, p.typed || '']; })`);
    expect(pays).toEqual([['bank', 7650, 'PAY-1']]);
  });

  test("last month's salary is not owed before the 21st, and is from it", async ({ page }) => {
    // A month with the marks and no salary yet: on the 10th it is not a balance owed; on the 25th it is.
    let installed = false;
    const at = async (day: string) => {
      if (!installed) { await page.clock.install({ time: new Date(day + 'T10:00:00') }); installed = true; }
      else await page.clock.setSystemTime(new Date(day + 'T10:00:00'));
      const prev = monthBack(1, day);
      const s: any = book({ labour: { holidays: [], payCarryFrom: prev } });
      s.payrollPaid = []; s.bank = { rows: [], imports: [], parties: {}, opening: {}, gstNotes: {}, bounces: {}, cheques: [] };
      s.attendance = {};
      ['-03', '-04', '-05'].forEach(d => { s.attendance[prev + d] = { marks: { 1: { st: 'P', area: 'vat-a1', hours: 8, ot: 0 } }, extra: [], note: '' }; });
      await loadAppWithState(page, s);
      return ev(page, `payOverdue(staffById(1)).amount`) as Promise<number>;
    };
    expect(await at('2026-03-10')).toBe(0);
    expect(await at('2026-03-25')).toBeGreaterThan(0);
  });
});
