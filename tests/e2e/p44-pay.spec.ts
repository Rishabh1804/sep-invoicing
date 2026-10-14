import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, answerAsk, type SepState, openPulse, openWidget, openAttendance } from './fixtures';

// P44: pay. The pay week runs Sunday to Saturday (paid Saturday); what each
// worker is due (earned minus paid); the week's payout, predicted at its own
// pace and read against the median of past weeks; hours by area; and the day's
// attendance on Home. Made-up names (the repo is public).

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** Sunday of the pay week `weeks` from this one, plus `day` days (0 = Sunday). */
function wd(weeks: number, day: number): string {
  const d = new Date(todayIso() + 'T00:00:00');
  d.setDate(d.getDate() - d.getDay() + weeks * 7 + day);
  return isoOf(d);
}

const STAFF = [
  { id: 1, name: 'Arun', comp: 'monthly', area: 'vat-a1', dayRate: 500, active: true, onFloor: true },
  { id: 2, name: 'Bala', comp: 'hourly', area: 'barrel', hourRate: 50, active: true, onFloor: true },
  { id: 3, name: 'Chand', comp: 'daily', area: 'vat-a2', dayRate: 400, active: true, onFloor: true },
];

function history() {
  const att: Record<string, any> = {};
  const put = (iso: string, marks: Record<string, any>) => { att[iso] = { marks, extra: [], note: '' }; };
  // Three past weeks of Bala, Mon–Sat: 8 h, 8 h, then 10 h a day.
  [[-3, 8], [-2, 8], [-1, 10]].forEach(([wk, h]) => {
    for (let day = 1; day <= 6; day++) put(wd(wk, day), { 2: { st: 'P', hours: h, ot: 0, area: 'barrel' } });
  });
  // This week: a Sunday of 6 h, then Monday and Tuesday at 8 h. Arun present Mon/Tue.
  put(wd(0, 0), { 2: { st: 'P', hours: 6, ot: 0, area: 'barrel' } });
  put(wd(0, 1), { 1: { st: 'P', hours: 11, ot: 3, area: 'vat-a1' }, 2: { st: 'P', hours: 8, ot: 0, area: 'barrel' } });
  put(wd(0, 2), { 1: { st: 'P', hours: 8, ot: 0, area: 'vat-a1' }, 2: { st: 'P', hours: 8, ot: 0, area: 'barrel' } });
  return att;
}

async function load(page: Page, extra: Partial<SepState> = {}) {
  // No paid holidays: the pace below assumes six working days, whichever week the spec runs in (P107 counts a holiday out).
  await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM(), staff: STAFF, attendance: history(), labour: { holidays: [] }, ...extra } as SepState);
}
async function openPay(page: Page) {
  await switchTab(page, 'pageStaff');
  await page.locator('[data-action="invAttView"][data-view="pay"]').click();
}

test.describe('P44: pay', () => {
  test('the week grid runs Sunday to Saturday and is numbered by its Saturday', async ({ page }) => {
    await load(page);
    await switchTab(page, 'pageStaff');
    await openAttendance(page, 'week');
    const heads = page.locator('#attWeekGrid thead th:not(:first-child)');
    await expect(heads).toHaveCount(7);
    await expect(heads.first()).toContainText('Sun');
    await expect(heads.last()).toContainText('Sat');
    await expect(heads.first()).toHaveAttribute('data-sun', '');
    // Bala's Sunday is on the grid, carrying its hours.
    await expect(page.locator(`[data-action="invAttCycle"][data-id="2"][data-date="${wd(0, 0)}"]`)).toContainText('P6');
    expect(await g(page, `attPayWeekNumber('${wd(0, 0)}') === attWeekNumber('${wd(0, 6)}')`)).toBe(true);
  });

  test('the week so far, the prediction at its own pace, and the swing from the median', async ({ page }) => {
    await load(page);
    const f = await g(page, `(function(){ var f = payForecast('${wd(0, 0)}');
      return { total: f.week.total, days: f.week.recordedDays, pace: f.pace, missing: f.missing, predicted: f.predicted,
        median: f.median, weeks: f.medianWeeks, swing: f.swing, basis: f.basis }; })()`) as any;
    // Sunday 6 h + Mon/Tue 8 h at ₹50 = ₹1,100 so far over two working days.
    expect(f.total).toBe(1100);
    expect(f.days).toBe(2);
    // The Sunday is overtime and does not repeat: the pace is (1100 − 300) / 2.
    expect(f.pace).toBe(400);
    expect(f.missing).toBe(4);
    expect(f.predicted).toBe(2700);
    expect(f.basis).toBe('pace');
    // Past weeks: 2,400 · 2,400 · 3,000 → median 2,400; weeks nobody typed are left out.
    expect(f.median).toBe(2400);
    expect(f.weeks).toBe(3);
    expect(f.swing).toBe(300);

    await openPay(page);
    await expect(page.locator('#payForecast')).toContainText('2 of 6 days recorded, and the Sunday');
    // The swing is a tile since TM4b: its figure in rupees, the share of the median under it.
    await expect(page.locator('#paySwing')).toHaveText('+₹300.00');
    await expect(page.locator('[data-tile="swing"]')).toContainText('+13% on the median');
    await expect(page.locator('#payHistory [data-week]')).toHaveCount(12);
    // The week's payout and, under it, its difference from the median the panel's head names (TM4b: two facts a row).
    await expect(page.locator('#payHistory .inv-panel-count')).toContainText('median ₹2,400.00');
    await expect(page.locator('#payHistory [data-week]').nth(1)).toContainText('+₹600.00');
    await expect(page.locator('#payHistory [data-week]').nth(1).locator('[title^="against the median"]')).toHaveText('+₹600.00');
  });

  test('due is earned minus paid, recorded from the due list, and a void keeps the record', async ({ page }) => {
    await load(page);
    await openPay(page);
    // A hand's line is its due; its fold holds the sum and the Pay that fills the form (TM4b).
    const bala = page.locator('#payDue [data-pay-row="2"]');
    await expect(bala.locator('> summary .inv-num')).toHaveText('₹1,100.00');
    await bala.locator('> summary').click();
    await expect(bala.locator('[data-action="invPayPick"]')).toHaveText('Pay ₹1,100.00');
    await bala.locator('[data-action="invPayPick"]').click();
    await expect(page.locator('#payWorker')).toHaveValue('2');
    await expect(page.locator('#payAmount')).toHaveValue('1100');
    await page.locator('[data-action="invPaySave"]').click();
    await expect(bala.locator('> summary')).toContainText('paid ₹1,100.00');
    await expect(bala.locator('> summary .inv-num')).toHaveText('₹0.00');

    // An advance to the monthly hand is taken off the month.
    await page.locator('#payWorker').selectOption('1');
    await page.locator('#payKind').selectOption('advance');
    await page.locator('#payAmount').fill('300');
    // Dated on the Sunday: the monthly tier's month is the one the week's Sunday is in (P107), so it always counts here.
    await page.locator('#payDate').fill(wd(0, 0));
    await page.locator('[data-action="invPaySave"]').click();
    const arun = await g(page, `(function(){ var r = payDue('${wd(0, 0)}').rows.find(function(x){ return x.w.id === 1; }); return [r.earned.total, r.paid, r.due]; })()`) as number[];
    expect(arun[1]).toBe(300);
    expect(arun[2]).toBeCloseTo(arun[0] - 300, 2);

    let s = await readStoredState(page);
    expect(s.staffPayments).toHaveLength(2);
    expect(s.staffPayments[0]).toMatchObject({ staffId: 2, amount: 1100, kind: 'payment' });

    await page.locator('[data-action="invPayVoid"]').first().click();
    await answerAsk(page, 'ok', 'Paid twice by mistake');
    s = await readStoredState(page);
    expect(s.staffPayments).toHaveLength(2);
    expect(s.staffPayments.filter((p: any) => p.voidedAt)).toHaveLength(1);
    expect(s.staffPayments.find((p: any) => p.voidedAt).voidReason).toBe('Paid twice by mistake');
  });

  test('hours by area, every tier together', async ({ page }) => {
    await load(page);
    const r = await g(page, `areaHoursForRange('${wd(0, 0)}', '${wd(0, 6)}').rows.map(function(a){ return [a.id, a.hours, a.ot, a.workerDays]; })`);
    expect(r).toEqual([['barrel', 22, 0, 3], ['vat-a1', 19, 3, 2]]);
    await switchTab(page, 'pageStaff');
    await page.locator('[data-action="invAttView"][data-view="areas"]').click();
    // Areas opens on this week; its way back is under More only once another week is shown (TM4b).
    await expect(page.locator('#pageStaff [data-action="invAttThisWeek"]')).toHaveCount(0);
    await expect(page.locator('#areaHours')).toContainText('41.0 h');
  });

  test('Home carries the day\'s attendance', async ({ page }) => {
    const t = todayIso();
    await load(page, { attendance: { [t]: { marks: { 1: { st: 'P', hours: 8, ot: 0, area: 'vat-a1' }, 2: { st: 'A', ot: 0, hours: 0, area: 'flex' } }, extra: [{ kind: 'coverage', area: 'vat-a1', hours: 8 }], note: '' } } } as any);
    await openWidget(page, 'attendance');
    const card = page.locator('#homeAttCard');
    await expect(card).toContainText('today');
    await expect(page.locator('#homeAttOnSite')).toHaveText('1/3');
    await expect(card).toContainText('1 absent · 1 unmarked');
    await expect(card).toContainText('Bala');
    await expect(card).toContainText('8.0 h');
    await card.locator('[data-action="invPayOpenAtt"]').click();
    await expect(page.locator('#attDate')).toHaveValue(t);
  });
});
