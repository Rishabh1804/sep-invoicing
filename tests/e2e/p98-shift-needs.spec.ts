import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab, todayIso, type SepState } from './fixtures';

// P98 (owner, 29 Sep 2026): the heads a shift needs, the out-time roll read right, and the reader learning from
// corrections. Names are made up; the roll is shaped like the one the owner sent.
//   - "night hold-8 pm to 6 am" is a block from 8 PM to 6 AM (it read 5 PM), "berral & V A 2" is barrel + VAT A2 (it read
//     barrel alone), "pickling 2 SIDE" is pickling on both sides.
//   - Needed: the general shift's number per area per day, and a block's own, over the usual complement.
//   - A heading corrected on the Day view is read that way on the next roll, said so, and can be forgotten.

const dmy = () => { const [y, m, d] = todayIso().split('-'); return `${d}/${m}/${y.slice(2)}`; };
const NAMES = ['ALFA', 'BRAVO', 'CHARU', 'DELTA', 'ECHO', 'FOXY', 'GOLU', 'HIRA', 'INDU', 'JAGAT', 'KALU', 'LAKSH'];
const STAFF = NAMES.map((n, i) => ({ id: i + 1, name: n, comp: 'hourly', area: 'flex', hourRate: 50, active: true, onFloor: true }));
const ROLL = () => `${dmy()}/ OUT TIME
----5:00 PM---
1) ALFA
2) BRAVO 2 PM
3) CHARU 7:00 PM
----8:00 PM---
VAT A 2
4) DELTA
5) ECHO
EXTRA 3 HOURS
pickling 2 SIDE
6) FOXY
7) GOLU
EXTRA 3 HOURS
berral pickling
8) HIRA
9) INDU
berral extra 9 hours
----------------------------------
night hold-8 pm to 6 am
----berral &  V A 2----
1) DELTA
2) ECHO
3) FOXY
4) HIRA
EXTRA 32 HOURS`;

function state(extra: any = {}): SepState {
  return { ...emptyState(), incomingMaterial: noSeedIM(), staff: STAFF, attendance: {}, ...extra } as SepState;
}
const g = (p: Page, expr: string) => p.evaluate(e => (0, eval)(e), expr);
const parse = (p: Page, text: string) => p.evaluate(t => {
  const r = (0, eval)('parseRelayRoll')(t, (0, eval)('relayRoster({})'), null);
  const d = r.days[r.date];
  return { extra: d.extra.map((x: any) => ({ areas: x.areas || [x.area], from: x.from, to: x.to, hours: x.hours, crew: (x.crew || []).length })),
    out: { BRAVO: d.people[2] && d.people[2].outExp, CHARU: d.people[3] && d.people[3].outExp }, info: r.issues.filter((i: any) => i.tone === 'info').map((i: any) => i.text) };
}, text);

test.describe('P98: the out-time roll read right', () => {
  test('night hold runs 8 PM to 6 AM on barrel + VAT A2; pickling 2 side is both pickling areas; 5–8 PM blocks and own times stand', async ({ page }) => {
    await loadAppWithState(page, state());
    const r = await parse(page, ROLL());
    expect(r.extra).toEqual([
      { areas: ['vat-a2'], from: '17:00', to: '20:00', hours: 3, crew: 2 },
      { areas: ['pickling-vat', 'pickling-barrel'], from: '17:00', to: '20:00', hours: 3, crew: 2 },
      { areas: ['pickling-barrel'], from: '17:00', to: '20:00', hours: 9, crew: 2 },
      { areas: ['barrel', 'vat-a2'], from: '20:00', to: '06:00', hours: 32, crew: 4 },
    ]);
    expect(r.out).toEqual({ BRAVO: 14 * 60, CHARU: 19 * 60 });
    // A heading "night" with no times written is the night hold too.
    const bare = await parse(page, `${dmy()}/ OUT TIME\n----night----\n----berral----\n1) ALFA\nEXTRA 10 HOURS`);
    expect(bare.extra[0]).toMatchObject({ from: '20:00', to: '06:00' });
  });
});

test.describe('P98: the heads a shift needs', () => {
  const day = () => ({
    [todayIso()]: {
      marks: { 1: { st: 'P', area: 'barrel' }, 2: { st: 'P', area: 'barrel' }, 3: { st: 'P', area: 'barrel' },
        4: { st: 'P', area: 'vat-a1' }, 5: { st: 'P', area: 'vat-a1' } },
      extra: [{ kind: 'coverage', area: 'barrel', hours: 8 }], note: '',
    },
  });
  const unit = (p: Page, id: string) => g(p, `(function(){ var u = areaStats('${todayIso()}', '${todayIso()}').units.find(function(x){ return x.id === '${id}'; }); return u ? { norm: u.norm, short: u.shortHeads } : null; })()`);

  test('a number for the day replaces the usual one in the shortfall; 0 means nobody needed; blank goes back', async ({ page }) => {
    await loadAppWithState(page, state({ areaTargets: { barrel: 3, 'pickling-barrel': 2, 'vat-a1': 4 }, attendance: day() }));
    // Usual: barrel unit 5 against 3 heads, VAT A1 4 against 2.
    expect(await unit(page, 'barrel-block')).toEqual({ norm: 5, short: 2 });
    await switchTab(page, 'pageStaff');
    await page.locator('[data-action="invAttView"][data-view="day"]').first().click();
    const row = page.locator('[data-need-area="vat-a1"]');
    await expect(row).toContainText('Short 2');
    await row.locator('[data-att-need]').fill('2');
    await row.locator('[data-att-need]').press('Tab');
    await expect(page.locator('[data-need-area="vat-a1"]')).toContainText('Met');
    await expect(page.locator('[data-need-area="vat-a1"]')).toContainText('usually 4');
    // Barrel ran 3 today and its pickling needed nobody.
    await page.locator('[data-need-area="pickling-barrel"] [data-att-need]').fill('0');
    await page.locator('[data-need-area="pickling-barrel"] [data-att-need]').press('Tab');
    expect(await unit(page, 'barrel-block')).toEqual({ norm: 3, short: 0 });
    // Not an attendance record: a number for a day with nothing marked stores no day.
    await g(page, `setAreaNeedOn('2099-01-01', 'barrel', 2)`);
    expect(await g(page, `!!S.attendance['2099-01-01'] + '|' + S.shiftNeeds['2099-01-01'].barrel`)).toBe('false|2');
    await g(page, `setAreaNeedOn('${todayIso()}', 'pickling-barrel', '')`);
    expect(await unit(page, 'barrel-block')).toEqual({ norm: 5, short: 2 });
  });

  test("a block's own number is what it is judged against", async ({ page }) => {
    await loadAppWithState(page, state({ areaTargets: { barrel: 3, 'pickling-barrel': 2, 'vat-a2': 4 } }));
    const n = await g(page, `(function(){ var x = { kind: 'block', areas: ['barrel', 'vat-a2'], from: '20:00', to: '06:00', crew: [1,2,3,4], hours: 32 };
      var a = blockNorm(x); x.need = 4; return [a, blockNorm(x)]; })()`);
    expect(n).toEqual([9, 4]);
  });
});

test.describe('P98: learning from corrections', () => {
  test('a heading corrected on the Day view is read that way next time, said so, and can be forgotten', async ({ page }) => {
    await loadAppWithState(page, state());
    // The roll pasted and saved through the real review, as the owner does; then the night block corrected on the day.
    await switchTab(page, 'pageStaff');
    await page.locator('[data-action="invAttView"][data-view="paste"]').first().click();
    await page.locator('#relayPasteText').fill(ROLL());
    await page.locator('[data-action="invRelayRead"]').click();
    await page.locator('[data-action="invRelaySave"]').click();
    await expect(page.locator('[data-action="invRelaySave"]')).toHaveCount(0);
    await g(page, `_attDate = '${todayIso()}'`);
    expect(await g(page, `S.attendance['${todayIso()}'].extra.filter(function(x){ return x.srcHead; }).length`)).toBe(4);
    const night = await g(page, `S.attendance['${todayIso()}'].extra.findIndex(function(x){ return x.from === '20:00'; })`);
    await g(page, `toggleAttBlockArea(${night}, 'vat-a2')`);           // it was barrel only that night
    await g(page, `setAttBlockTime(${night}, 'from', '21:00')`);
    const L = await g(page, `JSON.stringify(Object.keys(relayLearnData().heads)) + ' ' + JSON.stringify(Object.keys(relayLearnData().slots))`);
    // A heading's lesson is kept for its slot (P107): the night hold's slot, out at 6 AM.
    expect(L).toBe('["BERRAL V A 2 @ out 06:00"] ["NIGHT HOLD 8 PM TO 6 AM"]');

    const r = await parse(page, ROLL());
    expect(r.extra[3]).toMatchObject({ areas: ['barrel'], from: '21:00', to: '06:00' });
    expect(r.info.join(' ')).toContain('learnt from your correction');

    // A bare time heading is never learnt: one day's late start must not move every day's 5–8 PM block.
    const b = await g(page, `S.attendance['${todayIso()}'].extra.findIndex(function(x){ return x.hours === 9; })`);
    await g(page, `setAttBlockTime(${b}, 'from', '18:00')`);
    expect(await g(page, `Object.keys(relayLearnData().slots).length`)).toBe(1);

    // Listed with Forget on the paste view.
    await switchTab(page, 'pageStaff');
    await page.locator('[data-action="invAttView"][data-view="paste"]').first().click();
    await expect(page.locator('#relayLearnt [data-learnt]')).toHaveCount(2);   // the heading's areas, the night hold's times
    await page.locator('#relayLearnt [data-learnt="slot"] [data-action="invRelayForget"]').click();
    await expect(page.locator('#relayLearnt [data-learnt="slot"]')).toHaveCount(0);
    expect((await parse(page, ROLL())).extra[3]).toMatchObject({ from: '20:00' });

    // Put back as it was read, the lesson goes.
    await g(page, `toggleAttBlockArea(${night}, 'vat-a2')`);
    expect(await g(page, `!!relayLearnData().heads['BERRAL V A 2 @ out 06:00']`)).toBe(false);
  });
});
