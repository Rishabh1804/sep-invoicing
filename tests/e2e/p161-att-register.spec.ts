import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, type SepState } from './fixtures';

// P161: the monthly register (owner, 6 Oct 2026). The attendance book kept by hand, a page a month, is kept as written,
// read in code and set against the day as the app holds it. Made-up names in the shop's shapes; the month is fixed in the
// past, so nothing here depends on today.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);
const M = '2026-02';
const staff = [
  { id: 1, name: 'Ramu Oraon', comp: 'monthly', dayRate: 500, area: 'vat-a1', active: true },
  { id: 2, name: 'Bishu - B.K. Lohar', comp: 'monthly', dayRate: 500, area: 'barrel', active: true },
  { id: 3, name: 'Gopal Hansda', comp: 'hourly', hourRate: 50, area: 'vat-a2', active: true }
];
function book(extra: any = {}): SepState {
  const s: any = emptyState();
  s.incomingMaterial = noSeedIM();
  s.staff = staff;
  // The day as the app holds it: 2 Feb both present (Ramu with times 6 AM – 5 PM, OT 3), 3 Feb Ramu absent, Bishu present.
  s.attendance = {
    '2026-02-02': { marks: { 1: { st: 'P', area: 'vat-a1', inMin: 360, outMin: 1020, hours: 11, ot: 3 }, 2: { st: 'P', area: 'barrel', hours: 8, ot: 0 } }, extra: [], note: '' },
    '2026-02-03': { marks: { 1: { st: 'A', area: 'flex', hours: 0, ot: 0 }, 2: { st: 'P', area: 'barrel', hours: 8, ot: 0 } }, extra: [], note: '' }
  };
  return Object.assign(s, extra);
}
const day = (date: string, cells: string[], kind = 'work') => ({ date, written: date.slice(8) + '-2', kind, cells: cells.map(raw => ({ raw })) });
const page1 = () => ({ kind: 'sep-att-register', version: 1, months: [{ month: M, title: 'FEB - 2026', columns: ['RAMU', 'BISHU'],
  days: [
    day('2026-02-01', ['S', 'U'], 'sunday'),
    day('2026-02-02', ['6am-5pm', 'p-8pm']),   // Ramu agrees; Bishu's OT 3 against the day's 0
    day('2026-02-03', ['P', 'P']),             // Ramu differs (the day says absent); Bishu agrees
    day('2026-02-04', ['6am-8pm', 'A']),       // the day holds nothing: only on the register
    Object.assign(day('2026-02-05', ['p-6am', 'H']), { cells: [{ raw: 'p-6am', unsure: true }, { raw: 'H' }] })
  ],
  totals: [{ col: 0, raw: 'OT-22' }, { col: 1, raw: 'OT-3' }], notes: ['a made-up page'] }] });

test.describe('P161 the monthly register', () => {
  test('a cell is read in the shop’s notation, and its hours by the roll’s rule', async ({ page }) => {
    await loadAppWithState(page, book());
    const r: any = await g(page, `(function () {
      var w = { comp: 'monthly' }, f = function (raw, kind) { var c = aregCell(raw, kind); return c ? [c.st, c.inMin == null ? null : c.inMin, c.outMin == null ? null : c.outMin, aregHours(c, w).ot, !!c.unread] : null; };
      return { p: f('P'), a: f('A'), h: f('H'), p8: f('p-8pm'), am: f('6am-5pm'), mid: f('6am-12am'), night: f('P-6Am'), half: f('8:30am-2pm'), six: f('6am'),
        dash: f('—'), blank: f(''), sunA: f('A', 'sunday'), sunP: f('6am-2pm', 'sunday'), bad: f('P-?'), dot: f('P.'), two: f('6am-8pm / 6am-2pm') };
    })()`);
    expect(r.p).toEqual(['P', null, null, 0, false]);
    expect(r.a).toEqual(['A', null, null, 0, false]);
    expect(r.h).toEqual(['H', null, null, 0, false]);
    expect(r.p8).toEqual(['P', 510, 1200, 3, false]);      // 8:30 AM – 8 PM, 11½ h floored to 11: OT 3
    expect(r.am).toEqual(['P', 360, 1020, 3, false]);
    expect(r.mid).toEqual(['P', 360, 1440, 10, false]);
    expect(r.night).toEqual(['P', 510, 1800, 13, false]);   // through the night to 6 AM
    expect(r.half).toEqual(['P', 510, 840, 0, false]);
    expect(r.six).toEqual(['P', 360, null, 3, false]);
    expect(r.dash).toBeNull();
    expect(r.blank).toBeNull();
    expect(r.sunA).toBeNull();                            // the A of SUNDAY is the line, never an absence
    expect(r.sunP).toEqual(['P', 360, 840, 0, false]);
    expect(r.bad[4]).toBe(true);
    expect(r.dot).toEqual(['P', null, null, 0, false]);
    expect(r.two).toEqual(['P', 360, 1200, 6, false]);
  });

  test('an imported page is set against the day, cell by cell, and its totals against the cells', async ({ page }) => {
    await loadAppWithState(page, book());
    const res: any = await g(page, `aregImportData(${JSON.stringify(page1())})`);
    expect(res).toMatchObject({ added: 1, kept: 0 });
    const c: any = await g(page, `(function () { var k = aregCompare(aregMonthOf('${M}')); return { n: k.n, unsure: k.unsure, cols: k.cols.map(function (x) { return [x.name, x.w && x.w.id, x.ot]; }) }; })()`);
    expect(c.cols).toEqual([['RAMU', 1, 22], ['BISHU', 2, 3]]);   // a first name nobody else has; the dash's left side
    expect(c.n).toEqual({ agree: 2, state: 1, ot: 1, reg: 4, day: 0 });
    expect(c.unsure).toBe(1);
    // The same file again keeps the page as it is.
    expect(await g(page, `aregImportData(${JSON.stringify(page1())}).kept`)).toBe(1);

    await g(page, `_aregMonth = '${M}'; _attView = 'register'; saveState()`);
    await switchTab(page, 'pageStaff');
    const grid = page.locator('#aregGrid');
    // A cell that agrees asks nothing and is drawn plain, so the cells to act on stand out (TM4b); its label still says so.
    await expect(grid.locator('[data-d="1"][data-c="0"]')).toHaveClass('inv-cell');
    await expect(grid.locator('[data-d="1"][data-c="0"]')).toHaveAttribute('aria-label', /Agrees with the day/);
    await expect(grid.locator('[data-d="2"][data-c="0"]')).toHaveClass(/inv-cell-danger/);
    await expect(grid.locator('[data-d="1"][data-c="1"]')).toHaveClass(/inv-cell-warning/);
    await expect(grid.locator('[data-d="4"][data-c="0"]')).toHaveAttribute('data-unsure', '');
    await expect(page.locator('[data-areg-diff]')).toHaveCount(2);
    await expect(page.locator('[data-card="areg-totals"]')).toContainText('matches the cells');
    await expect(page.locator('[data-tile="reg"]')).toContainText('4');
  });

  test('Fill puts what only the register holds onto its days, asked first, the unsure left out', async ({ page }) => {
    await loadAppWithState(page, book());
    await g(page, `aregImportData(${JSON.stringify(page1())}); _aregMonth = '${M}'; _attView = 'register'; saveState()`);
    await switchTab(page, 'pageStaff');
    await page.locator('[data-action="invAregFill"]').click();
    await answerAsk(page, 'ok');
    await expect(page.locator('[data-tile="reg"]')).toContainText('1');
    const st: any = await readStoredState(page);
    expect(st.attendance['2026-02-04'].marks[1]).toMatchObject({ st: 'P', inMin: 360, outMin: 1200, hours: 14, ot: 6, src: 'register', area: 'vat-a1' });
    expect(st.attendance['2026-02-04'].marks[2]).toMatchObject({ st: 'A', src: 'register' });
    expect(st.attendance['2026-02-05'].marks[2]).toMatchObject({ st: 'H', hours: 4, src: 'register' });
    expect(st.attendance['2026-02-05'].marks[1]).toBeUndefined();   // the unsure cell waits for a look
    // A mark already on a day is never touched by Fill.
    expect(st.attendance['2026-02-03'].marks[1].st).toBe('A');
  });

  test('a cell is settled either way, and a correction keeps what the page said', async ({ page }) => {
    await loadAppWithState(page, book());
    await g(page, `aregImportData(${JSON.stringify(page1())}); _aregMonth = '${M}'; _attView = 'register'; saveState()`);
    await switchTab(page, 'pageStaff');
    // Ramu, 3 Feb: the register says present, the day absent. The day takes the register's.
    await page.locator('#aregGrid [data-d="2"][data-c="0"]').click();
    await expect(page.locator('[data-areg-cell]')).toContainText('Differs from the day');
    await page.locator('[data-action="invAregToDay"]').click();
    await expect(page.locator('[data-areg-cell]')).toContainText('Agrees with the day');
    // Bishu, 2 Feb: the register's OT differs; the register takes the day's (a P with no times).
    await page.locator('[data-action="invAregCellClose"]').click();
    await page.locator('#aregGrid [data-d="1"][data-c="1"]').click();
    await page.locator('[data-action="invAregFromDay"]').click();
    await expect(page.locator('[data-areg-raw]')).toHaveValue('P');
    const st: any = await readStoredState(page);
    expect(st.attendance['2026-02-03'].marks[1]).toMatchObject({ st: 'P', src: 'register', hours: 8 });
    const cell = st.attRegister.months[M].days[1].cells[1];
    expect(cell.raw).toBe('P');
    expect(cell.edits[0]).toMatchObject({ from: 'p-8pm', to: 'P' });
    // An unsure cell, typed over, is no longer unsure; Reads right clears one left as it is.
    await page.locator('[data-action="invAregCellClose"]').click();
    await page.locator('#aregGrid [data-d="4"][data-c="0"]').click();
    await page.locator('[data-action="invAregSure"]').click();
    await expect(page.locator('#aregGrid [data-d="4"][data-c="0"]')).not.toHaveAttribute('data-unsure', '');
  });

  test('a page started by hand has a column per monthly hand, and is filled a tap a day', async ({ page }) => {
    await loadAppWithState(page, book());
    await g(page, `_aregMonth = '2026-03'; _attView = 'register'`);
    await switchTab(page, 'pageStaff');
    await page.locator('[data-action="invAregStart"]').click();
    const mo: any = await g(page, `aregMonthOf('2026-03')`);
    expect(mo.columns.map((c: any) => c.staffId).sort()).toEqual([1, 2]);   // the hourly hand is not on the monthly register
    expect(mo.days).toHaveLength(31);
    expect(mo.days[0].kind).toBe('sunday');                          // 1 Mar 2026 is a Sunday
    await page.locator('#aregGrid [data-d="1"][data-c="0"]').click();
    await page.locator('[data-action="invAregQuick"][data-v="P"]').click();
    await page.locator('[data-action="invAregNext"]').click();
    await page.locator('[data-areg-raw]').fill('6am-5pm');
    await page.locator('[data-areg-raw]').press('Tab');
    const after: any = await g(page, `aregMonthOf('2026-03').days.slice(1, 3).map(function (d) { return d.cells[0]; })`);
    expect(after).toEqual([{ raw: 'P' }, { raw: '6am-5pm' }]);   // a page written by hand keeps no correction trail
  });

  test('a column’s worker picked once is found again on the next page under the same heading', async ({ page }) => {
    await loadAppWithState(page, book());
    const f = page1();
    f.months[0].columns = ['R.O', 'BISHU'];
    const next = JSON.parse(JSON.stringify(f));
    next.months[0].month = '2026-01';
    next.months[0].days = [day('2026-01-05', ['P', 'P'])];
    await g(page, `aregImportData(${JSON.stringify(f)}); _aregMonth = '${M}'; _attView = 'register'; saveState()`);
    await switchTab(page, 'pageStaff');
    await expect(page.locator('[data-tile="unsure"]')).toContainText('1 column with no worker');
    await page.locator('[data-action="invAregCol"][data-c="0"]').click();
    await page.locator('[data-areg-pick="0"]').selectOption('1');
    expect(await g(page, `aregColWorker(aregMonthOf('${M}'), 0).id`)).toBe(1);
    await g(page, `aregImportData(${JSON.stringify(next)})`);
    expect(await g(page, `aregColWorker(aregMonthOf('2026-01'), 0).id`)).toBe(1);
  });

  test('no page photo: the month has no photo door, and a month read from a photo before keeps its unsure cell asked', async ({ page }) => {
    // The page photo, read by Gemini, came out (owner, 13 Oct 2026: "it simply never works"); a month read that way stays as read.
    await loadAppWithState(page, book());
    await g(page, `(function () { var mo = aregCleanMonth({ month: '2026-04', title: 'APRIL', columns: [{ name: 'RAMU' }],
      days: [{ date: '2026-04-01', written: '1-4', kind: 'work', cells: [{ raw: 'P-8pm', unsure: true }] }], totals: [] }, 'photo');
      aregData().months['2026-04'] = mo; _aregMonth = '2026-04'; saveState(); return true; })()`);
    expect(await g(page, `aregMonthOf('2026-04').days[0].cells[0]`)).toEqual({ raw: 'P-8pm', unsure: true });
    expect(await g(page, `typeof aregPhoto + typeof aregPhotoRead + typeof geminiReadImage`)).toBe('undefinedundefinedundefined');
  });

  test('an import fills a page started by hand and left blank; a page with anything written on it is kept', async ({ page }) => {
    // Owner, 12 Nov 2026: Start this month had been pressed for a month and nothing written; the month's transcribed file then
    // came back "already on record, kept", with no way to remove the blank page.
    await loadAppWithState(page, book());
    const r: any = await g(page, `(function () {
      aregData().months['${M}'] = aregBlankMonth('${M}', 'hand');
      var blank = aregMonthBlank(aregMonthOf('${M}'));
      var res = aregImportData(${JSON.stringify(page1())});
      var mo = aregMonthOf('${M}');
      return { blank: blank, res: res, src: mo.src, cols: mo.columns.map(function (c) { return c.name; }), first: mo.days[1].cells[0].raw };
    })()`);
    expect(r.blank).toBe(true);
    expect(r.res).toMatchObject({ added: 0, replaced: 1, kept: 0 });
    expect([r.src, r.cols, r.first]).toEqual(['import', ['RAMU', 'BISHU'], '6am-5pm']);

    // One cell written by hand: the page is somebody's work, and the file keeps off it.
    const k: any = await g(page, `(function () {
      var mo = aregBlankMonth('${M}', 'hand'); mo.days[2].cells[0].raw = 'P';
      aregData().months['${M}'] = mo;
      var res = aregImportData(${JSON.stringify(page1())});
      return { blank: aregMonthBlank(mo), res: res, src: aregMonthOf('${M}').src, raw: aregMonthOf('${M}').days[2].cells[0].raw };
    })()`);
    expect(k).toMatchObject({ blank: false, res: { added: 0, replaced: 0, kept: 1 }, src: 'hand', raw: 'P' });

    // A blank page that was marked checked, or carries a note, is kept too.
    const v: any = await g(page, `(function () {
      var a = aregBlankMonth('${M}', 'hand'); a.verifiedAt = 1;
      var b = aregBlankMonth('${M}', 'hand'); b.notes = ['a note'];
      var c = aregBlankMonth('${M}', 'hand'); c.days[0].cells[0].edits = [{ at: 1, by: '', from: 'P', to: '' }];
      return [aregMonthBlank(a), aregMonthBlank(b), aregMonthBlank(c)];
    })()`);
    expect(v).toEqual([false, false, false]);

    // Through the door the owner uses: the toast says the blank page was filled.
    await g(page, `aregData().months['${M}'] = aregBlankMonth('${M}', 'hand'); aregImportText(${JSON.stringify(JSON.stringify(page1()))}, 'feb.json')`);
    await expect(page.locator('.inv-toast').last()).toContainText('1 blank page filled');
  });

  test('a cell shows the day’s WhatsApp roll lines that name the hand, and settling it keeps them', async ({ page }) => {
    // Owner, 13 Nov 2026: "I don't see the relevant dated line of the whatsapp message to make an informed decision, that the app
    // can record and store for future references and reads." 3 Feb: the day holds Ramu absent, the register P; the saved in-time
    // roll names him on VAT A1. 2 Feb: no roll saved.
    const ROLL = `03/02/26/ in time
----8:30 AM---
---VAT A 1----
1) RAMU
---berral---
2) BISHU`;
    await loadAppWithState(page, book({ relayPastes: [{ id: 'RP-9', at: 10, hash: 'x9', sentBy: 'Alfa Oraon', sentOn: '2026-02-03', sentAt: 520, kind: 'in', date: '2026-02-03', text: ROLL }] }));
    await g(page, `aregImportData(${JSON.stringify(page1())}); _aregMonth = '${M}'; _attView = 'register'; saveState()`);
    const got: any = await g(page, `aregRollLines('2026-02-03', 1)`);
    expect(got.rolls.map((r: any) => [r.id, r.kind, r.sentBy, r.head, r.lines.map((l: any) => l.raw)])).toEqual([['RP-9', 'in', 'Alfa Oraon', '03/02/26/ in time', ['1) RAMU']]]);
    expect(got.reading.st).toBe('P');
    expect(await g(page, `aregRollLines('2026-02-02', 1).rolls.length`)).toBe(0);

    await switchTab(page, 'pageStaff');
    // The list of differences says what the roll reads beside the register and the day.
    const diff = page.locator('[data-card="areg-diff"]');
    await expect(diff.locator('[data-d="2"][data-c="0"]')).toContainText('the roll Present');
    await expect(diff.locator('[data-d="1"][data-c="1"]')).toContainText('no roll saved');

    // The cell: the roll's head, who sent it, and Ramu's line as written and as read; Bishu's line is not his.
    await page.locator('#aregGrid [data-d="2"][data-c="0"]').click();
    const rolls = page.locator('[data-areg-cell] [data-areg-rolls]');
    await expect(rolls.locator('[data-areg-roll]')).toContainText('In-time roll · Alfa Oraon');
    await expect(rolls.locator('[data-areg-roll]')).toContainText('“1) RAMU”');
    await expect(rolls.locator('[data-areg-roll]')).not.toContainText('BISHU');
    await expect(rolls).toContainText('The rolls alone read');

    // Settled: the day takes the register's, and the cell keeps what it was settled on, as it stood before the change.
    await page.locator('[data-areg-cell] [data-action="invAregToDay"]').click();
    await expect(page.locator('[data-areg-cell] [data-areg-settled]')).toContainText('the day took the register’s');
    await expect(page.locator('[data-areg-cell] [data-areg-settled]')).toContainText('“1) RAMU”');
    const st = await readStoredState(page);
    const cell = (st as any).attRegister.months[M].days[2].cells[0];
    expect(cell.settled).toHaveLength(1);
    expect(cell.settled[0]).toMatchObject({ way: 'day', register: 'P', day: 'Absent', rolls: [{ id: 'RP-9', kind: 'in', sentBy: 'Alfa Oraon', lines: ['1) RAMU'] }] });
    expect((st as any).attendance['2026-02-03'].marks[1]).toMatchObject({ st: 'P', src: 'register' });

    // A day with no roll saved says so in the cell.
    await page.locator('[data-areg-cell] [data-action="invAregCellClose"]').click();
    await page.locator('#aregGrid [data-d="1"][data-c="1"]').click();
    await expect(page.locator('[data-areg-cell] [data-areg-rolls]')).toContainText('No roll is saved for');
  });
});
