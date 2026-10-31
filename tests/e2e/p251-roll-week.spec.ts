import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, type SepState } from './fixtures';

// P251: what the week of 25–31 Oct 2026 found when the owner's corrected book was set against the rolls and the Saturday cash
// (owner, 31 Oct 2026). A night-hold heading is a heading, though the roster has a hand whose first name is NIGHT; a hand on the
// night hold is out at its end; "NAME NIGHT" on an in-time roll is on the night, not the 8:30 shift; a roll's year slipped on the
// phone is read in the year it was sent; "12 PM OUT" on the 8:30 shift is noon; and the payout's cut-off is Saturday at 5 PM.
// Made-up names and rates.

const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const shift = (from: string, n: number) => { const d = new Date(from + 'T00:00:00'); d.setDate(d.getDate() + n); return isoOf(d); };
// A weekday in the last week that is no Saturday or Sunday.
const DAY = (() => { let d = shift(todayIso(), -3); while ([0, 6].includes(new Date(d + 'T00:00:00').getDay())) d = shift(d, -1); return d; })();
const dmy = (d: string, yy?: string) => { const [y, m, dd] = d.split('-'); return dd + '/' + m + '/' + (yy || y.slice(2)); };
const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);

const STAFF = [
  { id: 1, name: 'Alfa Oraon', comp: 'monthly', dayRate: 520, area: 'vat-a1', onFloor: true, active: true },
  { id: 2, name: 'Bravo Munda', comp: 'hourly', hourRate: 50, area: 'vat-a2', onFloor: true, active: true },
  { id: 3, name: 'Charlie Soren', comp: 'hourly', hourRate: 50, area: 'pickling-vat', onFloor: true, active: true },
  { id: 4, name: 'Delta Hembrom', comp: 'monthly', dayRate: 500, area: 'office', onFloor: false, active: true },
  { id: 5, name: 'Echo Tudu', comp: 'hourly', hourRate: 50, area: 'vat-a1', onFloor: true, active: true },
  // The roster's own night guard: "NIGHT" alone is his first name, and nobody else's.
  { id: 6, name: 'Night Guard', comp: 'monthly', dayRate: 400, area: 'gate', onFloor: false, active: true }];
function book(extra?: any): SepState {
  return { ...emptyState(), incomingMaterial: noSeedIM(), staff: STAFF, attendance: {}, ...(extra || {}) } as unknown as SepState;
}
async function pasteAndSave(page: Page, text: string) {
  await switchTab(page, 'pageStaff');
  await page.locator('[data-action="invAttView"][data-view="paste"]').first().click();
  await page.locator('#relayPasteText').fill(text);
  await page.locator('[data-action="invRelayRead"]').click();
  await page.locator('[data-action="invRelaySave"]').click();
  await expect(page.locator('[data-action="invRelaySave"]')).toHaveCount(0);
}
const mark = async (page: Page, d: string, id: number) => (await readStoredState(page) as any).attendance[d].marks[id];

test.describe('P251: the week the rolls were set against the payout', () => {
  test('a night-hold heading is a heading, not the hand whose first name is NIGHT; its crew is out at its end', async ({ page }) => {
    await loadAppWithState(page, book());
    await pasteAndSave(page, `${dmy(DAY)}/ IN TIME
------6:00 AM------
----VAT A 2----
1) BRAVO
2) CHARLIE
EXTRA 3 HOURS
------8:30 AM------
----VAT A 1----
01) ALFA
02) ECHO
----VAT A 2----
03) BRAVO
----PICKLING 1&2----
04) CHARLIE`);
    await pasteAndSave(page, `${dmy(DAY)}/ OUT TIME
-------5:00 PM------
01) ALFA
02) ECHO
-------8:00 PM----
03) BRAVO
04) CHARLIE
--NIGHT HOLD-8 PM TO 6 AM
------VAT A 2-------
1) BRAVO
EXTRA 10 HOUR
--PICKLING ----
2) CHARLIE`);
    const b = await mark(page, DAY, 2), c = await mark(page, DAY, 3);
    // In at 6 AM, out at 6 AM the next day: 24 hours (it had stopped at 8 PM, 14).
    expect([b.inMin, b.outMin, b.hours]).toEqual([360, 1800, 24]);
    expect([c.inMin, c.outMin, c.hours]).toEqual([360, 1800, 24]);
    const st: any = await readStoredState(page);
    // The heading never marked the night guard present, and the night's EXTRA is the night's block, not 5 PM to 8 PM.
    expect(st.attendance[DAY].marks[6]).toBeUndefined();
    const night = st.attendance[DAY].extra.find((x: any) => x.hours === 10);
    expect([night.from, night.to]).toEqual(['20:00', '06:00']);
  });

  test('after "5:00 PM ALL", a night hold 6 PM to 6 AM: its crew out at 6 AM; "NAME NIGHT" on the in-time roll in at 6 PM', async ({ page }) => {
    await loadAppWithState(page, book());
    await pasteAndSave(page, `${dmy(DAY)}/ IN TIME
------8:30 AM------
----VAT A 1----
01) ALFA
02) ECHO
----VAT A 2----
03) BRAVO
---OFFICE & GATE---
04) DELTA NIGHT`);
    await pasteAndSave(page, `${dmy(DAY)}/ OUT TIME
-------5:00 PM ALL-------
NIGHT HOLD 6 PM TO 6 AM
-----VAT A 1-A 2---
1) BRAVO
2) DELTA`);
    const b = await mark(page, DAY, 2), d = await mark(page, DAY, 4), e = await mark(page, DAY, 5);
    expect([b.inMin, b.outMin, b.hours]).toEqual([510, 1800, 21]);
    // On the night, not the 8:30 shift: 6 PM to 6 AM, 12 hours (it read 8:30 AM in the office, 21 hours).
    expect([d.inMin, d.outMin, d.hours]).toEqual([1080, 1800, 12]);
    expect([e.outMin, e.hours]).toEqual([1020, 8]);
    expect((await readStoredState(page) as any).attendance[DAY].marks[6]).toBeUndefined();
  });

  test('a roll whose year slipped on the phone is read in the year it was pasted, said; "12 PM OUT" on the 8:30 shift is noon', async ({ page }) => {
    await loadAppWithState(page, book());
    const later = String(Number(DAY.slice(2, 4)) + 2);
    await switchTab(page, 'pageStaff');
    await page.locator('[data-action="invAttView"][data-view="paste"]').first().click();
    await page.locator('#relayPasteText').fill(`${dmy(DAY, later)}/IN TIME
------8:30 AM------
----VAT A 1----
01) ALFA
02) ECHO 12 PM OUT`);
    await page.locator('[data-action="invRelayRead"]').click();
    await expect(page.getByText('names 20' + later)).toBeVisible();
    await page.locator('[data-action="invRelaySave"]').click();
    await expect(page.locator('[data-action="invRelaySave"]')).toHaveCount(0);
    const e = await mark(page, DAY, 5);
    // 8:30 AM to noon: 3 hours (read as midnight, 15).
    expect([e.inMin, e.outMin, e.hours]).toEqual([510, 720, 3]);
  });

  test('the payout\'s cut-off is Saturday at 5 PM: the Saturday night, its EXTRA and its snacks are the next week\'s', async ({ page }) => {
    // The last Saturday before this week, and the pay week that ends on it.
    let sat = shift(todayIso(), -7); while (new Date(sat + 'T00:00:00').getDay() !== 6) sat = shift(sat, -1);
    const wk = shift(sat, -6), next = shift(sat, 1);
    await loadAppWithState(page, book({ attendance: { [sat]: { marks: {
      2: { st: 'P', area: 'vat-a2', inMin: 510, outMin: 1800, hours: 21, ot: 0, src: 'relay' },
      3: { st: 'P', area: 'pickling-vat', inMin: 510, outMin: 1020, hours: 8, ot: 0, src: 'relay' } },
      extra: [{ kind: 'block', areas: ['vat-a2'], area: 'vat-a2', from: '17:00', to: '06:00', hours: 13, crew: [2], src: 'relay' },
        { kind: 'coverage', area: 'pickling-vat', hours: 8, crew: [], src: 'relay' }] } } }));
    const r: any = await ev(page, `(function() {
      var cfg = labourCfg(), a = payWeek('${wk}'), b = payWeek('${next}');
      return { rate: cfg.extraRate, aB: a.lab.byWorker[2].total, aC: a.lab.byWorker[3].total, aX: a.extra, aS: a.snacks.amount,
        bB: b.lab.byWorker[2] ? b.lab.byWorker[2].total : 0, bX: b.extra, bS: b.snacks.amount, snack: cfg.snackNight };
    })()`);
    // 8:30 AM to 5 PM is the Saturday's own payout (8 h at ₹50); the 13 hours after 5 PM are the next week's.
    expect(r.aB).toBe(400);
    expect(r.bB).toBe(650);
    expect(r.aC).toBe(400);
    // The block from 5 PM is the next week's EXTRA; the general shift's coverage stays.
    expect(r.aX).toBe(8 * r.rate);
    expect(r.bX).toBe(13 * r.rate);
    // The Saturday night's snack goes with it.
    expect(r.aS).toBe(0);
    expect(r.bS).toBe(r.snack);
  });
});
