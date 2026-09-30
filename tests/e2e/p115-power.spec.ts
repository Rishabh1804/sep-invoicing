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

test('Power opens from More, with four views, and says where cuts come from when there are none', async ({ page }) => {
  await loadAppWithState(page, book());
  await switchTab(page, 'pagePower');
  await expect(page.locator('#pagePower [data-action="invPowerTab"]')).toHaveText(['Overview', 'Cuts', 'Load & bills', 'Case']);
  await page.locator('[data-action="invPowerTab"][data-tab="cuts"]').click();
  await expect(page.locator('#powerContent')).toContainText('No power cut on record');
  await page.locator('[data-action="invPowerTab"][data-tab="case"]').click();
  await expect(page.locator('[data-power-case]')).toContainText('No power cut is on record yet');
});

test('a cut costs its output, the wages of the hands standing idle, a restart and the fixed charge, each worked out', async ({ page }) => {
  const d = wday(3), m = d.slice(0, 7);
  await loadAppWithState(page, book({
    production: { entries: [cut('C1', d, '10:00', '10:30')], pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} } },
    attendance: { [d]: { marks: { 1: { st: 'P', hours: 8, area: 'vat-a1' } }, extra: [], note: '' } },
    costBills: [{ id: 'B1', kind: 'power', month: m, amount: 50000, fixed: 3000, at: 1 }],
  }));
  const k = await g(page, `(function(){ var a = powerAnalysis(); return { c: a.cuts[0].cost, rate: a.rate }; })()`);
  // No invoices in the last 90 days: output is priced at the case's ₹2,500 an hour, and the case says so.
  expect(k.rate).toMatchObject({ perHour: 2500, measured: false });
  const days = await g(page, `statsWorkingDays('${m}-01', payMonthEnd('${m}-01'))`);
  expect(k.c).toMatchObject({ inside: 30, hands: 1, lost: 1250, idle: 30, restart: 600 });
  expect(k.c.fixed).toBeCloseTo(3000 / (days * 510) * 30, 2);
  await switchTab(page, 'pagePower');
  await page.locator('[data-action="invPowerTab"][data-tab="cuts"]').click();
  const row = page.locator(`[data-power-cut="${d}|600"]`);
  await expect(row).toContainText('output ₹1,250.00');
  await expect(row).toContainText('idle wages ₹30.00 (1 hand)');
  await expect(row).toContainText('restart ₹600.00');
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
  await page.locator('[data-action="invPowerTab"][data-tab="load"]').click();
  await expect(page.locator('#powerLoad')).toContainText('the bill still charges for 25 kVA');
  await expect(page.locator('#powerLoad')).toContainText('48.70 kVA');
  // The next bill is billed at 50: the task clears itself.
  await g(page, `S.costBills.push({ id: 'B2', kind: 'power', month: '2026-06', amount: 50000, kvaBilled: 50, at: 2 }); saveState(); renderPower();`);
  expect(await g(page, 'TODO_RULE_FNS.powerLoad()')).toHaveLength(0);
});

test("a bill's details are set on Load & bills, and the penalty cannot outgrow the bill", async ({ page }) => {
  await loadAppWithState(page, book({ costBills: [{ id: 'B1', kind: 'power', month: '2026-06', amount: 53188, at: 1 }] }));
  await switchTab(page, 'pagePower');
  await page.locator('[data-action="invPowerTab"][data-tab="load"]').click();
  await expect(page.locator('[data-power-bill="B1"]')).toContainText('amount only: set its details');
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
    power: { bills: { '2026-05': { kvaBilled: 25, md: 48.7, penalty: 5220, fixed: 9999 }, '2026-02': { penalty: 100 }, '2026-04': { amount: 54096, penalty: 4320 } } } };
  const r = await g(page, `powerImportData(${JSON.stringify(file)}, 'hist.json')`);
  expect(r.cuts).toMatchObject({ ok: true, added: 2 });
  expect(r.details).toBe(4);                   // the fixed charge typed here stays as it was
  expect(r.noBill).toEqual(['2026-02']);       // a month described with no amount is counted, never invented
  expect(r.bills).toBe(1);                     // one the file records with its amount is added
  expect(await g(page, `S.costBills.find(function(b){ return b.month === '2026-04'; })`)).toMatchObject({ kind: 'power', amount: 54096, penalty: 4320 });
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
