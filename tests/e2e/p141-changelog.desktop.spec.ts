import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { loadAppWithState, switchTab, todayIso } from './fixtures';
import { problems, sweep, sweepState, walkPages, type Stop } from './sweep-fixture';

// P141 (desktop): the change log on the desktop's History table, the sweep's checks on its rows and its Who filter,
// nothing logged by drawing every page, and what the comparison costs a save: on the sweep book, and on a book of about
// 4 MB (the sweep book copied with fresh ids, about the size of the real one). Every name is made up.

const g = (p: Page, expr: string) => p.evaluate(e => (0, eval)(e), expr);

function book() {
  const s: any = sweepState();
  // Two IDs and no owner: the gate (guard.js) stays off; its signed-in user is stood in for below.
  s.users = [{ id: 'u-asha', name: 'Asha', role: 'office', active: true, createdAt: 1 }, { id: 'u-ravi', name: 'Ravi', role: 'supervisor', active: true, createdAt: 1 }];
  s.devices = [{ id: 'dev-office', name: 'Office PC' }];
  return s;
}
async function as(page: Page, userId: string | null) {
  await page.evaluate(id => { (window as any).grdUserId = () => id; (window as any).devId = () => 'dev-office'; }, userId);
}

/* What chgOnSave costs a save, by the kind of change it finds: each kind made RUNS times, its median and its slowest,
   in ms. This machine is shared with other builds, so a single save can be held up by them: the kinds take turns (a burst
   of load falls on all of them, not on one), and the median is the cost. */
const RUNS = 7;
const KINDS: Array<[string, string]> = [
  ['an invoice line\'s rate', 'S.invoices[S.invoices.length - 1].items[0].rate = 13 + Math.random()'],
  ['a challan\'s note', "S.incomingMaterial[0].notes = 'n' + Math.random()"],
  ['a stock entry', 'S.stock.entries[S.stock.entries.length - 1].qty = Math.random()'],
  ['a setting', 'S.labour.otCap = 60 + Math.random()'],
  ['an attendance mark', 'var d = Object.keys(S.attendance)[0]; S.attendance[d].marks[1].hours = Math.random()'],
  ['a task added', "S.todo.tasks.push({ id: 'TT' + Math.random(), text: 'A task', due: '', note: '', link: null, createdAt: Date.now(), doneAt: null })"],
  ['a statement row sorted', "S.bank.rows[0].set = { cat: 'c' + Math.random() }"],
  ['nothing', '0'],
];
type Timing = { kind: string; min: number; median: number; max: number };
async function timeSaves(page: Page): Promise<Timing[]> {
  return page.evaluate(([kinds, runs]) => {
    const ks = kinds as Array<[string, string]>, each: number[][] = ks.map(() => []);
    for (let i = 0; i < (runs as number); i++) ks.forEach(([, m], j) => {
      (0, eval)(m);
      const t0 = performance.now();
      (0, eval)('chgOnSave()');
      each[j].push(performance.now() - t0);
    });
    return ks.map(([kind], j) => {
      const s = each[j].sort((a, b) => a - b);
      return { kind, min: s[0], median: s[Math.floor(s.length / 2)], max: s[s.length - 1] };
    });
  }, [KINDS, RUNS] as const);
}
const said = (ts: Timing[]) => ts.map(t => `${t.kind} ${t.median.toFixed(1)} (fastest ${t.min.toFixed(1)}, slowest ${t.max.toFixed(1)})`).join('; ');

test.describe('P141 desktop: the change log', () => {
  test('History\'s table lists the changes with who and what; the sweep finds nothing wrong with them', async ({ page }) => {
    await loadAppWithState(page, book());
    await as(page, 'u-asha');
    await g(page, "S.clients[0].notes = 'Pays by cheque'; saveState()");
    await as(page, 'u-ravi');
    await g(page, "S.stock.entries.find(function(e) { return e.id === 'u3'; }).voided = { at: Date.now(), by: '' }; saveState()");
    await g(page, "S.changeLogDropped = { n: 1204, before: Date.now() - 200 * 86400000 }");
    await switchTab(page, 'pageHistory');
    await page.locator('#historyToolbar [data-action="invHistoryType"][data-type="change"]').click();
    const table = page.locator('#historyList table.inv-table.inv-table-history');
    await expect(table.locator('thead th')).toHaveText(['Time', 'Event', 'Kind', 'Amount']);
    const rows = table.locator('tr[data-ev="chg"]');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('Ravi voided stock entry Nitric acid · used · 2 L');
    await expect(rows.nth(0).locator('.inv-dot-danger')).toHaveText('Voided');
    await expect(rows.nth(1)).toContainText('Asha changed client ALPHA FORGINGS PRIVATE LIMITED · notes — → Pays by cheque');
    await expect(rows.nth(1).locator('td').first()).toContainText('on Office PC');
    await expect(page.locator('#historyList [data-chg-dropped]')).toHaveText(/^1,204 older changes were dropped to keep the book small/);
    await expect(page.locator('#historyToolbar select#historyWho option')).toHaveText(['Everyone', 'Asha', 'Ravi', 'No ID']);
    const stops: Stop[] = [await sweep(page, 'History › Changes')];
    await page.locator('#historyToolbar select#historyWho').selectOption('u-ravi');
    await expect(rows).toHaveCount(1);
    stops.push(await sweep(page, 'History › Changes › Ravi'));
    expect(problems(stops)).toEqual([]);
  });

  test('drawing every page and view logs nothing', async ({ page }) => {
    test.setTimeout(180000);
    await loadAppWithState(page, sweepState());
    const stops: Stop[] = [];
    await walkPages(page, 'p141', stops);
    await g(page, 'chgOnSave()');
    expect(await g(page, 'S.changeLog')).toEqual([]);
  });

  test('what the comparison costs a save: the sweep book, and a book of about 4 MB', async ({ page }) => {
    test.setTimeout(180000);
    await loadAppWithState(page, sweepState());
    const small = await g(page, 'JSON.stringify(S).length') as number;
    const sweepT = await timeSaves(page);
    console.log(`P141 timing · sweep book ${(small / 1024).toFixed(0)} KB, ms per save, median of ${RUNS}: ${said(sweepT)}`);
    for (const t of sweepT) expect(t.median, t.kind).toBeLessThan(40);

    // The sweep book copied with fresh ids until it is about 4 MB, then taken as the book opened (the boot's baseline).
    const built = await g(page, `(function() {
      var base = JSON.parse(JSON.stringify(S)), c = 0;
      var copy = function(x) { return JSON.parse(JSON.stringify(x)); };
      while (JSON.stringify(S).length < 4.2e6) {
        c++;
        base.invoices.forEach(function(r) { var x = copy(r); x.id = r.id + '~' + c; x.invoiceNumber = String(1000 * c + Number(r.invoiceNumber)); x.displayNumber = 'SEP/TEST-' + x.invoiceNumber; S.invoices.push(x); });
        base.incomingMaterial.forEach(function(r) { var x = copy(r); x.id = r.id + '~' + c; x.challanNo = r.challanNo + '/' + c; x.items.forEach(function(it, i) { it.id = x.id + '-' + i; }); S.incomingMaterial.push(x); });
        base.production.entries.forEach(function(r) { var x = copy(r); x.id = r.id + '~' + c; S.production.entries.push(x); });
        base.stock.entries.forEach(function(r) { var x = copy(r); x.id = r.id + '~' + c; S.stock.entries.push(x); });
        base.bank.rows.forEach(function(r) { var x = copy(r); x.id = r.id + '~' + c; S.bank.rows.push(x); });
        base.quotations.forEach(function(r) { var x = copy(r); x.id = r.id + '~' + c; S.quotations.push(x); });
        Object.keys(base.attendance).forEach(function(d) { S.attendance[isoAddDays(d, -14 * c)] = copy(base.attendance[d]); });
      }
      var t0 = performance.now();
      chgBaseline();
      return { bytes: JSON.stringify(S).length, copies: c, baselineMs: performance.now() - t0, invoices: S.invoices.length, challans: S.incomingMaterial.length };
    })()`) as any;
    // The book just built is a lot of garbage for the collector: let it settle before anything is timed.
    await page.waitForTimeout(1500);
    const since = await g(page, 'Date.now()') as number;
    const bigT = await timeSaves(page);
    // For scale: what the save itself spends turning the same book into its one string, the median of five.
    const saveMs = await g(page, `(function() { var r = []; for (var i = 0; i < 5; i++) { var t0 = performance.now(); JSON.stringify(S); r.push(performance.now() - t0); }
      r.sort(function(a, b) { return a - b; }); return r[2]; })()`) as number;
    console.log(`P141 timing · 4 MB book ${(built.bytes / 1048576).toFixed(2)} MB (${built.copies} copies, ${built.invoices} invoices, ${built.challans} challans): ` +
      `starting point ${built.baselineMs.toFixed(1)} ms; ms per save, median of ${RUNS}: ${said(bigT)}; the save's own JSON.stringify of the book ${saveMs.toFixed(1)} ms`);
    expect(built.bytes).toBeGreaterThan(4e6);
    for (const t of bigT) expect(t.median, t.kind).toBeLessThan(150);
    // Each change made was logged (a change to the same record within the minute is one entry), and nothing else.
    const entries = (await g(page, `S.changeLog.filter(function(e) { return e.at >= ${since}; })`)) as any[];
    expect(new Set(entries.map(e => e.coll))).toEqual(new Set(['invoices', 'incomingMaterial', 'stock.entries', 'labour', 'attendance', 'todo.tasks', 'bank.rows']));
  });
});
