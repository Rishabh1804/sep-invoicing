import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, type SepState, openAttendance, toolbarMore, toolbarMoreLabels } from './fixtures';

// P124: the QA of the floor (30 Sep 2026) — attendance rolls, Pay, the payroll as paid, the roster, the exception ledger,
// the Day board and Shyam's sheet — and "Read the rolls again", which repairs a day the old reader got wrong (the owner's
// 22, 23 and 25 Sep). Names are made up (the repo is public); ids are numbers, as on a device; dates are built from today.

const g = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function iso(offset = -1): string { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + offset); return isoOf(d); }
function dmy(offset = -1): string { const [y, m, d] = iso(offset).split('-'); return `${d}/${m}/${y.slice(2)}`; }
/** Sunday of the pay week `weeks` from this one, plus `day` days (0 = Sunday). */
function wd(weeks: number, day: number): string {
  const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() - d.getDay() + weeks * 7 + day); return isoOf(d);
}
/** The month `k` months from `ym` ('YYYY-MM'). */
function ymAdd(ym: string, k: number): string {
  const d = new Date(ym + '-01T00:00:00'); d.setMonth(d.getMonth() + k);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const STAFF = [
  { id: 1, name: 'ALFA', comp: 'monthly', area: 'vat-a1', dayRate: 500, active: true, onFloor: true },
  { id: 2, name: 'BRAVO', comp: 'hourly', area: 'vat-a1', hourRate: 50, active: true, onFloor: true },
  { id: 3, name: 'CHARU', comp: 'hourly', area: 'barrel', hourRate: 50, active: true, onFloor: true },
  { id: 4, name: 'DELTA', comp: 'monthly', area: 'vat-a2', dayRate: 500, active: true, onFloor: true },
  { id: 5, name: 'ECHO', comp: 'hourly', area: 'vat-a2', hourRate: 50, active: true, onFloor: true },
];
function book(extra: Record<string, unknown> = {}): SepState {
  return { ...emptyState(), incomingMaterial: noSeedIM(), staff: STAFF, attendance: {}, labour: { holidays: [] }, ...extra } as unknown as SepState;
}
/** A roll read the way the review reads it: every mark and EXTRA row, and the questions. */
const read = (page: Page, text: string) => g(page, `(function(){ var r = parseRelayRoll(${JSON.stringify(text)}, relayRoster({}), null);
  var d = r.days[r.date] || { people: {}, extra: [] }, m = {};
  Object.keys(d.people).forEach(function(id){ var w = staffById(id); m[w.name] = relayPersonMark(d.people[id], w, d.restOut); });
  return { marks: m, extra: d.extra, issues: r.issues.map(function(i){ return i.tone + ':' + i.text; }) }; })()`) as Promise<any>;
async function paste(page: Page, text: string) {
  await switchTab(page, 'pageStaff');
  await page.locator('[data-action="invAttView"][data-view="paste"]').first().click();
  await page.locator('#relayPasteText').fill(text);
  await page.locator('[data-action="invRelayRead"]').click();
}
async function pasteAndSave(page: Page, text: string) {
  await paste(page, text);
  await page.locator('[data-action="invRelaySave"]').click();
  await expect(page.locator('[data-action="invRelaySave"]')).toHaveCount(0);
}
async function openDay(page: Page, day: string) {
  await switchTab(page, 'pageStaff');
  await openAttendance(page, 'day');
  await page.locator('#attDate').fill(day);
  await page.locator('#attDate').dispatchEvent('change');
  await expect(page.locator('#attDate')).toHaveValue(day);
}

/* The in-time roll of 22 and 23 Sep 2026, in its shape: the general shift headed "8:00 PM", its lines and the absent. */
const IN_8PM = (offset = -1) => `${dmy(offset)}/ in time
-----8:00 PM----
---VAT A 1----
1) ALFA
2) BRAVO
EXTRA 8 HOURS
---berral & pickling---
3) CHARU
--monthly absent---
4) DELTA`;
/* The out-time roll of 25 Sep 2026, in its shape: a block's EXTRA written as a span, with no hours. */
const OUT_SPAN = (offset = -1) => `${dmy(offset)}/ out time
----8:00 PM----
----VAT A 1----
1) BRAVO
EXTRA 5 PM TO 6 AM`;

test.describe('P124: attendance rolls', () => {
  test('G3-1: a PM heading over the lines and the absent, with no 8:30 heading, is the 8:30 shift; nobody reads 21 hours', async ({ page }) => {
    await loadAppWithState(page, book());
    const r = await read(page, IN_8PM());
    // It read ALFA in at 8 PM and out at 5 PM the next day: 21 h, 13 of them OT.
    expect(r.marks.ALFA).toMatchObject({ st: 'P', area: 'vat-a1', hours: 8, ot: 0, inMin: 510, outMin: 1020 });
    expect(r.marks.CHARU).toMatchObject({ area: 'barrel', hours: 8 });
    expect(r.marks.DELTA).toMatchObject({ st: 'A' });
    // Its EXTRA is the general shift's coverage, not a block from 5 PM.
    expect(r.extra[0]).toMatchObject({ kind: 'coverage', area: 'vat-a1', hours: 8 });
    expect(r.issues.some((i: string) => i.startsWith('amber:"8:00 PM" holds the day\'s lines and the absent lists'))).toBe(true);

    // A night hold on an in-time roll: its hands leave when it ends (6 AM), never at 5 PM the next day.
    const n = await read(page, `${dmy()}/ in time\n----night hold 8 pm----\n----berral----\n1) CHARU\nEXTRA 10 HOURS\n----8:30 AM----\nVAT A 1\n2) BRAVO`);
    expect(n.marks.CHARU).toMatchObject({ hours: 10, inMin: 1200, outMin: 1800 });
    expect(n.marks.BRAVO).toMatchObject({ hours: 8 });

    // An evening slot that says no end: 5 PM is not when a hand who came at 8 PM left, and is never rolled to the next day.
    const e = await read(page, `${dmy()}/ in time\n----8:00 PM----\n---VAT A 1----\n1) BRAVO\nEXTRA 6 HOURS`);
    expect(e.marks.BRAVO).toMatchObject({ hours: 0, inMin: 1200, outMin: null });
  });

  test('G3-1: the review flags a present mark over 16 hours, and an evening hand with no out', async ({ page }) => {
    await loadAppWithState(page, book());
    await paste(page, `${dmy()}/ in time\n----6:00 AM---\n----VAT A 1----\n1) ALFA\nEXTRA 3 HOURS\n----8:30 AM---\n---VAT A 1----\n1) ALFA\n` +
      `\n${dmy()}/ out time\n----night hold 6 am----\n----VAT A 1----\n1) ALFA\nEXTRA 10 HOURS`);
    await expect(page.locator('#relayIssues')).toContainText('ALFA reads 24 hours');
    await page.locator('[data-action="invRelayBack"]').click();
    await page.locator('#relayPasteText').fill(`${dmy()}/ in time\n----8:00 PM----\n---VAT A 1----\n1) BRAVO\nEXTRA 6 HOURS`);
    await page.locator('[data-action="invRelayRead"]').click();
    await expect(page.locator('#relayIssues')).toContainText('BRAVO came in at 8 PM');
    await expect(page.locator('[data-relay-row]').filter({ hasText: 'BRAVO' })).toContainText('8 PM in, out not known · 0 h');
  });

  test('G3-3: an out-time roll pasted after the in-time roll keeps the general shift\'s area', async ({ page }) => {
    await loadAppWithState(page, book());
    await pasteAndSave(page, `${dmy()}/ in time\n----8:30 AM---\n---VAT A 1----\n1) ALFA\n2) BRAVO`);
    await pasteAndSave(page, `${dmy()}/ out time\n----8:00 PM---\nVAT A 2\n1) ALFA\nEXTRA 3 HOURS`);
    const m = (await readStoredState(page)).attendance[iso()].marks;
    // It moved ALFA to VAT A2, the evening block's line; pasted together, the general shift's area won.
    expect(m[1]).toMatchObject({ area: 'vat-a1', hours: 11, ot: 3 });
    expect(m[2]).toMatchObject({ area: 'vat-a1', hours: 8 });
  });

  test('G3-4: the same roll twice in one paste is read once, and the review says so', async ({ page }) => {
    await loadAppWithState(page, book());
    const roll = `${dmy()}/ in time\n----8:30 AM---\n---VAT A 1----\n1) ALFA\n2) BRAVO\nEXTRA 8 HOURS`;
    await paste(page, roll + '\n\n' + roll);
    await expect(page.locator('#relayRepeatNote')).toContainText('1 message repeats one earlier in this paste');
    await expect(page.locator('[data-relay-extra]')).toHaveCount(1);
    await page.locator('[data-action="invRelaySave"]').click();
    await expect(page.locator('[data-action="invRelaySave"]')).toHaveCount(0);
    const s = await readStoredState(page);
    expect(s.attendance[iso()].extra).toHaveLength(1);
    expect(s.relayPastes).toHaveLength(1);
  });

  test('G3-5: a time with its meridiem on the digits is not a word; a time lesson learnt under one is dropped', async ({ page }) => {
    await loadAppWithState(page, book({
      relayLearn: { heads: { 'VAT A 1 @ out 20:00': { areas: ['vat-a2'], was: ['vat-a1'], text: 'VAT A 1', slot: 'out 20:00', at: 1, day: iso() } },
        slots: {
          '12 00AM OUT TIME': { from: '18:00', to: '00:00', wasFrom: '17:00', wasTo: '00:00', text: '12:00AM--OUT TIME', at: 1, day: iso() },
          'NIGHT HOLD 8 PM TO 6 AM': { from: '21:00', to: '06:00', wasFrom: '20:00', wasTo: '06:00', text: 'night hold-8 pm to 6 am', at: 1, day: iso() },
        } },
    }));
    expect(await g(page, `['12:00AM--OUT TIME', '8:00PM', '6AM', '5 PM to 12 AM', '8 :00 pm', 'night hold 8 pm', 'NIGHT HOLD-8 PM TO 6 AM'].map(relayHeadHasWords)`))
      .toEqual([false, false, false, false, false, true, true]);
    // The start's migration dropped the one under a bare time; the night hold's and the heading's area lesson stay.
    const L = (await readStoredState(page)).relayLearn;
    expect(Object.keys(L.slots)).toEqual(['NIGHT HOLD 8 PM TO 6 AM']);
    expect(Object.keys(L.heads)).toEqual(['VAT A 1 @ out 20:00']);
    // A block saved under such a heading teaches nothing when it is corrected.
    await g(page, `S.attendance['${iso()}'] = { marks: {}, note: '', extra: [{ kind: 'block', areas: ['vat-a1'], area: 'vat-a1', crew: [1], hours: 7, from: '17:00', to: '00:00',
      src: 'relay', srcSlot: '12:00AM--OUT TIME', srcFrom: '17:00', srcTo: '00:00' }] }; _attDate = '${iso()}'; setAttBlockTime(0, 'from', '18:00')`);
    expect(await g(page, `Object.keys(relayLearnData().slots)`)).toEqual(['NIGHT HOLD 8 PM TO 6 AM']);
  });

  test('G3-6: "EXTRA 5 PM TO 6 AM" writes a span, not hours: kept at 0 h and asked about', async ({ page }) => {
    await loadAppWithState(page, book());
    const r = await read(page, OUT_SPAN());
    expect(r.extra).toHaveLength(1);
    expect(r.extra[0]).toMatchObject({ kind: 'block', hours: 0 });
    expect(r.issues).toContain('amber:"EXTRA 5 PM TO 6 AM" writes times, not hours: no hours written, so it is kept at 0 h. Type the hours on the Day view.');
    // Hours written the shop's ways still read.
    const ok = await read(page, `${dmy()}/ out time\n----8:00 PM----\n----VAT A 1----\n1) BRAVO\nExtra---3 hours\n----12:00 AM----\n----VAT A 2----\n2) ECHO\nEXTRA 12.5`);
    expect(ok.extra.map((x: any) => x.hours)).toEqual([3, 12.5]);
  });

  test('G3-7: a day deleted by hand takes its rolls to the log, and the same roll pastes again', async ({ page }) => {
    await loadAppWithState(page, book());
    const roll = `${dmy()}/ in time\n----8:30 AM---\n---VAT A 1----\n1) ALFA\n2) BRAVO\nEXTRA 8 HOURS`;
    await pasteAndSave(page, roll);
    await toolbarMore(page, 'Delete this day');   // Day's More (TM4b)
    expect(await answerAsk(page, 'ok', 'Entered against the wrong roster')).toContain('can be pasted again');
    const s = await readStoredState(page);
    expect(s.relayPastes).toHaveLength(0);
    expect(s.attendanceDeletes[0].pastes).toHaveLength(1);
    await paste(page, roll);
    await expect(page.locator('#relayDupNote')).toHaveCount(0);
    await expect(page.locator('[data-action="invRelaySave"]')).toBeEnabled();
    await page.locator('[data-action="invRelaySave"]').click();
    await expect(page.locator('[data-action="invRelaySave"]')).toHaveCount(0);
    expect((await readStoredState(page)).attendance[iso()].marks[1]).toMatchObject({ hours: 8, src: 'relay' });
  });
});

test.describe('P124: Pay and the payroll as paid', () => {
  // The pay month is the one the week's Sunday is in (P107); last month is the one before it.
  const ws = wd(0, 0), pm = ws.slice(0, 7), last = ymAdd(pm, -1);
  const HAND = [{ id: 8, name: 'Arun Das', comp: 'monthly', area: 'vat-a1', dayRate: 500, active: true, onFloor: true }];
  const row = (page: Page, week = ws) => g(page, `(function(){ var r = payDue('${week}').rows.find(function(x){ return x.w.id === 8; });
    return { due: r.due, carried: r.carried, paid: r.paid, earned: r.earned.total, asPaid: !!r.asPaid }; })()`) as Promise<any>;

  test('G3-2: last month on a slip and its salary paid on the 14th: this month is due what it earned, not an advance', async ({ page }) => {
    await loadAppWithState(page, book({ staff: HAND,
      attendance: { [ws]: { marks: { 8: { st: 'P', hours: 8, ot: 0, area: 'vat-a1' } }, extra: [], note: '' } },
      payrollPaid: [{ id: 'PRL-1', month: last, status: 'paid', source: 'slip', at: 1, rows: [{ name: 'Arun Das', worked: 26, dayPay: 13000, ot: 0 }] }],
      staffPayments: [{ id: 'P1', staffId: 8, date: pm + '-14', amount: 13000, kind: 'payment', note: '', at: 1 }] }));
    const r = await row(page);
    // It read −₹12,500, an "Advance": the salary for last month was taken off this one.
    expect(r).toMatchObject({ earned: 500, paid: 0, carried: 0, due: 500 });
    // The payment is listed in this month, and says which month it pays.
    await switchTab(page, 'pageStaff');
    await page.locator('[data-action="invAttView"][data-view="pay"]').click();
    const monthName = await g(page, `_monthLabel('${last}')`);
    await expect(page.locator('[data-payment="P1"]')).toContainText('for ' + monthName);
  });

  test('G3-2: a modelled month\'s salary paid on the 14th of a slip month is not owed for ever', async ({ page }) => {
    const a = ymAdd(last, -1);
    const att: Record<string, any> = {};
    ['-03', '-04', '-05'].forEach(d => { att[a + d] = { marks: { 8: { st: 'P', hours: 8, ot: 0, area: 'vat-a1' } }, extra: [], note: '' }; });
    await loadAppWithState(page, book({ staff: HAND, attendance: att,
      payrollPaid: [{ id: 'PRL-1', month: last, status: 'paid', source: 'slip', at: 1, rows: [{ name: 'Arun Das', worked: 26, dayPay: 13000, ot: 0 }] }] }));
    const earnedA = await g(page, `labourForRange('${a}-01', payMonthEnd('${a}-01')).byWorker[8].total`);
    await g(page, `S.staffPayments.push({ id: 'P1', staffId: 8, date: '${last}-14', amount: ${earnedA}, kind: 'payment', note: '', at: 1 })`);
    // It carried the whole of it as "owed from before": the slip month skipped the payment made in it for the month before.
    expect(await row(page)).toMatchObject({ carried: 0, due: 0 });
    // An advance is the month it is given in, whatever the day.
    await g(page, `S.staffPayments.push({ id: 'P2', staffId: 8, date: '${pm}-05', amount: 200, kind: 'advance', note: '', at: 2 })`);
    expect(await row(page)).toMatchObject({ paid: 200, due: -200 });
  });

  test('G3-8: a slip row only guessed to be a hand costs the month once, and settles that hand\'s month on Pay', async ({ page }) => {
    const m = ymAdd(last, -1);
    const att: Record<string, any> = {};
    ['-03', '-04', '-05', '-06', '-07'].forEach(d => { att[m + d] = { marks: { 1: { st: 'P', hours: 8, ot: 0, area: 'vat-a1' } }, extra: [], note: '' }; });
    await loadAppWithState(page, book({ attendance: att,
      staff: [{ id: 1, name: 'Ramu Singh', comp: 'monthly', area: 'vat-a1', dayRate: 500, active: true, onFloor: true }],
      payrollPaid: [{ id: 'PRL-1', month: m, status: 'paid', source: 'slip', at: 1, rows: [{ name: 'Ramu Sinha', worked: 26, dayPay: 13000, ot: 0 }] }] }));
    expect(await g(page, `(function(){ var p = payrollMatch({ name: 'Ramu Sinha' }); return [p.w.name, p.sure]; })()`)).toEqual(['Ramu Singh', false]);
    const l = await g(page, `(function(){ var l = labourForRange('${m}-01', payMonthEnd('${m}-01')); return [l.fixed, !!l.byWorker[1], l.paidGuess[1]]; })()`);
    // It read 15,500: the slip's 13,000 under the name as written and Ramu's 2,500 from the marks, the same hand twice.
    expect(l).toEqual([13000, false, 'Ramu Sinha']);
    const week = `${m}-08`;
    const r = await g(page, `(function(){ var r = payDue(attWeekStartOf('${week}')).rows.find(function(x){ return x.w.id === 1; }); return r ? { due: r.due, asPaid: !!r.asPaid, as: r.asPaidAs } : null; })()`);
    expect(r).toMatchObject({ due: 0, asPaid: true, as: 'Ramu Sinha' });
  });
});

test.describe('P124: the roster, the ledger and the Day', () => {
  test('G3-9: a merge moves a cleared balance, and a worker named by one is not deleted', async ({ page }) => {
    await loadAppWithState(page, book({
      staff: [{ id: 1, name: 'Shyam', comp: 'hourly', hourRate: 50, area: 'vat-a1', active: true },
        { id: 2, name: 'Shyam Bera', comp: 'hourly', hourRate: 50, area: 'vat-a1', active: true },
        { id: 3, name: 'Tara', comp: 'hourly', hourRate: 50, area: 'barrel', active: true }],
      payCarryClears: [{ id: 'PCC-1', staffId: 1, through: iso(-10), amount: 500, reason: 'Paid in cash', at: 1 },
        { id: 'PCC-2', staffId: 3, through: iso(-10), amount: 200, reason: 'Paid in cash', at: 1 }],
    }));
    expect(await g(page, `mergeWorkers(1, 2).clears`)).toBe(1);
    expect(await g(page, `S.payCarryClears.map(function(c){ return c.staffId; })`)).toEqual([2, 3]);
    expect(await g(page, `_attPayRefs(3)`)).toBe(1);
    await switchTab(page, 'pageStaff');
    await page.locator('[data-action="invAttView"][data-view="roster"]').click();
    await page.locator('[data-action="invAttEditWorker"][data-id="3"]').click();
    await page.locator('[data-action="invAttDeleteWorker"][data-id="3"]').click();
    await expect(page.locator('.inv-toast')).toContainText('1 payment names Tara');
    expect(await g(page, `S.staff.length`)).toBe(2);
  });

  test('G3-10: an exception explained again or reopened is kept, stamped, and History says so', async ({ page }) => {
    await loadAppWithState(page, book());
    const d = { iso: iso(-3), scope: 'block', key: '17:00-00:00', kind: 'differs', label: 'Block 5 PM – 12 AM', expected: 14, booked: 21 };
    await g(page, `recordExtraException(${JSON.stringify(d)}, 'first look'); recordExtraException(${JSON.stringify(d)}, 'second look')`);
    let ex = await g(page, 'S.extraExceptions') as any[];
    expect(ex.map((x: any) => [x.reason, !!x.supersededAt])).toEqual([['first look', true], ['second look', false]]);
    expect(await g(page, `_partitionExceptions([${JSON.stringify(d)}]).acked.map(function(a){ return a.x.reason; })`)).toEqual(['second look']);
    await g(page, `removeExtraException(exceptionKey(${JSON.stringify(d)}))`);
    ex = await g(page, 'S.extraExceptions') as any[];
    expect(ex).toHaveLength(2);
    expect(!!ex[1].reopenedAt).toBe(true);
    expect(await g(page, `_partitionExceptions([${JSON.stringify(d)}]).open.length`)).toBe(1);
    const texts = await g(page, `buildHistoryEvents().filter(function(e){ return e.kind === 'except'; }).map(function(e){ return e.text; })`) as string[];
    expect(texts.some(t => t.includes('first look') && t.includes('explained again since'))).toBe(true);
    expect(texts.some(t => t.startsWith('Extra-hours exception reopened') && t.includes('second look'))).toBe(true);
  });

  test('G3-11: a hand who has left is on the Day board and the Week grid for a day they were marked', async ({ page }) => {
    const day = todayIso();
    await loadAppWithState(page, book({
      staff: STAFF.concat([{ id: 9, name: 'GOLU', comp: 'hourly', area: 'barrel', hourRate: 50, active: false, onFloor: true } as any]),
      attendance: { [day]: { marks: { 9: { st: 'P', hours: 8, ot: 0, area: 'barrel' } }, extra: [], note: '' } },
    }));
    await openDay(page, day);
    const row = page.locator('[data-att-area-card="barrel"] [data-att-row="9"]');
    await expect(row).toContainText('left');
    // Correctable: marked absent from the board.
    await row.locator('[data-action="invAttSet"][data-st="A"]').click();
    expect((await readStoredState(page)).attendance[day].marks[9].st).toBe('A');
    await openAttendance(page, 'week');
    await expect(page.locator('#attWeekGrid tr[data-left]')).toContainText('GOLU');
  });

  test('G3-12: a civil hand prints under Civil on Shyam\'s sheet, not "No line written"', async ({ page }) => {
    await loadAppWithState(page, book({
      staff: STAFF.concat([{ id: 6, name: 'FOXY', comp: 'hourly', area: 'civil', hourRate: 45, active: true, onFloor: false } as any]),
      attendance: { [iso()]: { marks: { 6: { st: 'P', hours: 8, ot: 0, area: 'civil' }, 1: { st: 'P', hours: 8, ot: 0, area: 'vat-a1' } }, extra: [], note: '' } },
    }));
    await g(page, `document.getElementById('invPrintBody').innerHTML = attSheetShyamHtml('${iso()}', attSheetFillFor('${iso()}'))`);
    const front = page.locator('[data-sheet="shyam-in"]');
    await expect(front.locator('.inv-as-box-h', { hasText: 'No line written' })).toHaveCount(0);
    const box = front.locator('.inv-as-box').filter({ has: page.locator('.inv-as-box-h', { hasText: 'Civil' }) });
    await expect(box).toContainText('FOXY');
  });
});

test.describe('P124: read the rolls again', () => {
  /* The day as the old reader saved it from the two rolls: ALFA and BRAVO in at 8 PM and out at 5 PM the next day, the
     general shift's EXTRA a block from 5 PM (twice: the in-time roll was in the paste two times), the span read as 5 h.
     CHARU was corrected by hand, and one EXTRA row was entered by hand. */
  function brokenDay() {
    const day = iso();
    return {
      attendance: { [day]: {
        marks: {
          1: { st: 'P', ot: 13, hours: 21, area: 'vat-a1', inMin: 1200, outMin: 2460, outKnown: true, src: 'relay' },
          2: { st: 'P', ot: 0, hours: 24, area: 'vat-a1', inMin: 1200, outMin: 2640, outKnown: true, src: 'relay' },
          3: { st: 'P', ot: 0, hours: 9, area: 'barrel', inMin: 510, outMin: 1080, outKnown: true },
          4: { st: 'A', ot: 0, hours: 0, area: 'flex', inMin: null, outMin: null, outKnown: true, src: 'relay' },
        },
        extra: [
          { kind: 'block', areas: ['vat-a1'], crew: [1, 2], hours: 8, from: '17:00', to: '', area: 'vat-a1', src: 'relay', srcHead: 'VAT A 1', srcAt: 'in 20:00', srcAreas: ['vat-a1'], srcFrom: '17:00', srcTo: '' },
          { kind: 'block', areas: ['vat-a1'], crew: [1, 2], hours: 8, from: '17:00', to: '', area: 'vat-a1', src: 'relay', srcHead: 'VAT A 1', srcAt: 'in 20:00', srcAreas: ['vat-a1'], srcFrom: '17:00', srcTo: '' },
          { kind: 'block', areas: ['vat-a1'], crew: [2], hours: 5, from: '17:00', to: '20:00', area: 'vat-a1', src: 'relay', srcHead: 'VAT A 1', srcAt: 'out 20:00', srcAreas: ['vat-a1'], srcFrom: '17:00', srcTo: '20:00' },
          { kind: 'coverage', area: 'barrel', hours: 4 },
        ],
        note: 'Kept by hand',
      } },
      relayPastes: [
        { id: 'RP-1', at: 10, hash: 'x1', sentBy: '', sentOn: '', kind: 'in', date: day, text: IN_8PM() },
        { id: 'RP-2', at: 10, hash: 'x1', sentBy: '', sentOn: '', kind: 'in', date: day, text: IN_8PM() },
        { id: 'RP-3', at: 20, hash: 'x3', sentBy: '', sentOn: '', kind: 'out', date: day, text: OUT_SPAN() },
      ],
    };
  }

  test('the day\'s rolls are read again: the rolls\' marks and rows are replaced, what was entered by hand is kept, the old day is logged', async ({ page }) => {
    await loadAppWithState(page, book(brokenDay()));
    await openDay(page, iso());
    await toolbarMore(page, 'Read the rolls again');   // Day's More (TM4b)
    // Asked first; Cancel leaves the day as it is.
    expect(await answerAsk(page, 'cancel')).toContain('3 rolls saved for');
    await expect(page.locator('#relayRereadNote')).toHaveCount(0);
    await toolbarMore(page, 'Read the rolls again');   // Day's More (TM4b)
    await answerAsk(page, 'ok');
    await expect(page.locator('#relayRereadNote')).toContainText('3 rolls saved for');
    // Saved rolls are not refused as already saved; the one posted twice is read once.
    await expect(page.locator('#relayDupNote')).toHaveCount(0);
    await expect(page.locator('#relayRepeatNote')).toContainText('1 message repeats one earlier in the day');
    const alfa = page.locator('[data-relay-row]').filter({ hasText: 'ALFA' });
    await expect(alfa).toContainText('Updated');
    await expect(alfa).toContainText('Was 8 PM – 5 PM (next day) · 21 h · OT 13 h');
    await expect(page.locator('[data-relay-row]').filter({ hasText: 'CHARU' })).toContainText('Kept');
    await expect(page.locator('[data-relay-replaced]')).toHaveCount(3);
    await expect(page.locator('#relayIssues')).toContainText('no hours written');
    await page.locator('[data-action="invRelaySave"]').click();
    await expect(page.locator('[data-action="invRelaySave"]')).toHaveCount(0);

    const s = await readStoredState(page);
    const d = s.attendance[iso()];
    expect(d.marks[1]).toMatchObject({ st: 'P', area: 'vat-a1', hours: 8, ot: 0, inMin: 510, outMin: 1020, src: 'relay' });
    expect(d.marks[2]).toMatchObject({ area: 'vat-a1', hours: 11, inMin: 510, outMin: 1200, src: 'relay' });
    expect(d.marks[3]).toEqual({ st: 'P', ot: 0, hours: 9, area: 'barrel', inMin: 510, outMin: 1080, outKnown: true });
    expect(d.marks[4]).toMatchObject({ st: 'A', src: 'relay' });
    // The hand-entered row stays; the rolls' rows are the general shift's coverage once, and the span's block at 0 h.
    expect(d.extra.map((x: any) => [x.kind, x.area, x.hours, x.src || 'hand'])).toEqual([
      ['coverage', 'barrel', 4, 'hand'], ['coverage', 'vat-a1', 8, 'relay'], ['block', 'vat-a1', 0, 'relay']]);
    expect(d.note).toBe('Kept by hand');
    // The day as it was, whole, in the log with the reason; the rolls are still on record, once each as saved.
    expect(s.attendanceDeletes).toHaveLength(1);
    expect(s.attendanceDeletes[0]).toMatchObject({ key: iso(), reason: 'read the rolls again', how: 'reread', marks: 4, extra: 4 });
    expect(s.attendanceDeletes[0].day.marks['1'].hours).toBe(21);
    expect(s.relayPastes).toHaveLength(3);
    await expect(page.locator('#attDate')).toHaveValue(iso());
    await switchTab(page, 'pageHistory');
    await expect(page.locator('#pageHistory')).toContainText('Attendance day read again from its rolls');
  });

  test('a day with no roll saved has no Read the rolls again; back from the check leaves Paste message empty', async ({ page }) => {
    await loadAppWithState(page, book(brokenDay()));
    await openDay(page, iso(-2));
    expect(await toolbarMoreLabels(page)).not.toContain('Read the rolls again');
    await openDay(page, iso());
    await toolbarMore(page, 'Read the rolls again');   // Day's More (TM4b)
    await answerAsk(page, 'ok');
    await page.locator('[data-action="invRelayRereadBack"]').click();
    await expect(page.locator('#attDate')).toHaveValue(iso());
    expect((await readStoredState(page)).attendanceDeletes || []).toHaveLength(0);
    await page.locator('[data-action="invAttView"][data-view="paste"]').first().click();
    await expect(page.locator('#relayPasteText')).toBeVisible();
  });
});
