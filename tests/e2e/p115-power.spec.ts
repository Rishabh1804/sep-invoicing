import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, type SepState } from './fixtures';

// P115: Floor → Power (owner, 30 Sep 2026: "Make a power cut tab … find it, read it and update it"; "The case report
// should always be printable, and it should be dynamic"). The cuts are Production's downtime entries; the load is
// recorded; the case is a document drawn from the data each time it is shown or printed. Made-up names.

const g = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** A working day (not Sunday) `n` days back from today. */
function wday(n: number): string {
  const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() - n);
  while (d.getDay() === 0) d.setDate(d.getDate() - 1);
  return isoOf(d);
}
const cut = (id: string, date: string, time: string, to?: string) => ({ id, kind: 'downtime', date, time, ...(to ? { to } : {}),
  downtime: { cause: 'power', open: !to }, basis: 'relay', src: 'paste', at: 1 });

function book(extra: any = {}): SepState {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
  s.staff = [{ id: 1, name: 'Alfa', comp: 'hourly', area: 'vat-a1', hourRate: 60, active: true, onFloor: true }];
  return Object.assign(s, extra) as SepState;
}

test('Power opens on Cuts, with four views (the tab map, TM4e), and says where cuts come from when there are none', async ({ page }) => {
  await loadAppWithState(page, book());
  await switchTab(page, 'pagePower');
  await expect(page.locator('#pagePower [data-action="invPowerTab"]')).toHaveText(['Cuts', 'Causes', 'Load & bills', 'Case']);
  await expect(page.locator('#powerContent')).toContainText('No power cut on record');
  await page.locator('[data-action="invPowerTab"][data-tab="case"]').click();
  await expect(page.locator('[data-power-case]')).toContainText('No power cut is on record yet');
});

test('a cut costs its output at contribution, the wages of the hands standing idle and a restart; the fixed charge is shown, not added', async ({ page }) => {
  const d = wday(3), m = d.slice(0, 7);
  await loadAppWithState(page, book({
    production: { entries: [cut('C1', d, '10:00', '10:30')], pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} } },
    attendance: { [d]: { marks: { 1: { st: 'P', hours: 8, area: 'vat-a1' } }, extra: [], note: '' } },
    costBills: [{ id: 'B1', kind: 'power', month: m, amount: 50000, fixed: 3000, at: 1 }],
  }));
  const k = await g(page, `(function(){ var a = powerAnalysis(); return { c: a.cuts[0].cost, rate: a.rate, margin: a.margin }; })()`);
  // No invoices in the last 90 days: output is priced at the case's ₹2,500 an hour, its contribution at the fallback 20%.
  expect(k.rate).toMatchObject({ perHour: 2500, measured: false });
  expect(k.margin).toMatchObject({ share: 0.2, measured: false });
  const days = await g(page, `statsWorkingDays('${m}-01', payMonthEnd('${m}-01'))`);
  // Nothing made up in overtime: the damage is the restart, the output's contribution and the wages that bought nothing.
  expect(k.c).toMatchObject({ inside: 30, hands: 1, lost: 1250, contrib: 250, idle: 30, restart: 600, recOt: 0, recovered: 0, total: 880 });
  expect(k.c.fixed).toBeCloseTo(3000 / (days * 510) * 30, 2);
  await switchTab(page, 'pagePower');
  await page.locator('[data-action="invPowerTab"][data-tab="cuts"]').click();
  // A cut is one line; what its damage is made of is in its fold, a fact a row (the tab map, TM4e).
  const row = page.locator(`[data-power-cut="${d}|600"]`);
  await expect(row.locator('summary')).toContainText('₹880.00');
  await row.locator('summary').click();
  const part = (label: string) => row.locator('.inv-row-children .inv-row', { hasText: label });
  await expect(part('Output not made')).toContainText('output ₹1,250.00');
  await expect(part('Output not made').locator('.inv-row-end')).toHaveText('₹250.00');
  await expect(part('Wages that bought nothing')).toContainText('1 plater');
  await expect(part('Wages that bought nothing').locator('.inv-row-end')).toHaveText('₹30.00');
  await expect(part('Restart').locator('.inv-row-end')).toHaveText('₹600.00');
  await expect(part('Fixed charge')).toContainText('paid anyway');
});

test('an overnight cut runs to the next morning; one with no time back is costed at the typical length, never to the end of the day', async ({ page }) => {
  const d = wday(2), e = wday(4);
  await loadAppWithState(page, book({
    production: { entries: [cut('C1', d, '17:45', '07:30'), cut('C2', e, '09:00', '09:20'), cut('C3', e, '11:00', '11:40'), cut('C4', e, '14:00')],
      pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} } },
  }));
  const a = await g(page, `(function(){ var a = powerAnalysis(); return { cuts: a.cuts.map(function(c){ return { date: c.date, min: c.min, overnight: c.overnight, open: c.open, inside: c.cost.inside }; }), typical: a.typical }; })()`);
  const night = a.cuts.find((c: any) => c.date === d);
  expect(night).toMatchObject({ min: 825, overnight: true, open: false });
  expect(a.typical).toBe(40);   // the median of 20, 40 and 825
  const open = a.cuts.find((c: any) => c.open);
  expect(open.inside).toBe(40);
});

test('the load is recorded, the To-do asks while the approved load is not on the bill, and a bill billed at it clears it', async ({ page }) => {
  await loadAppWithState(page, book({ costBills: [{ id: 'B1', kind: 'power', month: '2026-05', amount: 64567, kvaBilled: 25, penalty: 5220, md: 48.7, at: 1 }] }));
  // Recorded once from the owner's word: 25 kVA billed, 50 approved on 18 May 2026.
  expect(await g(page, 'S.power.load')).toMatchObject({ sanctioned: 25, approved: 50, approvedOn: '2026-05-18' });
  const t = await g(page, 'TODO_RULE_FNS.powerLoad()');
  expect(t).toHaveLength(1);
  expect(t[0].title).toBe('50 kVA approved, still billed at 25 kVA');
  expect(t[0].sub).toContain('₹5,220.00');
  await switchTab(page, 'pagePower');
  await page.locator('#pagePower .inv-viewtab[data-tab="load"]').click();
  // The load's card says it (the tab map, TM4e: it was a callout), in danger, the penalty since approval among its facts.
  await expect(page.locator('#powerLoad .inv-hero-title')).toHaveText('Approved 50 kVA, billed at 25');
  await expect(page.locator('#powerLoad')).toHaveClass(/inv-hero-danger/);
  await expect(page.locator('#powerLoad')).toContainText('₹5,220.00 penalty since approval');
  await expect(page.locator('#powerLoad')).toContainText('48.70 kVA');
  // The next bill is billed at 50: the task clears itself.
  await g(page, `S.costBills.push({ id: 'B2', kind: 'power', month: '2026-06', amount: 50000, kvaBilled: 50, at: 2 }); saveState(); renderPower();`);
  expect(await g(page, 'TODO_RULE_FNS.powerLoad()')).toHaveLength(0);
});

test("a bill's details are set on Load & bills, and the penalty cannot outgrow the bill", async ({ page }) => {
  await loadAppWithState(page, book({ costBills: [{ id: 'B1', kind: 'power', month: '2026-06', amount: 53188, at: 1 }] }));
  await switchTab(page, 'pagePower');
  await page.locator('#pagePower .inv-viewtab[data-tab="load"]').click();
  await expect(page.locator('[data-power-bill="B1"]')).toContainText('amount only: set its details');
  // The bill's row ends in its amount; its Details are in its fold (§1a-11).
  await page.locator('[data-power-bill="B1"] > summary').click();
  await page.locator('[data-power-bill="B1"] [data-action="invPowerBillEdit"]').click();
  await page.locator('#pwb_md').fill('47.5');
  await page.locator('#pwb_kvaBilled').fill('25');
  await page.locator('#pwb_penalty').fill('99999');
  await page.locator('[data-action="invPowerBillSave"]').click();
  await expect(page.locator('.inv-toast').last()).toContainText('cannot be more than its amount');
  await page.locator('#pwb_penalty').fill('4800');
  await page.locator('#pwb_fixed').fill('3500');
  await page.locator('[data-action="invPowerBillSave"]').click();
  const b = (await readStoredState(page)).costBills[0];
  expect(b).toMatchObject({ md: 47.5, kvaBilled: 25, penalty: 4800, fixed: 3500, amount: 53188 });
  await expect(page.locator('[data-power-bill="B1"]')).toContainText('peak 47.50 kVA');
});

test('the history file brings the cuts into Production and fills bill details only where a bill has none, once', async ({ page }) => {
  await loadAppWithState(page, book({ costBills: [{ id: 'B1', kind: 'power', month: '2026-05', amount: 64567, fixed: 3574, at: 1 }] }));
  const file = { format: 'sep-production', version: 1, exportedAt: '', build: 'test', entries: [cut('PCLOG-001', wday(5), '12:30', '13:15'), cut('PCLOG-002', wday(5), '15:00')],
    power: { bills: { '2026-05': { kvaBilled: 25, md: 48.7, penalty: 5220, fixed: 9999 }, '2026-02': { penalty: 100 }, '2026-04': { amount: 54096, net: 54096, paid: 52846, basis: 'paid', penalty: 4320 } } } };
  const r = await g(page, `powerImportData(${JSON.stringify(file)}, 'hist.json')`);
  expect(r.cuts).toMatchObject({ ok: true, added: 2 });
  expect(r.details).toBe(5);                   // the fixed charge typed here stays as it was
  expect(r.noBill).toEqual(['2026-02']);       // a month described with no amount is counted, never invented
  expect(r.bills).toBe(1);                     // one the file records with its amount is added
  // What was paid is the cost; the bill's net payable is kept beside it.
  expect(await g(page, `S.costBills.find(function(b){ return b.month === '2026-04'; })`)).toMatchObject({ kind: 'power', amount: 52846, net: 54096, penalty: 4320 });
  expect(await g(page, 'S.costBills[0]')).toMatchObject({ kvaBilled: 25, md: 48.7, penalty: 5220, fixed: 3574 });
  expect(await g(page, 'powerAnalysis().cuts.length')).toBe(2);
  const again = await g(page, `powerImportData(${JSON.stringify(file)}, 'hist.json')`);
  expect(again.cuts.added).toBe(0);
  expect(again.details).toBe(0);
});

test('the case is a document of the data, printable, and it follows the data as it changes', async ({ page }) => {
  const d = wday(1);
  await loadAppWithState(page, book({
    production: { entries: [cut('C1', d, '12:20', '13:05')], pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} } },
    attendance: { [d]: { marks: { 1: { st: 'P', hours: 8, area: 'vat-a1' } }, extra: [], note: '' } },
  }));
  await switchTab(page, 'pagePower');
  await page.locator('[data-action="invPowerTab"][data-tab="case"]').click();
  const doc = page.locator('#powerContent [data-power-case]');
  await expect(doc).toContainText('Power cuts: the case for reliable supply');
  await expect(doc).toContainText('1 cut on record');
  await expect(doc).toContainText('1 of 1 cuts (100%) began between noon and 2 PM');
  await expect(doc.locator('.inv-pc-sec')).toHaveCount(10);
  await page.locator('[data-action="invPowerPrint"]').click();
  const printed = page.locator('#invPrintBody [data-power-case]');
  await expect(printed).toBeVisible();
  // A cut recorded while the case is open: the page and the printed copy both redraw on the save.
  await g(page, `S.production.entries.push(${JSON.stringify(cut('C2', wday(1), '15:00', '15:10'))}); prodTouch(); saveState(); renderPower();`);
  await expect(printed).toContainText('2 cuts on record');
  await expect(doc).toContainText('2 cuts on record');
});

test('a long run of recorded days with no cut is read as possibly unreported, not as clean', async ({ page }) => {
  // Ten cuts in the first ten working days, then twenty recorded days with none (the 27 Aug – 15 Sep shape).
  const days: string[] = [];
  for (let n = 45; days.length < 30; n--) { const d = wday(n); if (!days.includes(d)) days.push(d); }
  const att: any = {}; days.forEach(d => { att[d] = { marks: { 1: { st: 'P', hours: 8, area: 'vat-a1' } }, extra: [], note: '' }; });
  const entries = days.slice(0, 10).map((d, i) => cut('C' + i, d, '12:30', '12:50'));
  await loadAppWithState(page, book({ attendance: att, production: { entries, pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} } } }));
  const q = await g(page, 'powerAnalysis().quiet');
  expect(q.length).toBe(1);
  expect(q[0].days).toBeGreaterThanOrEqual(19);
  await switchTab(page, 'pagePower');
  await page.locator('[data-action="invPowerTab"][data-tab="case"]').click();
  await expect(page.locator('#powerContent [data-power-case]')).toContainText('read as possibly unreported, never as clean');
});

/** The working day after `iso` (Sundays skipped). */
function nextWday(iso: string): string {
  const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + 1);
  while (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return isoOf(d);
}

test('the overtime a cut’s backlog took, above the usual, is its cost, and the output it made up is not lost as well', async ({ page }) => {
  // Owner, 30 Sep 2026: "also take into assumption OT that we had to do following the power cut due to the backlog".
  // The baseline is the clean recorded days in the cut's own month, four at least: a cut at a month's end has too few after
  // it, so the cut is placed where its month still has five working days after it before today (it failed on 5 Oct, when
  // ten days back was 25 Sep).
  let n = 10;
  for (; n < 28; n++) {
    const d = wday(n), m = d.slice(0, 7);
    let later = 0;
    for (let k = n - 1; k >= 1; k--) if (wday(k) !== d && wday(k).slice(0, 7) === m) later++;
    if (later >= 6) break;
  }
  const cutDay = wday(n), after = nextWday(cutDay);
  const att: any = {};
  for (let n = 30; n >= 1; n--) {
    const d = wday(n);
    att[d] = { marks: { 1: { st: 'P', hours: 8, area: 'vat-a1' }, 2: { st: 'P', hours: 8, ot: 0, area: 'vat-a2' }, 3: { st: 'P', hours: 8, area: 'office' } }, extra: [], note: '' };
  }
  att[cutDay].marks[1].hours = 10;          // the hourly hand stays two hours on the cut's day
  att[after].marks[2].ot = 3;               // and the monthly hand three hours the day after
  await loadAppWithState(page, book({
    staff: [{ id: 1, name: 'Alfa', comp: 'hourly', area: 'vat-a1', hourRate: 60, active: true, onFloor: true },
      { id: 2, name: 'Bravo', comp: 'monthly', area: 'vat-a2', dayRate: 400, active: true, onFloor: true },
      { id: 3, name: 'Charlie', comp: 'monthly', area: 'office', dayRate: 320, active: true, onFloor: false }],
    attendance: att,
    production: { entries: [cut('C1', cutDay, '10:00', '12:00')], pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} } },
  }));
  const r = await g(page, `(function(){ var a = powerAnalysis(); return { c: a.cuts[0].cost, rec: { affected: a.recovery.affected, above: a.recovery.above, cost: a.recovery.cost } }; })()`);
  r.c.recHours = Math.round(r.c.recHours * 1000) / 1000;
  // Two hours at the hourly hand's ₹60 and three at the monthly hand's ₹400 ÷ 8 × 1.1 ran above a usual of nothing: 5
  // hand-hours, ₹285. But the cut stopped two platers for two hours, 4 hand-hours: the cut is charged no more than that,
  // ₹228 (re-audit N-1: a cut cannot take more work to make up than it stopped).
  expect(r.rec).toMatchObject({ affected: 2, above: 2, cost: 228 });
  // The office is idle too, but the lines are what stopped: platers ₹220 (₹120 + ₹100), everyone ₹300.
  expect(r.c).toMatchObject({ hands: 2, handsAll: 3, idle: 220, idleAll: 300, recOt: 228, recHours: 4, recovered: 1 });
  // All of it made up: the damage is the overtime and the restart, nothing lost.
  expect(r.c.total).toBe(828);
  await switchTab(page, 'pagePower');
  await page.locator('[data-action="invPowerTab"][data-tab="case"]').click();
  const doc = page.locator('#powerContent [data-power-case]');
  await expect(doc).toContainText('Overtime to catch up');
  await expect(doc).toContainText('overtime to catch up the backlog ₹228.00');
  await expect(doc).toContainText('an estimate, not measured');
  await expect(doc).toContainText('The damage, not the revenue at stake');
});

test('a cut idles the hands where they stood at the time: a block’s crew on its line, pickling only at the upper end', async ({ page }) => {
  const d = wday(3);
  await loadAppWithState(page, book({
    // Alfa is a pickling hand on the general shift and stood on VAT A1 in the evening block; Bravo pickles all day.
    staff: [{ id: 1, name: 'Alfa', comp: 'hourly', area: 'pickling-vat', hourRate: 60, active: true, onFloor: true },
      { id: 2, name: 'Bravo', comp: 'hourly', area: 'pickling-vat', hourRate: 60, active: true, onFloor: true }],
    attendance: { [d]: { marks: { 1: { st: 'P', hours: 8, area: 'pickling-vat' }, 2: { st: 'P', hours: 8, area: 'pickling-vat' } }, note: '',
      extra: [{ kind: 'block', areas: ['vat-a1'], crew: [1], from: '17:00', to: '20:00', hours: 0 }] } },
    production: { entries: [cut('C1', d, '18:00', '18:30'), cut('C2', d, '11:00', '11:30')], pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} } },
  }));
  const c = await g(page, 'powerAnalysis().cuts.map(function(c){ return c.cost; })');
  // The evening cut idles the block's plater; the morning cut idles two pickling hands, who are the upper end only.
  expect(c[1]).toMatchObject({ inside: 30, ot: 30, hands: 1, idle: 30, handsAll: 1 });
  expect(c[0]).toMatchObject({ inside: 30, hands: 0, idle: 0, handsAll: 2, idleAll: 60 });
});

test('a power-back the log gives only as a bound reads "after", and a single-phase fault says so', async ({ page }) => {
  const d = wday(4);
  const e = { ...cut('C1', d, '17:40', '18:59'), downtime: { cause: 'power', open: false, atLeast: true, phase: 'single' } };
  await loadAppWithState(page, book({ production: { entries: [e], pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} } } }));
  await switchTab(page, 'pagePower');
  await page.locator('[data-action="invPowerTab"][data-tab="cuts"]').click();
  const row = page.locator(`[data-power-cut="${d}|1060"]`);
  await expect(row).toContainText('5:40 PM – after 6:59 PM');
  await expect(row).toContainText('1 h 19 min at least');
  await expect(row).toContainText('Single-phase');
});

test('a power-back known only as a bound is costed to the later of the bound and the typical length, never the bound alone', async ({ page }) => {
  const d = wday(4);
  const bounded = { ...cut('C1', d, '15:00', '15:20'), downtime: { cause: 'power', open: false, atLeast: true } };
  await loadAppWithState(page, book({ production: { entries: [bounded, cut('C2', wday(6), '10:00', '11:00'), cut('C3', wday(7), '10:00', '11:00')],
    pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} } } }));
  const a = await g(page, `(function(){ var a = powerAnalysis(); return { typical: a.typical, c: a.cuts.find(function(c){ return c.atLeast; }).cost }; })()`);
  expect(a.typical).toBe(60);                  // the bound is not a length, so it stays out of the median
  expect(a.c.inside).toBe(60);                 // 3:00 to 4:00 PM, past the bound at 3:20
});

test('the quiet-run rate counts only the cuts on recorded days', async ({ page }) => {
  // Forty cuts on days with no record (the handwritten April log) must not make a short recorded stretch look quiet.
  const days: string[] = [];
  for (let n = 45; days.length < 30; n--) { const d = wday(n); if (!days.includes(d)) days.push(d); }
  const att: any = {}; days.forEach(d => { att[d] = { marks: { 1: { st: 'P', hours: 8, area: 'vat-a1' } }, extra: [], note: '' }; });
  const old: any[] = [];
  for (let n = 120; old.length < 40; n--) { const d = wday(n); if (!old.some(x => x.date === d)) old.push(cut('O' + n, d, '12:30', '12:50')); }
  const entries = [...old, cut('C1', days[0], '12:30', '12:50')];
  await loadAppWithState(page, book({ attendance: att, production: { entries, pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} } } }));
  const q = await g(page, 'powerAnalysis().quiet');
  // One cut on 30 recorded days: 29 cut-free days expect under one cut, so nothing is called unreported.
  expect(q).toHaveLength(0);
});

test('a night hold and the block a cut fell in are never its catch-up, and the usual is read in the cut’s own month', async ({ page }) => {
  const cutDay = wday(10), after = nextWday(cutDay);
  const att: any = {};
  for (let n = 40; n >= 1; n--) att[wday(n)] = { marks: { 1: { st: 'P', hours: 8, area: 'vat-a1' } }, extra: [], note: '' };
  // The cut falls inside an evening block that books 12 h of EXTRA; the next day runs a night hold with 30 h.
  att[cutDay].extra = [{ kind: 'block', areas: ['vat-a1'], crew: [1], from: '17:00', to: '21:00', hours: 12 }];
  att[after].extra = [{ kind: 'block', areas: ['vat-a1'], crew: [1], from: '20:00', to: '06:00', hours: 30 }];
  await loadAppWithState(page, book({
    attendance: att, labour: { extraRate: 50 },
    production: { entries: [cut('C1', cutDay, '18:00', '18:30')], pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} } },
  }));
  const r = await g(page, `(function(){ var a = powerAnalysis(); return { c: a.cuts[0].cost, n: powerIsNightBlock({ from: '20:00', to: '06:00' }), e: powerIsNightBlock({ from: '17:00', to: '00:00' }) }; })()`);
  expect(r.n).toBe(true);                     // a night hold is a shift
  expect(r.e).toBe(false);                    // 5 PM to midnight is a day running late
  expect(r.c).toMatchObject({ inside: 30, hands: 1, recOt: 0 });
});
