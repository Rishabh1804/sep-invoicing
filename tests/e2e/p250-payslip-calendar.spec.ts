import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, todayIso, type SepState } from './fixtures';

// P250 (owner, 30 Oct 2026: "in the print add the week and monthly calendar for every employee, so that they can see which day
// they were absent and where they worked each day … they don't necessarily have to share the same layout"). A weekly slip carries
// a column a day (the day, where, in and out, the hours); a monthly slip the month on one grid of codes beside the hand's details.
// Made-up names; dates built from today (last month, and a week inside it).

const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
const isoOf = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
function lastMonth(): string { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(1); d.setMonth(d.getMonth() - 1); return isoOf(d); }
function book(): SepState {
  const s: any = emptyState();
  s.incomingMaterial = noSeedIM();
  s.company = Object.assign({}, s.company, { name: 'TEST WORKS' });
  s.staff = [
    { id: 1, name: 'Ramu Kumar', comp: 'monthly', dayRate: 480, area: 'vat-a1', onFloor: true, active: true },
    { id: 2, name: 'Shiva Oraon', comp: 'hourly', hourRate: 50, area: 'barrel', onFloor: true, active: true }];
  s.attendance = {};
  const first = new Date(lastMonth() + 'T00:00:00');
  for (let i = 0; i < 31; i++) {
    const d = new Date(first); d.setDate(d.getDate() + i); const iso = isoOf(d);
    if (iso.slice(0, 7) !== lastMonth().slice(0, 7) || d.getDay() === 0) continue;
    s.attendance[iso] = { marks: {
      1: d.getDate() === 9 ? { st: 'A' } : d.getDate() === 10 ? { st: 'H', area: 'vat-a2', hours: 4 } : { st: 'P', area: 'vat-a1', inMin: 510, outMin: 1020, hours: 8 },
      2: d.getDate() === 9 ? { st: 'A' } : { st: 'P', area: d.getDate() === 10 ? 'pickling-barrel' : 'barrel', inMin: 360, outMin: 1020, hours: 11 } }, extra: [] };
  }
  return s;
}
const day = (n: number) => lastMonth().slice(0, 8) + String(n).padStart(2, '0');

test('a monthly slip shows its month as a grid: each day present, half or absent and where, the key naming the codes', async ({ page }) => {
  await loadAppWithState(page, book());
  await ev(page, `psShow(payDue(psMonthWeek('${lastMonth().slice(0, 7)}')).rows.filter(function(r) { return !r.weekly; }))`);
  const slip = page.locator('#invPrintBody [data-ps-slip="1"]');
  await expect(slip.locator('[data-ps-cal="month"]')).toHaveCount(1);
  await expect(slip.locator('[data-ps-cal="week"]')).toHaveCount(0);
  const cell = (n: number) => slip.locator(`[data-ps-cal="month"] [data-ps-day="${day(n)}"]`);
  await expect(cell(9)).toHaveAttribute('data-ps-st', 'A');
  await expect(cell(9)).toHaveText('9 A');
  await expect(cell(10)).toHaveText('10 H A2');
  await expect(cell(12)).toContainText('A1');
  const sun = await ev(page, `(function() { for (var i = 1; i < 8; i++) { var iso = '${day(1)}'.slice(0, 8) + String(i).padStart(2, '0'); if (new Date(iso + 'T00:00:00').getDay() === 0) return i; } })()`) as number;
  await expect(cell(sun)).toHaveText(sun + ' Sun');
  await expect(slip.locator('[data-ps-key]')).toContainText('A absent');
  await expect(slip.locator('[data-ps-key]')).toContainText('A2 VAT A2');
});

test('a weekly slip shows a column a day: present or absent, where, in and out, the hours', async ({ page }) => {
  await loadAppWithState(page, book());
  await ev(page, `psShow(payDue(attWeekStartOf('${day(9)}')).rows.filter(function(r) { return r.weekly; }))`);
  const slip = page.locator('#invPrintBody [data-ps-slip="2"]');
  const week = slip.locator('[data-ps-cal="week"]');
  await expect(week).toHaveCount(1);
  await expect(slip.locator('[data-ps-cal="month"]')).toHaveCount(0);
  await expect(week.locator('thead th')).toHaveCount(8);
  await expect(week.locator(`[data-ps-day="${day(9)}"]`)).toHaveText('Absent');
  const idx = await week.locator('thead th').evaluateAll((ths, d) => ths.findIndex(t => t.textContent!.endsWith(' ' + d)), 10);
  const row = (label: string) => week.locator('tbody tr', { hasText: label }).locator('td').nth(idx - 1);
  await expect(row('Day')).toHaveText('Present');
  await expect(row('Worked at')).toHaveText('Barrel pickling');
  await expect(row('In – out')).toHaveText('6 AM – 5 PM');
  await expect(row('Hours')).toHaveText('11 h');
});

test('with the calendars, every slip stays its half of the A4 sheet, nothing cut, under print media', async ({ page }) => {
  await loadAppWithState(page, book());
  await ev(page, `psShow(payDue(psMonthWeek('${lastMonth().slice(0, 7)}')).rows)`);
  await page.emulateMedia({ media: 'print' });
  await page.setViewportSize({ width: 794, height: 1123 });
  const r = await page.evaluate(() => Array.from(document.querySelectorAll('#invPrintBody [data-ps-slip]')).map(e => [(e as HTMLElement).scrollHeight, (e as HTMLElement).clientHeight]));
  expect(r.length).toBeGreaterThan(0);
  r.forEach(([sh, h]) => expect(sh).toBeLessThanOrEqual(h));
  const h: number[] = await page.evaluate(() => Array.from(document.querySelectorAll('#invPrintBody [data-ps-sheet]')).map(e => (e as HTMLElement).getBoundingClientRect().height));
  h.forEach(x => expect(x).toBeLessThanOrEqual(1123));
});
