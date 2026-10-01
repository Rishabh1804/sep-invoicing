import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, openStatsTab, switchTab, todayIso, recentTs, workingDaysBack } from './fixtures';

// P105: the QA sweep's Stats, History and charts fold. Fixed and variable labour read from the instrument the
// labour figure came from; one cost per kilo for a period, the drill-down included; the labour card's tonnage on
// All inside the attendance span; top items by client, part and gauge on one scale with their cost mark; a
// cancel that is not also an edit; History's CSV by the one writer, no sum of unlike amounts, a day's full
// count; charts that break at a gap and label a zero axis once; a share that never reads 100% with a line out;
// and the live cost per kilo saying it divides by the weighed tonnage alone. Names and figures are made up.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);

function iso(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function addDays(day: string, n: number) { const d = new Date(day + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); }
/** The month `k` months before this one, YYYY-MM. */
function monthBack(k: number) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - k); return iso(d).slice(0, 7); }
function monthEnd(ym: string) { const [y, m] = ym.split('-').map(Number); return iso(new Date(y, m, 0)); }

type Line = { partNumber: string; desc?: string; unit?: string; qty: number; rate: number };
function kg(partNumber: string, qty: number, rate: number, desc?: string): Line { return { partNumber, desc, qty, rate }; }
function inv(id: string, clientId: number, clientName: string, lines: Line[], date = todayIso(), extra: Record<string, unknown> = {}) {
  const items = lines.map(l => ({ partNumber: l.partNumber, desc: l.desc ?? l.partNumber, hsn: '998873', unit: l.unit || 'KG',
    qty: l.qty, rate: l.rate, amount: Math.round(l.qty * l.rate * 100) / 100, nosQty: null }));
  const taxable = items.reduce((s, i) => s + i.amount, 0);
  return { id, invoiceNumber: id, displayNumber: 'SEP/T-' + id, date, status: 'active', invoiceState: 'created',
    clientId, clientName, gstType: 'intra', clientAddress: { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' },
    items, taxableValue: taxable, cgstPer: 9, cgstAmt: 0, sgstPer: 9, sgstAmt: 0, igstPer: 0, igstAmt: 0,
    grandTotal: taxable, amountInWords: '', createdAt: recentTs(), updatedAt: recentTs(), ...extra };
}
function client(id: number, name: string, billingMode = 'weight', ratePerKg = 10) {
  return { id, name, billingMode, gstType: 'intra', gstin: '', address: '', isActive: true,
    rates: [{ ratePerKg, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [] };
}
function base(): any { const s: any = emptyState(); s.incomingMaterial = noSeedIM(); return s; }
const MONTHLY = { id: 7, name: 'Test Monthly', comp: 'monthly', dayRate: 500, hourRate: 0, area: 'vat-a1', onFloor: true, active: true };
const present = (area: string) => ({ st: 'P', hours: 8, ot: 0, area });

test.describe('S2: fixed and variable labour', () => {
  test('a month the bank paid splits by its salaries, not as all variable', async ({ page }) => {
    // The statement covers month M and the salary run after it: M's labour is what the bank paid.
    const M = monthBack(2), N = monthBack(1);
    let seq = 0;
    const row = (date: string, narration: string, dr: number, cr: number, set?: Record<string, unknown>) =>
      ({ id: 'BK-T' + (++seq), date, valueDate: date, narration, chq: '', dr, cr, balance: 100000, dayIdx: 0, importId: 'BI-T', ...(set ? { set } : {}) });
    const rows = [
      row(M + '-01', 'NEFT-ALPHA FORGINGS', 0, 100000),
      row(M + '-15', 'SELF', 7000, 0),                                                    // the weekly pool's cash, a pay week inside M
      row(N + '-14', 'NEFT-TEST MONTHLY', 13000, 0, { cat: 'wages', staffId: 7 }),        // M's salary, paid the month after
      row(N + '-25', 'NEFT-ALPHA FORGINGS', 0, 1),
    ];
    const s = base();
    s.staff = [MONTHLY];
    s.bank = { rows, imports: [{ id: 'BI-T', at: 1, file: 'test.xls', account: '', from: rows[0].date, to: rows[3].date, rows: 4, added: 4, closing: 100000 }],
      parties: {}, opening: {}, gstNotes: {} };
    s.clients = [client(1, 'TEST CLIENT KG')];
    s.invoices = [inv('00001', 1, 'TEST CLIENT KG', [kg('P1', 2000, 10)], M + '-10')];
    s.invNextNum = 2;
    await loadAppWithState(page, s);

    const r: any = await g(page, `(function(){ var c = liveCost('${M}-01', '${monthEnd(M)}', 10000), lab = c.rows.find(function(x){ return x.key === 'labour'; });
      var sp = statsCostSplit(c); return { source: lab.source, amount: lab.amount, fixed: sp.fixed, variable: sp.variable, total: c.total, from: sp.from }; })()`);
    expect(r.source).toBe('bank');
    expect(r.amount).toBe(20000);
    // ₹13,000 of salaries against ₹7,000 of cash: the monthly crew is 65% of what the bank paid.
    expect(r.fixed).toBeCloseTo(13000, 2);
    expect(r.variable).toBeCloseTo(r.total - 13000, 2);
    expect(r.from).toBe('bank');

    // On the page, the note says where the split came from and prices the fixed part.
    await openStatsTab(page, 'clients');
    await page.locator('[data-action="invStatsPeriod"][data-period="all"]').click();
    const note = page.locator('#statsMargin .inv-panel-body .inv-note').first();
    await expect(note).toContainText('fixed (monthly crew, read off the salaries the bank paid)');
    await expect(note).not.toContainText('₹0.00/kg · full');
  });

  test('the stretch filled at the model takes the recorded fixed share, not all variable', async ({ page }) => {
    // Five working days of last month recorded, a monthly hand and an hourly one: the rest of the month is model.
    const L = monthBack(1), days: string[] = [];
    for (let d = L + '-01'; days.length < 5; d = addDays(d, 1)) if (new Date(d + 'T00:00:00').getDay() !== 0) days.push(d);
    const s = base();
    s.staff = [MONTHLY, { id: 8, name: 'Test Hourly', comp: 'hourly', dayRate: 0, hourRate: 50, area: 'barrel', onFloor: true, active: true }];
    s.attendance = Object.fromEntries(days.map(d => [d, { marks: { 7: present('vat-a1'), 8: present('barrel') }, extra: [], note: '' }]));
    await loadAppWithState(page, s);
    const r: any = await g(page, `(function(){ var from = '${L}-01', to = '${monthEnd(L)}', lab = labourForRange(from, to), c = liveCost(from, to, 20000);
      var row = c.rows.find(function(x){ return x.key === 'labour'; }), sp = statsCostSplit(c);
      return { recFixed: lab.fixed, recTotal: lab.total, cov: lab.coverage, amount: row.amount, fixed: sp.fixed, from: sp.from }; })()`);
    expect(r.cov).toBeLessThan(0.9);
    expect(r.amount).toBeGreaterThan(r.recTotal);                  // the unrecorded days are filled at the model
    expect(r.from).toBe('attendance');
    // The recorded bill's fixed share holds over the fill: reading only the recorded tiers called the fill all variable.
    expect(r.fixed).toBeCloseTo(r.recFixed / r.recTotal * r.amount, 1);
    expect(r.fixed).toBeGreaterThan(r.recFixed + 1);
  });

  test('with nothing recorded the split is not known and says so, and no insight calls a client below it', async ({ page }) => {
    const s = base();
    s.clients = [...s.clients, client(71, 'ALPHA WORKS'), client(72, 'BETA CLAMPS')];
    s.invoices = [inv('00001', 71, 'ALPHA WORKS', [kg('PA', 1000, 13)]), inv('00002', 72, 'BETA CLAMPS', [kg('PB', 3000, 5)]),
      inv('00003', 72, 'BETA CLAMPS', [kg('PB', 3000, 5)], monthBack(1) + '-10')];
    s.invNextNum = 4;
    await loadAppWithState(page, s);
    const sp: any = await g(page, `(function(){ var r = statsRangeIso('mtd'); return statsCostSplit(liveCost(r.from, r.to, 4000)); })()`);
    expect(sp.known).toBe(false);
    expect(sp.fixed).toBeNull();
    // "Below its variable cost even with labour fixed" was said of a variable cost that held all of labour.
    expect(await g(page, `JSON.stringify(TODO_RULE_FNS.insBelowVar())`)).toBe('[]');

    await openStatsTab(page, 'clients');
    const card = page.locator('#statsMargin');
    await expect(card).toContainText('Fixed and variable are not known');
    const beta = card.locator('tbody tr', { hasText: 'BETA CLAMPS' });
    await expect(beta.locator('td').nth(3)).toHaveText('—');                   // vs var.: not worked out
    await expect(beta.locator('td').nth(3)).not.toHaveClass(/inv-num-neg/);
    await expect(beta.locator('td').nth(4)).toHaveClass(/inv-num-neg/);        // vs full stands: ₹5.00 under the live cost
    await expect(page.locator('#statsWorst [data-tile="fixed"]')).toContainText('split not known');
    await expect(page.locator('#statsWorst')).toContainText('cannot be told until labour is split');
  });
});

test('S5: cancelling an invoice is one row in History, not a cancel and an edit', async ({ page }) => {
  const s = base();
  const t0 = Date.now() - 3600000;
  s.invoices = [
    inv('00001', 1, 'TEST CLIENT KG', [kg('P1', 100, 10)], todayIso(), { createdAt: t0, updatedAt: t0 }),
    inv('00002', 1, 'TEST CLIENT KG', [kg('P2', 100, 10)], todayIso(), { createdAt: t0, updatedAt: t0 + 600000 }),   // edited ten minutes on
  ];
  s.invNextNum = 3;
  await loadAppWithState(page, s);
  // The app's own cancel, which stamps cancelledAt and updatedAt a moment apart.
  await g(page, `confirmCancelInvoice('00001')`);
  await switchTab(page, 'pageHistory');
  const list = page.locator('#historyList');
  await expect(list.locator('[data-ev="cancel"]')).toContainText('SEP/T-00001 cancelled');
  await expect(list).not.toContainText('SEP/T-00001 edited');
  await expect(list).toContainText('SEP/T-00002 edited');       // a real edit is still an edit
});

test('S8: on the price ranking a part below cost ends short of the cost mark, on one scale', async ({ page }) => {
  const s = base();
  s.clients = [client(1, 'TEST CLIENT KG')];
  s.invoices = [inv('00001', 1, 'TEST CLIENT KG', [kg('LOW', 1000, 5)]), inv('00002', 1, 'TEST CLIENT KG', [kg('LESS LOW', 1000, 6)])];
  s.invNextNum = 3;
  await loadAppWithState(page, s);
  await openStatsTab(page, 'trends');
  await page.locator('[data-action="invStatsTopBy"][data-by="rate"]').click();
  const card = page.locator('[data-card="top"]');
  await expect(card).toContainText('Worst priced items');
  const geo = await card.evaluate(el => Array.from(el.querySelectorAll('.inv-chart-ranked-svg')).map(svg => ({
    fill: +svg.querySelector('.inv-chart-ranked-fill')!.getAttribute('width')!,
    mark: +svg.querySelector('.inv-chart-ranked-mark')!.getAttribute('x')!,
  })));
  expect(geo).toHaveLength(2);
  // Both parts are plated below the live cost: both bars end short of the mark. On the bars' own scale the
  // better-priced one filled its track and sat on the mark, reading as at cost.
  for (const r of geo) expect(r.fill).toBeLessThan(r.mark - 1);
  const cost = await g(page, `statsPeriodCost(_statsPeriod, weighLines(S.invoices)).perKg`) as number;
  expect(geo[1].fill).toBeCloseTo(6 / cost * 100, 1);
  expect(geo[1].mark).toBeCloseTo(100, 5);
});

test('S9, S14: the drill-down judges at the live cost, in words, and says how the client is billed', async ({ page }) => {
  const s = base();
  s.defaultCostPerKg = 5.46;          // the typed figure, well under the live cost's model
  s.clients = [client(71, 'ALPHA WORKS', 'weight', 7), client(72, 'BETA CLAMPS', 'piece', 5.4)];
  s.invoices = [inv('00001', 71, 'ALPHA WORKS', [kg('PA', 1000, 7)]), inv('00002', 72, 'BETA CLAMPS', [kg('PB', 1000, 13)])];
  s.invNextNum = 3;
  await loadAppWithState(page, s);
  await openStatsTab(page, 'clients');
  const alpha = page.locator('[data-card="realisation"] [data-client-row]', { hasText: 'ALPHA WORKS' });
  await expect(alpha.locator('.inv-dot-danger')).toHaveText('Below cost');     // the table, at the live cost

  await alpha.click();
  const card = page.locator('.inv-dialog[data-drill="71"]');
  const tile = card.locator('[data-tile="realisation"]');
  // ₹7.00 against the live cost is below it, whatever the typed ₹5.46 says; the colour carries its words.
  await expect(tile).toHaveClass(/inv-tile-danger/);
  await expect(tile.locator('.inv-dot-danger')).toHaveText('Below cost');
  const cost = await g(page, `formatCurrency(statsPeriodCost(_statsPeriod, weighLines(S.invoices)).perKg)`) as string;
  await expect(tile).toContainText('live cost ' + cost + '/kg');
  await expect(card.locator('.inv-flip-front .inv-note').first()).toContainText('Weight · ₹7.00/kg');
  await card.locator('.inv-flip-front [data-action="invCloseOverlay"]').click();

  await page.locator('[data-card="realisation"] [data-client-row]', { hasText: 'BETA CLAMPS' }).click();
  const beta = page.locator('.inv-dialog[data-drill="72"]');
  await expect(beta.locator('.inv-flip-front .inv-note').first()).toContainText('Piece · ₹5.40/kg basis');
  await expect(beta.locator('[data-tile="realisation"]')).toHaveClass(/inv-tile-ok/);
  await expect(beta.locator('[data-tile="realisation"] .inv-dot')).toHaveCount(0);
});

test('S10: on All, labour per kg divides by the tonnage billed inside the attendance span', async ({ page }) => {
  const span = workingDaysBack(16);                 // newest first
  const s = base();
  s.clients = [client(1, 'TEST CLIENT KG')];
  s.staff = [MONTHLY];
  s.attendance = Object.fromEntries(span.map(d => [d, { marks: { 7: present('vat-a1') }, extra: [], note: '' }]));
  s.invoices = [
    inv('00001', 1, 'TEST CLIENT KG', [kg('P1', 1000, 10)], span[0]),                                // inside the span
    inv('00002', 1, 'TEST CLIENT KG', [kg('P1', 3000, 10)], addDays(span[span.length - 1], -60)),     // long before it
  ];
  s.invNextNum = 3;
  await loadAppWithState(page, s);
  await openStatsTab(page, 'cost');
  await page.locator('[data-action="invStatsPeriod"][data-period="all"]').click();
  const want = await g(page, `(function(){ var r = labourRangeForPeriod('all'), lab = labourForRange(r.from, r.to); return formatCurrency(lab.total / 1000); })()`) as string;
  // The labour is the span's; so is the 1,000 kg under it. The whole book's 4,000 kg read it at a quarter.
  await expect(page.locator('[data-card="labour"] [data-tile="perkg"]')).toContainText(want);
});

test('S13: the History CSV is written by downloadCSV, byte-order mark first', async ({ page }) => {
  const s = base();
  s.invoices = [inv('00001', 1, 'TEST CLIENT KG', [kg('P1', 100, 10)])];
  s.invNextNum = 2;
  s.attendance = { [todayIso()]: { marks: {}, extra: [{ area: 'vat-a1', hours: 8 }], note: '' } };   // a floor row
  await loadAppWithState(page, s);
  await switchTab(page, 'pageHistory');
  const out: any = await page.evaluate(async () => {
    const w = window as any, calls: string[] = [], orig = w.downloadCSV, origUrl = URL.createObjectURL;
    let bytes: number[] = [], text = '';
    w.downloadCSV = function(name: string, rows: unknown[][]) { calls.push(name); return orig(name, rows); };
    (URL as any).createObjectURL = (b: Blob) => {
      b.arrayBuffer().then(ab => { bytes = Array.from(new Uint8Array(ab).slice(0, 3)); text = new TextDecoder().decode(ab); });
      return 'blob:stub';
    };
    try { w.exportHistoryCSV(); } finally { w.downloadCSV = orig; (URL as any).createObjectURL = origUrl; }
    await new Promise(r => setTimeout(r, 200));
    return { calls, bytes, text };
  });
  expect(out.calls).toHaveLength(1);
  expect(out.calls[0]).toMatch(/^sep-activity-log-\d{4}-\d{2}-\d{2}\.csv$/);
  expect(out.bytes).toEqual([0xef, 0xbb, 0xbf]);
  const lines = String(out.text).replace(/^﻿/, '').split('\n');
  expect(lines[0]).toBe('Timestamp,Dated by,Type,Event,Amount,By,Device');
  // The floor row keeps its clock in the second column; a recorded row's timestamp is quoted for its comma.
  expect(lines.some(l => l.split(',')[1] === 'floor day')).toBe(true);
  expect(lines.some(l => /^"[^"]+, \d{2}:\d{2}",recorded,invoice,/.test(l))).toBe(true);
});

test('SB5: History adds up no amounts across unlike events; each row keeps its own', async ({ page }) => {
  const s = base();
  s.invoices = [{ ...inv('00001', 1, 'TEST CLIENT KG', [kg('P1', 100, 10)]), grandTotal: 1180, createdAt: recentTs(3600000) }];
  s.voidedNumbers = [{ invoiceNumber: '00002', displayNumber: 'SEP/T-00002', reason: 'Typed twice', reserved: false,
    clientId: 1, clientName: 'TEST CLIENT KG', grandTotal: 590, voidedAt: recentTs(600000) }];
  s.invNextNum = 3;
  await loadAppWithState(page, s);
  await switchTab(page, 'pageHistory');
  const list = page.locator('#historyList');
  await expect(list.locator('[data-card="history"]')).toBeVisible();
  // A live invoice's ₹1,180 and a deleted one's ₹590 are not ₹1,770 of anything.
  await expect(list.locator('[data-history-total]')).toHaveCount(0);
  await expect(list).not.toContainText('across the events shown');
  await expect(list.locator('[data-ev="invoice"]')).toContainText('₹1,180.00');
  await expect(list.locator('[data-ev="void"]')).toContainText('₹590.00');
});

test('S17: the phone day head counts every event of the day, not only the ones shown', async ({ page }) => {
  const s = base();
  const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
  s.invoices = Array.from({ length: 35 }, (_, i) => {
    const at = midnight.getTime() + 1000 * (i + 1);
    return inv(String(i + 1).padStart(5, '0'), 1, 'TEST CLIENT KG', [kg('P', 10, 10)], todayIso(), { createdAt: at, updatedAt: at });
  });
  s.invNextNum = 36;
  await loadAppWithState(page, s);
  await switchTab(page, 'pageHistory');
  await expect(page.locator('#historyList [data-ev="invoice"]')).toHaveCount(30);   // thirty shown, the rest behind Show more
  await expect(page.locator('#historyList .inv-row-group').first().locator('.inv-num')).toHaveText('35');
});

test('S18: the six months are named the app\'s way, never "Sept"', async ({ page }) => {
  // A day in September, so the check means the same whenever it runs.
  const y = new Date().getFullYear();
  await page.clock.setFixedTime(new Date(y, 8, 20, 12, 0, 0));
  const s = base();
  s.invoices = [inv('00001', 1, 'TEST CLIENT KG', [kg('P1', 100, 10)], `${y}-09-10`)];
  s.invNextNum = 2;
  await loadAppWithState(page, s);
  await openStatsTab(page, 'overview');
  await expect(page.locator('#statsMonths tbody tr td:first-child')).toHaveText(['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep to date']);
});

test('S19: coverage never reads 100% while a line is left out', async ({ page }) => {
  const s = base();
  // ₹300 of ₹1,00,300 has no weight: 99.7% weighed, which rounded to "100%" beside the sentence naming the line.
  s.invoices = [inv('00001', 1, 'TEST CLIENT KG', [kg('P1', 1000, 100)]),
    inv('00002', 1, 'TEST CLIENT KG', [{ partNumber: 'NO WEIGHT PIN', unit: 'NOS', qty: 10, rate: 30 }])];
  s.invNextNum = 3;
  await loadAppWithState(page, s);
  await openStatsTab(page, 'overview');
  const callout = page.locator('[data-card="headline"] [data-callout="coverage"]');
  await expect(callout).toContainText('cover 99% of revenue');
  await expect(callout).toContainText('1 line worth ₹300.00');
  expect(await g(page, `[statsPctOf(0.997), statsPctOf(1), statsPctOf(0.5), statsPctOf(0)].join(',')`)).toBe('99,100,50,0');
});

test('S20: a part is its client\'s part at its gauge, and its row names the client', async ({ page }) => {
  const s = base();
  s.clients = [client(71, 'ALPHA WORKS'), client(72, 'BETA CLAMPS')];
  s.invoices = [
    inv('00001', 71, 'ALPHA WORKS', [kg('BASE PLATE', 100, 10), kg('CLAMP 165X83', 100, 12, 'CLAMP (35X6)'), kg('CLAMP 165X83', 100, 14, 'CLAMP (40X6)')]),
    inv('00002', 72, 'BETA CLAMPS', [kg('BASE PLATE', 100, 20)]),
  ];
  s.invNextNum = 3;
  await loadAppWithState(page, s);
  await openStatsTab(page, 'trends');
  const rows = page.locator('[data-card="top"] .inv-chart-ranked-row');
  await expect(rows).toHaveCount(4);
  const plate = rows.filter({ hasText: 'BASE PLATE' });
  await expect(plate).toHaveCount(2);
  await expect(plate.filter({ hasText: 'BETA CLAMPS · ₹' })).toContainText('₹20.00/kg');
  await expect(plate.filter({ hasText: 'ALPHA WORKS · ₹' })).toContainText('₹10.00/kg');
  // A code both clients send says so on each row, counted apart (P118).
  await expect(plate.filter({ hasText: 'ALPHA WORKS · ₹' })).toContainText('code also sent by BETA CLAMPS, counted apart');
  await expect(rows.filter({ hasText: '35X6' })).toContainText('₹12.00/kg');
  await expect(rows.filter({ hasText: '40X6' })).toContainText('₹14.00/kg');
});

test('SB1: where a line has no weight, the live cost per kg says it divides by the weighed tonnage alone', async ({ page }) => {
  const s = base();
  // ₹1,000 of ₹10,000 is a NOS line with no weight: the tonnage under the cost is 90% of the revenue.
  s.invoices = [inv('00001', 1, 'TEST CLIENT KG', [kg('P1', 1000, 9)]), inv('00002', 1, 'TEST CLIENT KG', [{ partNumber: 'PIN', unit: 'NOS', qty: 100, rate: 10 }])];
  s.invNextNum = 3;
  await loadAppWithState(page, s);
  await openStatsTab(page, 'overview');
  await expect(page.locator('[data-card="headline"] [data-callout="coverage"]')).toContainText('so it reads high too: by about 11%');
  await expect(page.locator('#statsOverview [data-callout="weighed"]')).toContainText('which carry 90% of the revenue, so it reads high: by about 11%');
  await openStatsTab(page, 'clients');
  await expect(page.locator('#statsMargin .inv-panel-body .inv-note').first()).toContainText('which carry 90% of the revenue');
  await openStatsTab(page, 'cost');
  await expect(page.locator('#liveCost [data-callout="weighed"]')).toContainText('by about 11%');

  // Every line weighed: nothing to say.
  const w = base();
  w.invoices = [inv('00001', 1, 'TEST CLIENT KG', [kg('P1', 1000, 9)])];
  w.invNextNum = 2;
  await loadAppWithState(page, w);
  await openStatsTab(page, 'overview');
  await expect(page.locator('#statsOverview')).toBeVisible();
  await expect(page.locator('[data-callout="weighed"]')).toHaveCount(0);
});

test.describe('charts', () => {
  const draw = (page: Page, js: string) => g(page, `(function(){ var d = document.createElement('div'); d.innerHTML = ${js};
    return { labels: Array.from(d.querySelectorAll('.inv-chart-grid-label')).map(function(t){ return t.textContent; }),
      lines: Array.from(d.querySelectorAll('polyline.inv-chart-path')).map(function(p){ return p.getAttribute('points').trim().split(' ').length; }),
      pts: d.querySelectorAll('.inv-chart-pt').length,
      bars: Array.from(d.querySelectorAll('rect.inv-chart-seg')).map(function(r){ return +r.getAttribute('y') + +r.getAttribute('height'); }) }; })()`) as Promise<any>;

  test('S15: a series of zeros labels its axis 0 once, not ₹1 ₹1 ₹1 ₹0', async ({ page }) => {
    await loadAppWithState(page, base());
    expect((await draw(page, `chartLine([{ label: 'Aug', value: 0 }, { label: 'Sep', value: 0 }], { unit: 'money' })`)).labels).toEqual(['₹0']);
    expect((await draw(page, `chartBars([{ label: 'Aug', value: 0 }, { label: 'Sep', value: 0 }], { unit: 'kg' })`)).labels).toEqual(['0kg']);
    expect((await draw(page, `chartLines(['Aug', 'Sep'], [{ label: 'Out', values: [0, 0] }])`)).labels).toEqual(['₹0']);
    // A series with a figure keeps its five labels.
    expect((await draw(page, `chartLine([{ label: 'Aug', value: 0 }, { label: 'Sep', value: 800 }], { unit: 'money' })`)).labels).toHaveLength(5);

    // On the page: a book with no weighed line draws its tonnage at zero, labelled 0 alone.
    const s = base();
    s.invoices = [inv('00001', 1, 'TEST CLIENT KG', [{ partNumber: 'PIN', unit: 'NOS', qty: 100, rate: 10 }]),
      inv('00002', 1, 'TEST CLIENT KG', [{ partNumber: 'PIN', unit: 'NOS', qty: 100, rate: 10 }], addDays(todayIso(), -40))];
    s.invNextNum = 3;
    await loadAppWithState(page, s);
    await openStatsTab(page, 'trends');
    await page.locator('[data-action="invStatsTrendSeries"][data-series="tonnage"]').click();
    await expect(page.locator('[data-card="trend"] .inv-chart-grid-label')).toHaveText(['0kg']);
  });

  test('S16: a null is a gap on an even axis, and each series joins its own days on a time axis', async ({ page }) => {
    await loadAppWithState(page, base());
    const gap = await draw(page, `chartLines(['Jan', 'Feb', 'Mar', 'Apr', 'May'], [{ label: 'Received', values: [5, null, 7, 8, null] }])`);
    // Mar–Apr is the one run of two; January stands alone as its marker, and nothing is drawn across February.
    expect(gap.lines).toEqual([2]);
    expect(gap.pts).toBe(3);
    const time = await draw(page, `chartLines(['1 Aug', '5 Aug', '9 Aug'], [{ label: 'Market', values: [100, null, 104] }, { label: 'Bills', values: [null, 102, null] }], { xs: [0, 4, 8], fit: true, unit: 'rate' })`);
    expect(time.lines).toEqual([2]);
    expect(time.pts).toBe(3);
  });

  test('SD: grouped bars stand on the baseline and an even axis spans the drawing', async ({ page }) => {
    await loadAppWithState(page, base());
    const grouped = await draw(page, `chartStack(['Jul', 'Aug'], [{ label: 'Due', values: [60, 40] }, { label: 'Paid', values: [30, 50] }], { mode: 'group', unit: 'count' })`);
    expect(grouped.bars).toHaveLength(4);
    for (const b of grouped.bars) expect(b).toBeCloseTo(190, 5);     // 220 high, 30 under the bars
    const xs = await g(page, `(function(){ var d = document.createElement('div'); d.innerHTML = chartLines(['A', 'B'], [{ label: 'x', values: [1, 2] }]);
      return Array.from(d.querySelectorAll('.inv-chart-pt')).map(function(c){ return +c.getAttribute('cx'); }); })()`);
    expect(xs).toEqual([50, 468]);                                      // pad.l, and W − pad.r
  });
});

test('SR: one month label, one working-day walk, one range reader', async ({ page }) => {
  await loadAppWithState(page, base());
  const r: any = await g(page, `({ m: insMonthLabel('2026-09'), day: formatTrendLabel('2026-09-05', 'day'), month: formatTrendLabel('2026-09', 'month'),
    week: formatTrendLabel('2026-W38', 'week'), n: statsWorkingDays('2026-09-01', '2026-09-30'), list: statsWorkingDayList('2026-09-06', '2026-09-08'),
    range: statsRangeIso('mtd'), pace: (predMonthPace() || {}).done })`);
  expect(r.m).toBe('Sep');
  expect(r.day).toBe('5 Sep');
  expect(r.month).toBe('Sep 26');
  expect(r.week).toBe('W38 26');
  expect(r.n).toBe(26);                                  // September 2026 has four Sundays
  expect(r.list).toEqual(['2026-09-07', '2026-09-08']);  // 6 Sep 2026 is a Sunday
  const today = todayIso();
  expect(r.range).toEqual({ from: today.slice(0, 8) + '01', to: today });
  let working = 0;
  for (let d = today.slice(0, 8) + '01'; d <= today; d = addDays(d, 1)) if (new Date(d + 'T00:00:00').getDay() !== 0) working++;
  expect(r.pace ?? working).toBe(working);
});
