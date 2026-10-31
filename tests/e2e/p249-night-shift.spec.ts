import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, openSettingsAt, readStoredState, switchTab, todayIso, type SepState } from './fixtures';

// P249: a line's schedule with a start date (owner, 29 Oct 2026: a night shift on VAT A1, "Build it as a schedule per line with a
// start date, read by attendance, pay, EXTRA, production, efficiency, power, capacity and the planner"). The night's heading starts
// at the schedule's start; a hand on the night and on no other roll is in at it, 12 hours to 6 AM (a monthly hand's 4 of them OT,
// with the night snack); a hand in from 4 PM is no head of the general shift; a night block's norm is the schedule's crew; the
// To-do flags a short night and a hand on two shifts back to back; efficiency judges the night against its plating time less the
// break; a night page's times run on past midnight; a cut in the night is in working hours; capacity counts the night. Made-up names.

const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const shift = (from: string, n: number) => { const d = new Date(from + 'T00:00:00'); d.setDate(d.getDate() + n); return isoOf(d); };
// A weekday in the last week, so the To-do reaches it and it is a working day.
const DAY = (() => { let d = shift(todayIso(), -2); while (new Date(d + 'T00:00:00').getDay() === 0) d = shift(d, -1); return d; })();
const NEXT = shift(DAY, 1);
const dmy = (d: string) => { const [y, m, dd] = d.split('-'); return dd + '/' + m + '/' + y.slice(2); };
const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);

const STAFF = [
  { id: 1, name: 'Alfa Oraon', comp: 'monthly', dayRate: 520, area: 'vat-a1', onFloor: true, active: true },
  { id: 2, name: 'Bravo Munda', comp: 'hourly', hourRate: 50, area: 'vat-a1', onFloor: true, active: true },
  { id: 3, name: 'Charlie Soren', comp: 'hourly', hourRate: 50, area: 'pickling-vat', onFloor: true, active: true },
  { id: 4, name: 'Delta Hembrom', comp: 'monthly', dayRate: 500, area: 'vat-a1', onFloor: true, active: true },
  { id: 5, name: 'Echo Tudu', comp: 'hourly', hourRate: 50, area: 'vat-a2', onFloor: true, active: true },
  { id: 6, name: 'Foxtrot Kisku', comp: 'hourly', hourRate: 50, area: 'vat-a1', onFloor: true, active: true }];
// The night from a week before DAY: 6 PM to 6 AM, plating stops at 5 AM, a 45-minute break, 4 on the line and 2 on pickling, 1 spare.
const NIGHT = { id: 'ls1', line: 'vat-a1', from: shift(DAY, -7), start: '18:00', end: '06:00', stop: '05:00', breakMin: 45, crew: { 'vat-a1': 4, 'pickling-vat': 2 }, spare: 1, note: '' };
function book(extra?: any): SepState {
  return { ...emptyState(), incomingMaterial: noSeedIM(), staff: STAFF, attendance: {}, lineShifts: [NIGHT], ...(extra || {}) } as unknown as SepState;
}
async function pasteAndSave(page: Page, text: string) {
  await switchTab(page, 'pageStaff');
  await page.locator('[data-action="invAttView"][data-view="paste"]').first().click();
  await page.locator('#relayPasteText').fill(text);
  await page.locator('[data-action="invRelayRead"]').click();
  await page.locator('[data-action="invRelaySave"]').click();
  await expect(page.locator('[data-action="invRelaySave"]')).toHaveCount(0);
}
const IN = `${dmy(DAY)}/ in time
----8:30 AM---
---VAT A 1----
1) ALFA
---VAT A 2----
2) ECHO`;
const OUT = `${dmy(DAY)}/ out time
----NIGHT SHIFT VAT A 1 & PICKLING----
1) BRAVO
2) CHARLIE
3) DELTA
4) ALFA
EXTRA 12 HOURS`;

test.describe('P249: the night shift on a line\'s schedule', () => {
  test('the schedule in force on a day: its night on the day\'s clock, the latest from-date winning', async ({ page }) => {
    // A day under the older schedule that is no Sunday (the night does not run on one).
    let MID = shift(DAY, -10); while (new Date(MID + 'T00:00:00').getDay() === 0) MID = shift(MID, -1);
    await loadAppWithState(page, book({ lineShifts: [{ ...NIGHT, id: 'ls0', from: shift(DAY, -20), start: '17:00', end: '08:30', stop: '08:30', breakMin: 0 }, NIGHT] }));
    const r = await ev(page, `[lineNightOn('vat-a1', '${DAY}'), lineNightOn('vat-a1', '${MID}'), lineNightOn('vat-a2', '${DAY}'), lineNightOn('vat-a1', '${shift(DAY, -30)}')]
      .map(function(n) { return n && [n.start, n.end, n.stop, n.plateMin, n.need, n.spare]; })`);
    expect(r[0]).toEqual([1080, 1800, 1740, 615, 6, 1]);
    expect(r[1]).toEqual([1020, 1950, 1950, 930, 6, 1]);
    expect(r[2]).toBeNull();
    expect(r[3]).toBeNull();
    // No night on a Sunday unless the schedule says so (owner: the night shift does not run Sunday night), nor on a day shut.
    const sun = await ev(page, `(function() { var d = '${DAY}'; while (new Date(d + 'T00:00:00').getDay() !== 0) d = isoAddDays(d, -1);
      var off = lineNightOn('vat-a1', d); S.lineShifts[1].sunday = true; var on = lineNightOn('vat-a1', d); S.lineShifts[1].sunday = false;
      S.flowCfg.holidays = ['${DAY}']; var shut = lineNightOn('vat-a1', '${DAY}'); S.flowCfg.holidays = [];
      return [d >= '${shift(DAY, -7)}' ? off : 'skip', d >= '${shift(DAY, -7)}' ? !!on : true, shut]; })()`);
    if (sun[0] !== 'skip') expect(sun[0]).toBeNull();
    expect(sun[1]).toBe(true);
    expect(sun[2]).toBeNull();
  });

  test('the roll: the night heading starts at 6 PM; a hand on the night alone is in at it, 12 hours; the snack is the night\'s', async ({ page }) => {
    await loadAppWithState(page, book());
    await pasteAndSave(page, IN);
    await pasteAndSave(page, OUT);
    const st = await readStoredState(page);
    const day = st.attendance[DAY];
    const blk = day.extra.find((x: any) => x.kind === 'block');
    expect(blk.from).toBe('18:00');
    expect(blk.to).toBe('06:00');
    // On no in-time roll: in at 6 PM, out at 6 AM. A monthly hand's 12 hours are 4 of overtime; an hourly hand's 12 hours at the rate.
    expect(day.marks[4]).toMatchObject({ st: 'P', inMin: 1080, outMin: 1800, hours: 12, ot: 4 });
    expect(day.marks[2]).toMatchObject({ st: 'P', inMin: 1080, outMin: 1800, hours: 12, ot: 0 });
    // The day hand who stayed on: 8:30 to 6 AM, said on the review as over 16 hours, and flagged back to back.
    expect(day.marks[1]).toMatchObject({ inMin: 510, outMin: 1800 });
    const snacks = await ev(page, `paySnacks('${DAY}', '${DAY}').days['${DAY}']`);
    expect(snacks.night).toBe(4);
    const twice = await ev(page, `shiftBackToBack('${DAY}').map(function(x) { return x.id + ':' + x.kind; })`);
    expect(twice).toEqual(['1:same']);
    // The roll's own heading names one area or two, never all the night's: the block is judged against the whole crew of 6
    // (Castor B-1). Four named, two short: 24 hours expected.
    const a = await ev(page, `(function() { var b = areaStats('${DAY}', '${DAY}').blocks.find(function(x) { return x.iso === '${DAY}'; }); return b && [b.norm, b.heads, b.expected]; })()`);
    expect(a).toEqual([6, 4, 24]);
    // An in-time roll pasted after, listing a night hand absent, does not take the night back (Castor M-1).
    await pasteAndSave(page, `${dmy(DAY)}/ in time
----8:30 AM---
---VAT A 1----
1) ALFA
---absent---
2) BRAVO`);
    expect((await readStoredState(page)).attendance[DAY].marks[2]).toMatchObject({ st: 'P', inMin: 1080, outMin: 1800, hours: 12 });
  });

  test('a night roll sent the next morning with no date is the night before\'s; one with its date, or sent after noon, is not', async ({ page }) => {
    // Owner, 30 Oct 2026: the night roll "is sent retrospectively in the morning".
    await loadAppWithState(page, book());
    const body = OUT.split('\n').slice(1).join('\n');
    const r = await ev(page, `(function() { var t = ${JSON.stringify('out time\n')} + ${JSON.stringify(body)};
      var morn = parseRelayRoll(t, [], '${NEXT}', { sentAt: 7 * 60 + 15, night: shiftNightFor });
      var noon = parseRelayRoll(t, [], '${NEXT}', { sentAt: 13 * 60, night: shiftNightFor });
      var dated = parseRelayRoll(${JSON.stringify(dmy(NEXT) + '/ ')} + t, [], '${NEXT}', { sentAt: 7 * 60, night: shiftNightFor });
      var day = parseRelayRoll(${JSON.stringify('out time\n----5:00 PM----\n1) ALFA')}, [], '${NEXT}', { sentAt: 7 * 60, night: shiftNightFor });
      return [morn.date, morn.issues.some(function(i) { return /night before/.test(i.text); }), noon.date, dated.date, day.date]; })()`);
    expect(r).toEqual([DAY, true, NEXT, NEXT, NEXT]);
  });

  test('an evening block is no night; a day hand on an untagged night is on it, and flagged back to back', async ({ page }) => {
    const m = (area: string, a: number, b: number) => ({ st: 'P', area, inMin: a, outMin: b, hours: Math.floor((b - a) / 60), ot: 0, src: 'relay' });
    await loadAppWithState(page, book({ attendance: {
      [DAY]: { marks: { 1: m('vat-a1', 510, 1800), 4: m('vat-a1', 510, 1200), 2: m('vat-a1', 1080, 1800), 5: m('barrel', 510, 1200) },
        extra: [{ kind: 'block', area: 'vat-a1', areas: ['vat-a1'], from: '17:00', to: '20:00', hours: 3, crew: [4], src: 'relay' },
          { kind: 'block', area: 'barrel', areas: ['barrel'], from: '17:00', to: '20:00', hours: 2, crew: [5], src: 'relay' }], note: '' } } }));
    const r = await ev(page, `(function() { var c = shiftNightCrew('${DAY}', 'vat-a1');
      return { ids: c.ids.slice().sort(), twice: shiftBackToBack('${DAY}').map(function(x) { return x.id + ':' + x.kind; }) }; })()`);
    expect(r.ids).toEqual(['1', '2']);
    expect(r.twice).toEqual(['1:same']);
  });

  test('a hand in for the night is no head of the general shift; the night block\'s norm is the schedule\'s crew; a short night asks', async ({ page }) => {
    const m = (area: string, a: number, b: number) => ({ st: 'P', area, inMin: a, outMin: b, hours: Math.floor((b - a) / 60), ot: 0, src: 'relay' });
    await loadAppWithState(page, book({ attendance: {
      [DAY]: { marks: { 1: m('vat-a1', 510, 1020), 2: m('vat-a1', 1080, 1800), 3: m('pickling-vat', 1080, 1800), 6: m('vat-a1', 1080, 1800) },
        extra: [{ kind: 'block', area: 'vat-a1', areas: ['vat-a1', 'pickling-vat'], from: '18:00', to: '06:00', hours: 36, crew: [2, 3, 6], src: 'relay' }], note: '' } } }));
    const r = await ev(page, `(function() {
      var A = areaStats('${DAY}', '${DAY}'), a1 = A.rows.find(function(x) { return x.id === 'vat-a1'; });
      var blk = A.blocks.find(function(b) { return b.iso === '${DAY}'; });
      var c = shiftNightCrew('${DAY}', 'vat-a1');
      return { heads: a1.days[0] ? a1.days[0].heads : null, norm: blk.norm, expected: blk.expected, crew: c.heads, short: c.short,
        staffed: Object.keys(prodStaffedLines(S.attendance['${DAY}'])), task: (TODO_RULE_FNS.nightShort() || []).map(function(t) { return t.title; }) };
    })()`);
    expect(r.heads).toBe(1);
    expect(r.norm).toBe(6);
    expect(r.expected).toBe(36);
    expect(r.crew).toBe(3);
    expect(r.short).toBe(3);
    expect(r.staffed).toEqual(['vat-a1']);
    expect(r.task[0]).toContain('3 short of its crew');
    // Day's board: the night's own card, its hands against the crew it needs.
    await switchTab(page, 'pageStaff');
    await ev(page, `_attDate = '${DAY}'; renderAttendance();`);
    await expect(page.locator('[data-att-night-card="vat-a1"] .inv-panel-count')).toHaveText('3/6');
    await expect(page.locator('[data-att-area-card="vat-a1"] .inv-panel-count')).toContainText('1');
  });

  test('efficiency judges the night against its plating time less the break; a night page reads on past midnight', async ({ page }) => {
    await loadAppWithState(page, book());
    const r = await ev(page, `(function() {
      S.production = prodData();
      S.production.entries.push({ id: 'pe1', kind: 'plated', date: '${DAY}', line: 'vat-a1', slot: 'ot', time: '18:40', to: '04:30', qty: 500, unit: 'kg', basis: 'hand', at: Date.now() });
      if (typeof _prodVer !== 'undefined') _prodVer++;
      var o = prodLineEfficiency('${DAY}', 'vat-a1');
      var page = prodFromRegisterRead({ date: '${dmy(DAY)}', line: 'VAT A1', rows: [
        { time: '6:30 PM', customer: 'DELTA AUTO', part: 'CLAMP', qtyText: '60' },
        { time: '11:40 PM', customer: '', part: '', qtyText: '60', ditto: true },
        { time: '12:20 AM', customer: '', part: '', qtyText: '60', ditto: true },
        { time: '2:00', customer: '', part: '', qtyText: '60', ditto: true }] }, prodCtx(), '${DAY}', { date: '${DAY}', line: 'vat-a1' });
      // A general-shift page on the same day keeps the day's reading (Vulcanus H-1): the noon fix, a row out of turn, the afternoon.
      var day = prodFromRegisterRead({ date: '${dmy(DAY)}', line: 'VAT A1', rows: [
        { time: '9:00', customer: 'DELTA AUTO', part: 'CLAMP', qtyText: '60' },
        { time: '11:30', customer: '', part: '', qtyText: '60', ditto: true },
        { time: '11:20', customer: '', part: '', qtyText: '60', ditto: true },
        { time: '12:45 AM', customer: '', part: '', qtyText: '60', ditto: true },
        { time: '1:05', customer: '', part: '', qtyText: '60', ditto: true }] }, prodCtx(), '${DAY}', { date: '${DAY}', line: 'vat-a1' });
      // A night page opening on a bare 7:00 is the evening.
      var bare = prodFromRegisterRead({ date: '${dmy(DAY)}', line: 'VAT A1', rows: [
        { time: '7:00', customer: 'DELTA AUTO', part: 'CLAMP', qtyText: '60' },
        { time: '7:20', customer: '', part: '', qtyText: '60', ditto: true }] }, prodCtx(), '${DAY}', { date: '${DAY}', line: 'vat-a1' });
      return { night: o.night, minutes: o.minutes, mins: page.rows.map(function(x) { return x.min; }), noon: page.rows.some(function(x) { return x.issues.some(function(i) { return i.code === 'meridiem'; }); }),
        day: day.rows.map(function(x) { return x.min; }), bare: bare.rows.map(function(x) { return x.min; }) };
    })()`);
    expect(r.night).toMatchObject({ start: 1080, stop: 1740, breakMin: 45, plateMin: 615 });
    expect(r.minutes).toBe(615);
    expect(r.mins).toEqual([1110, 1420, 1460, 1560]);
    expect(r.noon).toBe(false);
    expect(r.day).toEqual([540, 690, 680, 765, 785]);
    expect(r.bare).toEqual([1140, 1160]);
  });

  test('a cut in the night is in working hours, the night before\'s up to its end; capacity is the two shifts', async ({ page }) => {
    const m = (area: string) => ({ st: 'P', area, inMin: 1080, outMin: 1800, hours: 12, ot: 0, src: 'relay' });
    await loadAppWithState(page, book({ attendance: { [DAY]: { marks: { 2: m('vat-a1') }, extra: [], note: '' } } }));
    const r = await ev(page, `(function() {
      var w = powerWindows('${DAY}').filter(function(x) { return x.kind === 'night'; }), w2 = powerWindows('${NEXT}').filter(function(x) { return x.kind === 'night'; });
      return { today: w.map(function(x) { return [x.from, x.to]; }), next: w2.map(function(x) { return [x.from, x.to]; }),
        cap: statsCapacityKg('${DAY}', '${DAY}'), plain: STATS_CAPACITY_KG_DAY };
    })()`);
    expect(r.today).toEqual([[1080, 1800], [-360, 360]]);
    expect(r.next).toEqual([[-360, 360]]);
    // The model's two shifts already hold the second (Vulcanus H-3): the night adds nothing until the owner rules.
    expect(r.cap).toBe(r.plain);
  });

  test('Settings → Labour → Shifts by line saves a schedule, and the planner\'s line runs the general shift and its night', async ({ page }) => {
    await loadAppWithState(page, book({ lineShifts: [] }));
    await openSettingsAt(page, 'shifts');
    await page.locator('#setShLine0').selectOption('vat-a1');
    await page.locator('#setShFrom0').fill(DAY);
    await page.locator('#setShStart0').fill('18:00');
    await page.locator('#setShEnd0').fill('06:00');
    await page.locator('#setShStop0').fill('05:00');
    await page.locator('#setShBreak0').fill('45');
    await page.locator('#setShCrewL0').fill('4');
    await page.locator('#setShCrewP0').fill('2');
    await page.locator('#setShSpare0').fill('1');
    await page.locator('button[data-action="invSaveSettingsSec"][data-sec="shifts"]').click();
    await expect.poll(async () => (await readStoredState(page)).lineShifts?.length).toBe(1);
    const st = await readStoredState(page);
    expect(st.lineShifts[0]).toMatchObject({ line: 'vat-a1', from: DAY, start: '18:00', end: '06:00', stop: '05:00', breakMin: 45, crew: { 'vat-a1': 4, 'pickling-vat': 2 }, spare: 1 });
    const pl = await ev(page, `(function() { _plnBase = null; var B = plnBase(); return B.lines['vat-a1'].night; })()`);
    if (DAY <= todayIso()) expect(pl).toMatchObject({ h: 10.25, need: 6 });
  });
});
