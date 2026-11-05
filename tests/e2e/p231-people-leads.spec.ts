import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, openAttendance, openFoldAt, openVerdict, setFilter, switchTab, todayIso, type SepState } from './fixtures';

// P231 (docs/UI_PASS_3.md §12, §26c; the owner, 15 Oct 2026: "Every sub-tab of our people tab has the same issue it does not lead
// the user by design", "Roster section … primitive, despite having plenty of data to show info in a better way"): each People view
// opens on what to do next and a picture of it. The next steps under the toolbar where the work has an order (Day, Month, Pay), each a
// door; the pictures (the week's marks on a grid, the month's agreement as one bar, the payouts week by week, each area's heads as
// small multiples); the Roster as cards with a Filter. Made-up names and figures only.

const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const shift = (from: string, n: number) => { const d = new Date(from + 'T00:00:00'); d.setDate(d.getDate() + n); return isoOf(d); };
const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
const T = todayIso();
// The last working day before today, so a past week's marks stand on a day the plant works.
const WD = (() => { let d = shift(T, -1); while (new Date(d + 'T00:00:00').getDay() === 0) d = shift(d, -1); return d; })();
const WS = (() => { const d = new Date(T + 'T00:00:00'); return shift(T, -d.getDay()); })();

const STAFF = [
  { id: 1, name: 'Alfa Oraon', comp: 'monthly', dayRate: 520, area: 'vat-a1', onFloor: true, active: true, skills: { 'vat-a1': 5, 'vat-a2': 3, barrel: 2, 'pickling-vat': 1 } },
  { id: 2, name: 'Bravo Munda', comp: 'hourly', hourRate: 50, area: 'vat-a2', onFloor: true, active: true },
  { id: 3, name: 'Charlie Soren', comp: 'hourly', hourRate: 50, area: 'vat-a1', onFloor: true, active: true },
  { id: 4, name: 'Delta Hembrom', comp: 'daily', dayRate: 450, area: 'barrel', onFloor: true, active: false }];
function book(extra?: any): SepState {
  return { ...emptyState(), incomingMaterial: noSeedIM(), staff: STAFF, attendance: {}, ...(extra || {}) } as unknown as SepState;
}
const mark = (st: string, area = 'vat-a1', hours = 8) => ({ st, area, hours: st === 'A' ? 0 : hours, ot: 0, inMin: st === 'A' ? undefined : 510, outMin: st === 'A' ? undefined : 1020 });
const steps = (page: Page, key: string) => page.locator(`#pageStaff [data-next-steps="${key}"]`);
const step = (page: Page, key: string, s: string) => steps(page, key).locator(`[data-step="${s}"]`);
async function people(page: Page, view: string) {
  await switchTab(page, 'pageStaff');
  if (view === 'day' || view === 'week' || view === 'register') await openAttendance(page, view as any);
  else await page.locator(`#pageStaff .inv-viewtab[data-view="${view}"]`).click();
}

test.describe('P231: the next steps', () => {
  test('Day: the in-time roll, the marks, the out-time roll and the EXTRA, each in its state; the step to take next ringed', async ({ page }) => {
    await loadAppWithState(page, book({ attendance: { [T]: { marks: { 1: mark('P'), 2: mark('P', 'vat-a2') }, extra: [], note: '' } } }));
    await people(page, 'day');
    const row = steps(page, 'day');
    await expect(row.locator('[data-step]')).toHaveCount(4);
    // Marked by hand: the in-time roll is in, said so; two of the day's three hands are marked; nothing is booked or needed yet.
    await expect(step(page, 'day', 'roll-in')).toHaveAttribute('data-state', 'in');
    await expect(step(page, 'day', 'roll-in')).toContainText('by hand');
    await expect(step(page, 'day', 'marks')).toHaveAttribute('data-state', 'part');
    await expect(step(page, 'day', 'marks')).toContainText('2 of 3');
    await expect(step(page, 'day', 'marks')).toHaveAttribute('data-next', '');
    await expect(row.locator('[data-next]')).toHaveCount(1);
    await expect(step(page, 'day', 'extra')).toContainText('none needed');
    // A done step has no door; the next one does, and it brings the first hand not marked into view.
    await expect(step(page, 'day', 'roll-in').locator('button')).toHaveCount(0);
    await step(page, 'day', 'marks').locator('button').click();
    await expect(page.locator('[data-att-row="3"]')).toBeInViewport();
    // The out-time roll's door is the paste box.
    await step(page, 'day', 'roll-out').locator('button').click();
    await expect(page.locator('#relayPasteText')).toBeVisible();
  });

  test('Day: a version a sync held is a step of its own, which opens the hand’s day; a line’s night adds its roll', async ({ page }) => {
    const day: any = { marks: { 1: mark('P'), 2: mark('P', 'vat-a2'), 3: mark('P') }, extra: [], note: '' };
    const night = { id: 'ls1', line: 'vat-a1', from: shift(T, -7), start: '18:00', end: '06:00', stop: '05:00', breakMin: 45, crew: { 'vat-a1': 2 }, spare: 0, note: '' };
    await loadAppWithState(page, book({ attendance: { [T]: day }, lineShifts: [night],
      mergeHeld: [{ id: 'MH-1', at: 6, coll: 'attendance', rid: T, field: 'marks.3', label: 'today', why: 'both', status: 'open', from: 'GitHub',
        kept: { side: 'm', v: day.marks[3] }, other: { side: 't', v: mark('A') } }] }));
    await people(page, 'day');
    await expect(step(page, 'day', 'held')).toHaveAttribute('data-state', 'late');
    await expect(step(page, 'day', 'held')).toContainText('1 mark held');
    await expect(step(page, 'day', 'night-vat-a1')).toContainText('Night roll');
    await expect(step(page, 'day', 'night-vat-a1')).toContainText('due 6:30 AM tomorrow');
    await step(page, 'day', 'held').locator('button').click();
    await expect(page.locator('[data-att-held="MH-1"]')).toBeVisible();
  });

  test('Pay: the hours, the cash paid out, the payout to Saturday 5 PM, the payments and the slips, each a door on the page', async ({ page }) => {
    const att: any = {};
    att[WD] = { marks: { 2: mark('P', 'vat-a2', 9), 3: mark('P', 'vat-a1', 9) }, extra: [], note: '' };
    await loadAppWithState(page, book({ attendance: att,
      cashOut: [{ id: 'CO-1', date: WD, what: 'HCL', amount: 250, cat: 'consumables', week: attWs(WD), msgId: 'CP-1', at: 1, by: '' },
        { id: 'CO-2', date: WD, what: 'JAR', amount: 150, cat: 'consumables', week: attWs(WD), msgId: 'CP-1', at: 1, by: '' }] }));
    await people(page, 'pay');
    await ev(page, `_attWeekStart = '${attWs(WD)}'; renderAttendance()`);
    await expect(steps(page, 'pay').locator('[data-step]')).toHaveCount(5);
    await expect(step(page, 'pay', 'hours')).toHaveAttribute('data-state', 'in');
    await expect(step(page, 'pay', 'cash')).toContainText('2 lines');
    await expect(step(page, 'pay', 'payout')).toContainText('to Sat 5 PM');
    await expect(step(page, 'pay', 'pay')).toContainText('2 hands due');
    await step(page, 'pay', 'cash').locator('button').click();
    await expect(page.locator('#pageStaff [data-card="cashout"]')).toBeInViewport();
    await step(page, 'pay', 'pay').locator('button').click();
    await expect(page.locator('#payFormFold')).toHaveAttribute('open', '');
    await step(page, 'pay', 'slips').locator('button').click();
    await expect(page.locator('[data-ps-dialog]')).toBeVisible();
  });

  test('Month: start or import, fill, settle, mark checked; the first step starts the page as the toolbar’s button does', async ({ page }) => {
    await loadAppWithState(page, book({ attendance: { [WD]: { marks: { 1: mark('P') }, extra: [], note: '' } } }));
    await ev(page, `_aregMonth = '${WD.slice(0, 7)}'`);
    await people(page, 'register');
    await expect(step(page, 'register', 'start')).toHaveAttribute('data-next', '');
    await expect(step(page, 'register', 'start')).toContainText('not started');
    await step(page, 'register', 'start').locator('button').click();
    expect(await ev(page, `!!aregMonthOf('${WD.slice(0, 7)}')`)).toBe(true);
    await expect(step(page, 'register', 'start')).toHaveAttribute('data-state', 'in');
    await expect(step(page, 'register', 'start')).toContainText('by hand');
    // The page is blank and the day holds a mark: a difference to settle, only on the day, which the month's bar draws.
    await expect(step(page, 'register', 'settle')).toContainText('1 to settle');
    await expect(step(page, 'register', 'check')).toContainText('not yet');
    await openVerdict(page);
    await expect(page.locator('#aregSummary [data-areg-bar] .inv-chart-key')).toContainText(['Only on the day 100%']);
  });

  test('a step’s door is its own: no step repeats an action a toolbar or a tab already carries', async ({ page }) => {
    await loadAppWithState(page, book({ attendance: { [T]: { marks: { 1: mark('P') }, extra: [], note: '' } } }));
    for (const v of ['day', 'pay', 'register']) {
      await people(page, v);
      const acts = await page.locator('#pageStaff [data-next-steps] [data-action]').evaluateAll(els => els.map(e => e.getAttribute('data-action')));
      expect(acts.every(a => a === 'invAttStepGo' || a === 'invPayStepGo'), v + ': ' + acts.join(', ')).toBe(true);
    }
  });
});

function attWs(iso: string) { const d = new Date(iso + 'T00:00:00'); return shift(iso, -d.getDay()); }

test.describe('P231: the pictures', () => {
  test('Week: a hand a row, a day a column, each cell its mark’s tone; a night its own tone; the table folded under it', async ({ page }) => {
    const night = { id: 'ls1', line: 'vat-a1', from: shift(WS, -7), start: '18:00', end: '06:00', stop: '05:00', breakMin: 45, crew: { 'vat-a1': 2 }, spare: 0, note: '' };
    const att: any = {};
    att[WD] = { marks: { 1: mark('P'), 2: mark('H', 'vat-a2', 4), 3: { st: 'P', area: 'vat-a1', hours: 12, ot: 0, inMin: 1080, outMin: 360 } }, extra: [], note: '' };
    if (WD === shift(T, -1) || attWs(WD) === WS) {
      // Another day of the same week, absent.
      const d2 = shift(WD, -1);
      if (attWs(d2) === attWs(WD) && new Date(d2 + 'T00:00:00').getDay() !== 0) att[d2] = { marks: { 1: mark('A') }, extra: [], note: '' };
    }
    await loadAppWithState(page, book({ attendance: att, lineShifts: [night] }));
    await people(page, 'week');
    await ev(page, `_attWeekStart = '${attWs(WD)}'; renderAttendance()`);
    const pic = page.locator('#attWeekMarks');
    await expect(pic).toBeVisible();
    await expect(pic.locator('.inv-chart-datum[data-read^="Alfa Oraon"] .inv-chart-cell.inv-chart-ok')).not.toHaveCount(0);
    await expect(pic.locator('.inv-chart-datum[data-read^="Bravo Munda"] .inv-chart-cell.inv-chart-warning')).toHaveCount(1);
    await expect(pic.locator('.inv-chart-datum[data-read^="Charlie Soren"] .inv-chart-cell.inv-chart-info')).toHaveCount(1);
    await expect(pic.locator('.inv-chart-datum[data-read*="Not marked"] .inv-chart-hatch').first()).toBeAttached();
    await expect(pic.locator('.inv-chart-key')).toContainText(['Present', 'Half day', 'Absent', 'The night', 'Not marked']);
    // The table behind the chart says each cell in words.
    await pic.locator('[data-action="invChartTable"]').click();
    await expect(pic.locator('.inv-chart-table')).toContainText('Present, the night');
    // The table where a mark is changed is folded under the picture, shut.
    await expect(page.locator('#pageStaff details[data-fold="att-week-grid"]')).not.toHaveAttribute('open', '');
  });

  test('Areas: each unit’s heads a day against its number as small multiples, amber where it stood short', async ({ page }) => {
    const att: any = {};
    att[WD] = { marks: { 1: mark('P'), 3: mark('P') }, extra: [], note: '' };
    await loadAppWithState(page, book({ attendance: att, areaTargets: { 'vat-a1': 4 } }));
    await people(page, 'areas');
    await ev(page, `_attWeekStart = '${attWs(WD)}'; renderAttendance()`);
    await openVerdict(page);
    const tile = page.locator('#areaVerdict [data-area-multiple="vat-a1"]');
    await expect(tile).toHaveClass(/inv-tile-warning/);
    await expect(tile.locator('.inv-tile-value')).toContainText('1/1 days short');
    await expect(tile.locator('.inv-minibar[data-tone="warning"]')).toHaveCount(1);
  });

  test('Pay: the payouts week by week are the verdict’s body, the cash paid out its own part of the bar', async ({ page }) => {
    const att: any = {};
    att[WD] = { marks: { 2: mark('P', 'vat-a2', 9) }, extra: [], note: '' };
    await loadAppWithState(page, book({ attendance: att,
      cashOut: [{ id: 'CO-1', date: WD, what: 'HCL', amount: 250, cat: 'consumables', week: attWs(WD), msgId: 'CP-1', at: 1, by: '' }] }));
    await people(page, 'pay');
    await ev(page, `_attWeekStart = '${attWs(WD)}'; renderAttendance()`);
    await openVerdict(page);
    const pic = page.locator('#payForecast [data-pay-weeks]');
    await expect(pic.locator('.inv-chart-key')).toContainText(['Wages, EXTRA and snacks', 'Cash paid out']);
    await expect(page.locator('#payHistory')).toHaveCount(1);
    await expect(page.locator('#payHistory .inv-chart-box')).toHaveCount(0);
  });
});

test.describe('P231: the Roster as cards', () => {
  test('a card a hand: initials, the area and rate, the tier and tenure, three bars, the top three skills; the hands who left folded', async ({ page }) => {
    await loadAppWithState(page, book());
    await people(page, 'roster');
    const card = page.locator('#attRoster [data-roster-card="1"]');
    await expect(card.locator('.inv-avatar')).toHaveText('AO');
    await expect(card.locator('[data-roster-meta]')).toContainText('VAT A1');
    await expect(card.locator('[data-roster-meta]')).toContainText('₹520.00/day');
    await expect(card.locator('[data-roster-tier]')).toContainText('Monthly');
    await expect(card.locator('[data-ppl-glance]')).toHaveCount(3);
    await expect(card.locator('[data-ppl-glance-skill]')).toHaveText(['VAT A1 5/5', 'VAT A2 3/5', 'Barrel 2/5']);
    // The hands who left: under Left, folded shut.
    await expect(page.locator('#attRoster [data-roster-deck] [data-roster-card="4"]')).toHaveCount(0);
    await expect(page.locator('#attRoster details[data-fold="roster-left"]')).not.toHaveAttribute('open', '');
    await openFoldAt(page, 'roster-left');
    await expect(page.locator('#attRoster [data-roster-card="4"] .inv-badge')).toHaveText('Inactive');
    // The card opens the hand's sheet on the phone.
    await card.locator('[data-action="invAttEditWorker"]').click();
    await expect(page.locator('.inv-dialog')).toBeVisible();
  });

  test('the Filter: the area and the tier, said as tokens under the row and cleared there', async ({ page }) => {
    await loadAppWithState(page, book());
    await people(page, 'roster');
    await expect(page.locator('#attRoster [data-roster-deck] [data-roster-card]')).toHaveCount(3);
    await setFilter(page, '#attRosterArea', 'vat-a1');
    await expect(page.locator('#attRoster [data-roster-deck] [data-roster-card]')).toHaveCount(2);
    await setFilter(page, '#attRosterTier', 'hourly');
    await expect(page.locator('#attRoster [data-roster-deck] [data-roster-card]')).toHaveCount(1);
    await expect(page.locator('#attRoster [data-roster-card="3"]')).toBeVisible();
    await page.locator('#attContent .inv-token', { hasText: 'Area' }).click();
    await expect(page.locator('#attRoster [data-roster-deck] [data-roster-card]')).toHaveCount(2);
  });

  test('a hand to watch is a card in danger, its badge the motivation index, first in the deck', async ({ page }) => {
    const s: any = book();
    const att: any = {};
    let n = 0;
    for (let i = 1; n < 20; i++) {
      const iso = shift(T, -i);
      if (new Date(iso + 'T00:00:00').getDay() === 0) continue;
      att[iso] = { marks: { 3: mark('P'), 2: mark(n % 3 ? 'A' : 'P', 'vat-a2') }, extra: [], note: '' };
      n++;
    }
    s.attendance = att;
    s.peopleCheckins = [{ id: 'C1', staffId: 2, on: shift(T, -3), score: 1, note: 'quiet', at: 1 }];
    await loadAppWithState(page, s);
    const watch = await ev(page, `todoApp(['pplWatch']).map(function (t) { return t.staffId; })`) as number[];
    test.skip(!watch.includes(2), 'the made-up book does not put the hand under 50');
    await people(page, 'roster');
    const card = page.locator('#attRoster [data-roster-card="2"]');
    await expect(card).toHaveAttribute('data-tone', 'danger');
    await expect(card.locator('.inv-badge')).toContainText('Motivation');
    await expect(page.locator('#attRoster [data-roster-deck] [data-roster-card]').first()).toHaveAttribute('data-roster-card', '2');
  });
});
