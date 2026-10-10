import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, openSettingsAt, readStoredState, switchTab, todayIso, type SepState } from './fixtures';

// P207: the week's payout as the Saturday's cash pays it (owner, 10 Oct 2026, on the week of 4 Oct: "The 640 is snacks paid for OT
// and night shifts", "20 per person regular OT, and 60 per person for night OT", night "is when it passes 12 a.m., not before it").
// Snacks are a line of the payout, a person once a day at the higher rate, read off the blocks' crews and the outs; a hand named on
// a block their own times do not reach is flagged (one such had 13 hours paid nobody); and an out-time roll's numbered line written
// without its bracket ("14 NAME") is a name, not a note. Made-up names; dates from today.

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const shift = (from: string, n: number) => { const d = new Date(from + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); };
// Last pay week, Sunday to Saturday: whole, and in the To-do's reach.
const WS = (() => { const t = new Date(todayIso() + 'T00:00:00'); t.setDate(t.getDate() - t.getDay() - 7); return iso(t); })();
const D1 = shift(WS, 1), D2 = shift(WS, 2), D3 = shift(WS, 3);
const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);

const STAFF = [
  { id: 1, name: 'Alfa Oraon', comp: 'hourly', hourRate: 50, area: 'vat-a1', onFloor: true, active: true },
  { id: 2, name: 'Bravo Munda', comp: 'hourly', hourRate: 50, area: 'vat-a2', onFloor: true, active: true },
  { id: 3, name: 'Charlie Soren', comp: 'hourly', hourRate: 50, area: 'barrel', onFloor: true, active: true },
  { id: 4, name: 'Delta Hembrom', comp: 'monthly', dayRate: 500, area: 'vat-a1', onFloor: true, active: true },
  { id: 5, name: 'Echo Tudu', comp: 'monthly', dayRate: 400, area: 'gate', onFloor: false, active: true }];
const mark = (area: string, inMin: number, outMin: number) => ({ st: 'P', area, inMin, outMin, hours: Math.floor((outMin - inMin) / 60), ot: 0, outKnown: true, src: 'relay' });
const block = (area: string, from: string, to: string, hours: number, crew: number[]) => ({ kind: 'block', area, areas: [area], from, to, hours, crew });
function book(): SepState {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM(), staff: STAFF };
  s.attendance = {
    // The evening: two on its block (one a monthly hand), one out at 6:30 PM with no block, one out at 5:30 PM (a late leave, not
    // overtime), the gate's twelve hours (its shift). Three at ₹20.
    [D1]: { marks: { 1: mark('vat-a1', 510, 1200), 4: mark('vat-a1', 510, 1200), 2: mark('vat-a2', 510, 1110), 3: mark('barrel', 510, 1050), 5: mark('gate', 420, 1140) },
      extra: [block('vat-a1', '17:00', '20:00', 3, [1, 4])], note: '' },
    // A night: two on the night hold past midnight (one of them out at 5 PM on their own mark), the evening's three, one to 12 AM
    // only (regular: night is past midnight, not before it). Two at ₹60 and two at ₹20.
    [D2]: { marks: { 1: mark('vat-a1', 510, 1800), 2: mark('vat-a2', 510, 1020), 3: mark('barrel', 510, 1200), 4: mark('vat-a1', 510, 1440) },
      extra: [block('vat-a1', '17:00', '20:00', 3, [1, 2, 3]), block('vat-a2', '20:00', '06:00', 20, [1, 2]), block('barrel', '17:00', '00:00', 7, [4])], note: '' },
    // The 6 AM block: no snacks.
    [D3]: { marks: { 1: mark('vat-a1', 360, 1020) }, extra: [block('vat-a1', '06:00', '08:30', 3, [1])], note: '' },
  };
  return s;
}

test.describe('P207: the week’s payout as the Saturday pays it', () => {
  test('snacks: ₹20 a person on regular overtime, ₹60 past midnight, once a day at the higher; none for the 6 AM block or the gate', async ({ page }) => {
    await loadAppWithState(page, book());
    const sn = await ev(page, `paySnacks('${WS}', '${shift(WS, 6)}')`) as any;
    expect(sn.days[D1]).toEqual({ regular: 3, night: 0, amount: 60 });
    expect(sn.days[D2]).toEqual({ regular: 2, night: 2, amount: 160 });
    expect(sn.days[D3]).toBeUndefined();
    expect(sn.amount).toBe(220);
    // The payout carries them, and Pay's card says so.
    const pw = await ev(page, `(function(w){ return { total: w.total, workers: w.workers, extra: w.extra, snacks: w.snacks.amount }; })(payWeek('${WS}'))`) as any;
    expect(pw.snacks).toBe(220);
    expect(pw.total).toBeCloseTo(pw.workers + pw.extra + 220, 2);
    await switchTab(page, 'pageStaff');
    await ev(page, `_attView = 'pay'; _attWeekStart = '${WS}'; _attDate = '${D1}'; renderAttendance()`);
    const card = page.locator('#payForecast');
    if (!(await card.evaluate(el => (el as HTMLDetailsElement).open))) await card.locator(':scope > summary').click();
    await expect(card.locator('[data-pay-snacks] .inv-row-end')).toHaveText('₹220.00');
    await expect(card.locator('[data-pay-snacks] .inv-row-meta')).toHaveText('5 on overtime, 2 on a night');
  });

  test('the two rates are Settings → Labour → Overtime’s, and the payout follows them', async ({ page }) => {
    await loadAppWithState(page, book());
    await openSettingsAt(page, 'overtime');
    await page.locator('#setSnackNight').fill('50');
    await page.locator('#setSnackNight').dispatchEvent('input');
    await page.locator('details[data-sec="overtime"] [data-action="invSaveSettingsSec"]').click();
    expect((await readStoredState(page)).labour.snackNight).toBe(50);
    expect(await ev(page, `paySnacks('${WS}', '${shift(WS, 6)}').amount`)).toBe(200);
  });

  test('a hand named on a block their own times do not reach is flagged on Pay and in the To-do, with the day to open', async ({ page }) => {
    await loadAppWithState(page, book());
    const gaps = await ev(page, `payCrewGaps('${WS}', '${shift(WS, 6)}')`) as any[];
    expect(gaps).toEqual([{ date: D2, staffId: 2, name: 'Bravo Munda', from: '20:00', to: '06:00', why: 'out at 5 PM' }]);
    const tasks = await ev(page, `TODO_RULE_FNS.payCrewGap()`) as any[];
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Bravo Munda is on an OT block their own times do not reach');
    await switchTab(page, 'pageStaff');
    await ev(page, `_attView = 'pay'; _attWeekStart = '${WS}'; _attDate = '${D1}'; renderAttendance()`);
    const card = page.locator('#payForecast');
    if (!(await card.evaluate(el => (el as HTMLDetailsElement).open))) await card.locator(':scope > summary').click();
    const fold = card.locator('[data-pay-gaps]');
    await fold.locator('summary').click();
    await expect(fold.locator('[data-pay-gap="2"]')).toContainText('on the 8 PM – 6 AM block, out at 5 PM');
    await fold.locator('[data-pay-gap="2"] [data-action="invPayGapDay"]').click();
    expect(await ev(page, `[_attView, _attDate]`)).toEqual(['day', D2]);
  });

  test('an out-time roll’s numbered line with no bracket is the hand it names', async ({ page }) => {
    const s: any = book();
    delete s.attendance[D1]; delete s.attendance[D2]; delete s.attendance[D3];
    await loadAppWithState(page, s);
    const dd = D1.slice(8, 10) + '/' + D1.slice(5, 7) + '/' + D1.slice(2, 4);
    const roll = `${dd}/ in time\n-----8:30 AM-----\n---VAT A 1---\n1) ALFA\n2) DELTA\n---VAT A 2---\n3) BRAVO\n` +
      `${dd}/ out time\n-----5:00 PM----\n01) ALFA\n02) DELTA\n-----8:00 PM---\n14 BRAVO\n`;
    await ev(page, `relayOpen(${JSON.stringify(roll)}); relayRead(); relaySave();`);
    const day = (await readStoredState(page)).attendance[D1];
    expect(day.marks['2'].outMin).toBe(1200);
    expect(day.marks['2'].hours).toBe(11);
    expect(day.marks['1'].outMin).toBe(1020);
  });
});
