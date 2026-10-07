import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab, todayIso, type SepState } from './fixtures';

// P174 (owner, 7 Oct 2026: "Start with 1 and 2"): pay slips printed from Staff → Pay. A slip is a row of Pay's own payDue:
// earned, each payment and advance, the balance brought forward, what is due; it foots, and it says the same as Pay.
// Made-up names and wages; dates are built from today (the pay week before this one).

const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
const isoOf = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const addDays = (iso: string, n: number) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return isoOf(d); };
/* The Sunday the pay week before this one opens on. */
function lastWeek(): string {
  const d = new Date(todayIso() + 'T00:00:00');
  d.setDate(d.getDate() - d.getDay() - 7);
  return isoOf(d);
}
function book(): SepState {
  const s: any = emptyState();
  s.incomingMaterial = noSeedIM();
  s.company = Object.assign({}, s.company, { name: 'TEST WORKS' });
  s.staff = [
    { id: 1, name: 'Ramu Kumar', comp: 'monthly', dayRate: 480, area: 'vat-a1', onFloor: true, active: true, card: 'SEP-0001', profile: { designation: 'Plater' } },
    { id: 2, name: 'Shiva Oraon', comp: 'hourly', hourRate: 50, area: 'barrel', onFloor: true, active: true, card: 'SEP-0002' }];
  const ws = lastWeek();
  s.attendance = {};
  for (let i = 1; i <= 6; i++) {
    const iso = addDays(ws, i);
    s.attendance[iso] = { marks: {
      1: i === 3 ? { st: 'A' } : { st: 'P', area: 'vat-a1', hours: i === 1 ? 10 : 8, ot: i === 1 ? 2 : 0 },
      2: { st: 'P', area: 'barrel', hours: 9 } }, extra: [] };
  }
  s.staffPayments = [
    { id: 'PAY-1', staffId: 2, date: addDays(ws, 6), amount: 1000, kind: 'payment', note: '', at: 1 },
    { id: 'PAY-2', staffId: 1, date: ws, amount: 500, kind: 'advance', note: 'festival', at: 2 }];
  return s;
}

test('a slip is Pay\'s own row: earned less what was paid, plus what carries, is what is due, and it foots', async ({ page }) => {
  await loadAppWithState(page, book());
  const ws = lastWeek();
  const r: any = await ev(page, `(function() {
    _attWeekStart = '${ws}';
    var rows = payDue('${ws}').rows;
    return rows.map(function(x) { return { id: x.w.id, weekly: x.weekly, earned: x.earned.total, paid: x.paid, carried: x.carried, due: x.due, lines: psLines(x), ref: psRef(x) }; });
  })()`);
  const shiva = r.find((x: any) => x.id === 2), ramu = r.find((x: any) => x.id === 1);
  expect(shiva.weekly).toBe(true);
  expect(shiva.earned).toBe(6 * 9 * 50);
  expect(shiva.lines).toEqual([{ what: 'Hours worked', qty: 54, unit: 'h', rate: 50, amt: 2700 }]);
  expect(shiva.due).toBe(1700);
  expect(shiva.ref).toMatch(/^PS\/\d{4}-W\d\d\/SEP-0002$/);
  expect(ramu.weekly).toBe(false);
  expect(ramu.lines[0].what).toBe('Days worked');
  expect(ramu.lines.some((l: any) => l.what === 'Overtime')).toBe(true);

  await switchTab(page, 'pageStaff');
  await ev(page, `_attView = 'pay'; _attWeekStart = '${ws}'; renderAttendance()`);
  await page.locator('[data-action="invPsOpen"]').click();
  const dlg = page.locator('[data-ps-dialog]');
  await expect(dlg.locator('[data-ps-pick]')).toHaveCount(2);
  await dlg.locator('[data-action="invPsPrint"]').click();
  await expect(page.locator('#invPrintBody [data-ps-sheet]')).toHaveCount(1);
  const slips = page.locator('#invPrintBody [data-ps-slip]');
  await expect(slips).toHaveCount(2);
  for (const x of [shiva, ramu]) {
    const slip = page.locator(`#invPrintBody [data-ps-slip="${x.id}"]`);
    const num = async (sel: string) => Number((await slip.locator(sel).textContent())!.replace(/[^\d.]/g, ''));
    expect(await num('[data-ps-gross]')).toBe(x.earned);
    expect(await num('[data-ps-due]')).toBe(Math.abs(x.due));
    expect(Math.round((x.earned - x.paid + x.carried) * 100) / 100).toBe(x.due);
  }
  const ramuSlip = page.locator('#invPrintBody [data-ps-slip="1"]');
  await expect(ramuSlip).toContainText('Advance on');
  await expect(ramuSlip).toContainText('festival');
  // The monthly hand's slip is the month of the week's Sunday: a week running into the next month counts only its own days.
  let pres = 0, abs = 0;
  for (let i = 1; i <= 6; i++) { const iso = addDays(ws, i); if (iso.slice(0, 7) !== ws.slice(0, 7)) continue; if (i === 3) abs++; else pres++; }
  await expect(ramuSlip.locator('[data-ps-att]')).toHaveText('Present ' + pres + ' · Half day 0 · Absent ' + abs);
  await expect(ramuSlip).toContainText('Plater');
  await expect(page.locator('#invPrintBody [data-ps-slip="2"]')).toContainText('EXTRA hours are paid from the floor');
});

test('ticked workers only; two to an A4 page, measured under print media', async ({ page }) => {
  const s: any = book();
  for (let i = 3; i <= 5; i++) s.staff.push({ id: i, name: 'Hand ' + i, comp: 'hourly', hourRate: 45, area: 'barrel', onFloor: true, active: true });
  const ws = lastWeek();
  Object.keys(s.attendance).forEach(k => { for (let i = 3; i <= 5; i++) s.attendance[k].marks[i] = { st: 'P', area: 'barrel', hours: 8 }; });
  await loadAppWithState(page, s);
  await switchTab(page, 'pageStaff');
  await ev(page, `_attView = 'pay'; _attWeekStart = '${ws}'; renderAttendance()`);
  await page.locator('[data-action="invPsOpen"]').click();
  await page.locator('[data-ps-pick="5"]').uncheck();
  await page.locator('[data-action="invPsPrint"]').click();
  await expect(page.locator('#invPrintBody [data-ps-slip]')).toHaveCount(4);
  await expect(page.locator('#invPrintBody [data-ps-slip="5"]')).toHaveCount(0);
  await expect(page.locator('#invPrintBody [data-ps-sheet]')).toHaveCount(2);
  await page.emulateMedia({ media: 'print' });
  await page.setViewportSize({ width: 794, height: 1123 });
  const h: number[] = await page.evaluate(() => Array.from(document.querySelectorAll('#invPrintBody [data-ps-sheet]')).map(e => (e as HTMLElement).getBoundingClientRect().height));
  // One A4 page each: 297mm at 96 dpi is 1122.5px.
  h.forEach(x => expect(x).toBeLessThanOrEqual(1123));
});
