import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, type SepState } from './fixtures';

// P49: the monthly tier on BM's model, the OT cap's start date, and a closed
// month read AS PAID from the slip rather than re-modelled from the marks.
// Made-up names (the repo is public).
//
// These fixtures use AUGUST and SEPTEMBER 2026 on purpose, not todayIso(): the
// cap binds from 1 Sep 2026, 15 Aug is the holiday BM's ruling was written
// against, and a payroll record is only read for a CLOSED month. All three are
// facts about those dates, and a past month does not move.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);

const HAND = { id: 1, name: 'Arun Das', comp: 'monthly', area: 'vat-a1', dayRate: 500, hourRate: 0, active: true, onFloor: true };
const GATE = { id: 2, name: 'Gopal', comp: 'monthly', area: 'gate', dayRate: 0, monthWage: 9000, hourRate: 0, active: true, onFloor: false };
const SENIOR = { id: 3, name: 'Kiran', comp: 'monthly', area: 'vat-a2', dayRate: 576, hourRate: 0, active: true, onFloor: true };

/** Every day of August 2026, weekday or Sunday, by day of month. */
function aug(day: number): string { return `2026-08-${String(day).padStart(2, '0')}`; }
const AUG_SUNDAYS = [2, 9, 16, 23, 30];
/** August's 25 working days: not a Sunday, not 15 Aug. */
const AUG_WORKING = Array.from({ length: 31 }, (_, i) => i + 1).filter(d => !AUG_SUNDAYS.includes(d) && d !== 15);

function augustAttendance() {
  const att: Record<string, any> = {};
  const put = (iso: string, id: number, mark: Record<string, unknown>) => {
    att[iso] = att[iso] || { marks: {}, extra: [], note: '' };
    att[iso].marks[id] = mark;
  };
  // Arun: 21 of 25 working days (84% — the half band), 102 h of weekday OT,
  // and one Sunday worked carrying 4 h past eight that must NOT be paid as OT.
  AUG_WORKING.slice(0, 21).forEach((d, i) => put(aug(d), 1, { st: 'P', hours: 8, ot: i < 17 ? 6 : 0, area: 'vat-a1' }));
  AUG_WORKING.slice(21).forEach(d => put(aug(d), 1, { st: 'A', hours: 0, ot: 0 }));
  put(aug(23), 1, { st: 'P', hours: 12, ot: 4, area: 'vat-a1' });
  // Gopal: 22 working days and a Sunday, on a contracted monthly wage.
  AUG_WORKING.slice(0, 22).forEach(d => put(aug(d), 2, { st: 'P', hours: 8, ot: 0, area: 'gate' }));
  put(aug(23), 2, { st: 'P', hours: 8, ot: 0, area: 'gate' });
  return att;
}

async function load(page: Page, extra: Partial<SepState> = {}) {
  await loadAppWithState(page, {
    ...emptyState(), incomingMaterial: noSeedIM(), staff: [HAND, GATE, SENIOR], attendance: augustAttendance(), ...extra,
  } as SepState);
}

const worker = (page: Page, from: string, to: string, id: number) =>
  g(page, `(function(){ var b = labourForRange('${from}', '${to}').byWorker[${id}] || {}; return { base: b.base, rest: b.rest, restDays: b.restDays, ot: b.ot, otHours: b.otHours, total: b.total }; })()`) as Promise<any>;

test.describe('P49: monthly pay', () => {
  test('BM’s August model: days + holiday + Sundays × gate + Sundays worked, OT uncapped before September', async ({ page }) => {
    await load(page);
    const otH = await g(page, `Object.keys(S.attendance).filter(function(k){ return k < '2026-09-01' && new Date(k + 'T00:00:00').getDay() !== 0; })
      .reduce(function(s, k){ var m = S.attendance[k].marks[1]; return s + (m && m.ot || 0); }, 0)`) as number;
    expect(otH).toBe(102);
    const a = await worker(page, '2026-08-01', '2026-08-31', 1);
    // 21 worked + 1 Sunday worked = 22 days of day pay; 1 holiday + 5 × ½ = 3.5 credited.
    expect(a.base).toBe(11000);
    expect(a.restDays).toBe(3.5);
    expect(a.rest).toBe(1750);
    // The Sunday's 4 h are the day, not overtime: 102 weekday hours at 500 ÷ 8 × 1.1.
    expect(a.otHours).toBe(102);
    expect(a.ot).toBe(7012.5);
    expect(a.total).toBe(19762.5);
  });

  test('a contracted monthly wage: wage ÷ days in the month, Sundays ungated, a Sunday worked adds nothing', async ({ page }) => {
    await load(page);
    const gp = await worker(page, '2026-08-01', '2026-08-31', 2);
    // 22 + 1 holiday + 5 Sundays = 28 × 9000 / 31.
    expect(gp.total).toBeCloseTo(8129.03, 2);
    expect(gp.restDays).toBe(6);
  });

  test('the OT cap binds only from its start date', async ({ page }) => {
    await load(page, {
      attendance: {
        '2026-08-31': { marks: { 3: { st: 'P', hours: 18, ot: 10, area: 'vat-a2' } }, extra: [], note: '' },
        '2026-09-01': { marks: { 3: { st: 'P', hours: 18, ot: 10, area: 'vat-a2' } }, extra: [], note: '' },
      },
    });
    expect((await worker(page, '2026-08-31', '2026-08-31', 3)).ot).toBe(792);   // 576 ÷ 8 × 1.1 × 10
    expect((await worker(page, '2026-09-01', '2026-09-01', 3)).ot).toBe(682);   // capped at 68.20
    // Moved in Settings, the cap follows.
    await g(page, `S.labour.otCapFrom = '2026-08-01'`);
    expect((await worker(page, '2026-08-31', '2026-08-31', 3)).ot).toBe(682);
  });

  test('a closed month on record is read as paid, and a re-import supersedes rather than overwrites', async ({ page }) => {
    await load(page);
    const file = { kind: 'sep-payroll-paid', months: [{ month: '2026-08', status: 'paid', source: 'test slip', rows: [
      { name: 'ARUN DAS', worked: 21, restDays: 4.5, dayPay: 12750, otHours: 102, ot: 7012.5 },
      { name: 'Somebody Else', worked: 10, dayPay: 4000, otHours: 0, ot: 0 },
    ] }] };
    const res = await g(page, `payrollPaidImport(${JSON.stringify(file)})`) as any;
    expect(res).toMatchObject({ added: 1, superseded: 0 });
    // Arun is read from the slip; Gopal, whom the record does not name, is still modelled.
    const a = await worker(page, '2026-08-01', '2026-08-31', 1);
    expect(a.base).toBe(12750);
    expect(a.ot).toBe(7012.5);
    expect(a.rest).toBe(0);
    expect((await worker(page, '2026-08-01', '2026-08-31', 2)).total).toBeCloseTo(8129.03, 2);
    // A hand the roster does not hold still costs what they were paid.
    const lab = await g(page, `(function(){ var l = labourForRange('2026-08-01', '2026-08-31'); return { fixed: l.fixed, paid: l.paidMonths.length }; })()`) as any;
    expect(lab.paid).toBe(1);
    expect(lab.fixed).toBeCloseTo(12750 + 4000 + 8129.03, 1);   // the aggregate rounds day pay and rest apart
    // Half the month in range carries half the record.
    expect((await worker(page, '2026-08-01', '2026-08-16', 1)).base).toBeCloseTo(12750 * 16 / 31, 2);

    expect(await g(page, `payrollPaidImport(${JSON.stringify(file)}).same`)).toBe(1);
    file.months[0].rows[0].dayPay = 13000;
    expect(await g(page, `payrollPaidImport(${JSON.stringify(file)}).superseded`)).toBe(1);
    await g(page, 'saveState()');
    const s = await readStoredState(page);
    expect(s.payrollPaid).toHaveLength(2);
    expect(s.payrollPaid.filter((r: any) => r.voidedAt)).toHaveLength(1);
    expect((await worker(page, '2026-08-01', '2026-08-31', 1)).base).toBe(13000);
  });

  test('the Pay view settles a month on record and lists it', async ({ page }) => {
    await load(page, { payrollPaid: [{ id: 'PRL-1', month: '2026-08', status: 'paid', source: 'test slip', at: 1, rows: [
      { name: 'Arun Das', worked: 21, restDays: 4.5, dayPay: 12750, otHours: 102, ot: 7012.5 },
    ] }] } as Partial<SepState>);
    const due = await g(page, `(function(){ var r = payDue('2026-08-23').rows.find(function(x){ return x.w.id === 1; }); return [r.earned.total, r.due, !!r.asPaid]; })()`) as any[];
    expect(due).toEqual([19762.5, 0, true]);

    await switchTab(page, 'pageStaff');
    await page.locator('[data-action="invAttView"][data-view="pay"]').click();
    const card = page.locator('#payrollPaid');
    await expect(card).toContainText('August 2026');
    await expect(card).toContainText('₹19,762.50');
    await expect(card).toContainText('test slip');
    page.once('dialog', d => d.accept('Wrong month'));
    await card.locator('[data-action="invPayrollVoid"]').click();
    const s = await readStoredState(page);
    expect(s.payrollPaid[0]).toMatchObject({ voidReason: 'Wrong month' });
    // Void, the month goes back to the model.
    expect((await worker(page, '2026-08-01', '2026-08-31', 1)).rest).toBe(1750);
  });
});
