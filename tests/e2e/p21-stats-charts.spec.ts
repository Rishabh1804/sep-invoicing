import { test, expect, Page } from '@playwright/test';
import { emptyState, loadAppWithState, openStatsTab, todayIso, recentTs, SepState } from './fixtures';

/*
 * Stats charts.
 *
 * The trend was one line drawn with preserveAspectRatio="none", so a wide
 * desktop got the same 400x160 drawing smeared across it, markers rendered as
 * ellipses, and only the two endpoints carried a label. Nothing said what any
 * point was worth. Top Items ranked by value alone — the one ranking this
 * business's own thesis calls insufficient, since the parts filling the plant
 * are not the parts paying for it.
 *
 * UI pass 3, U3 (§10): Stats is a Dashboard of widgets and its Tables. The trend is the `trend` widget (its Choose ₹ · Tonnes ·
 * Incoming), Top items the `topitems` widget (its Choose ₹ · Tonnes · ₹/kg) and the Tables' By part, revenue by client the Tables'
 * By client (its share of the revenue a column) and the `share` widget; each fact below is asserted where it now lives.
 */

function invoice(num: number, over: Record<string, unknown> = {}) {
  const taxable = (over.taxableValue as number) ?? 1000;
  return {
    id: `INV-${num}`,
    invoiceNumber: String(num).padStart(5, '0'),
    displayNumber: `SEP/TEST-${String(num).padStart(5, '0')}`,
    date: todayIso(),
    status: 'active',
    invoiceState: 'filed',
    clientId: 1,
    clientName: 'TEST CLIENT KG',
    clientGSTIN: '',
    clientAddress: { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' },
    gstType: 'intra',
    items: [{ partNumber: 'P1', desc: 'P1', hsn: '998873', unit: 'KG', qty: 100, rate: 10, amount: taxable, nosQty: null }],
    taxableValue: taxable, cgstPer: 9, cgstAmt: 0, sgstPer: 9, sgstAmt: 0, igstPer: 0, igstAmt: 0,
    grandTotal: taxable, amountInWords: '',
    challanNo: '', challanDate: '', poNumber: '', poDate: '', despatchDate: '',
    transport: '', remarks: '', linkedIMIds: [],
    createdAt: recentTs(),
    ...over,
  };
}

function line(partNumber: string, qty: number, rate: number, unit = 'KG') {
  return { partNumber, desc: partNumber, hsn: '998873', unit, qty, rate, amount: qty * rate, nosQty: null };
}

function client(id: number, name: string, ratePerKg: number) {
  return {
    id, name, billingMode: 'weight', gstType: 'intra', gstin: '', address: '', isActive: true,
    rates: [{ ratePerKg, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [],
  };
}

function statsState(over: Partial<SepState> = {}): SepState {
  const s = emptyState();
  s.clients = [client(1, 'TEST CLIENT KG', 10)] as never;
  s.defaultCostPerKg = 8.55;
  return { ...s, ...over };
}

/** Stats defaults to MTD; the cards are period-filtered, so widen first. `tab` is an old tab's name or a table (openStatsTab). */
async function openStats(page: Page, tab = 'trends') {
  await openStatsTab(page, tab);
  await page.locator('#pageStats [data-action="invStatsPeriod"][data-period="all"]').click();
}
/** These widgets on Stats' board, at these sizes, for the person on the device (as Customise writes it). */
async function onBoard(page: Page, list: Array<[string, string]>) {
  await page.evaluate(l => { const w = window as any; w.wdgItemsPut('stats', w.wdgLay(), l); w.renderStats(); }, list);
  await page.locator('#statsBoard .inv-widget').first().waitFor();
}
const card = (page: Page, id: string) => page.locator(`#statsBoard .inv-widget[data-w="${id}"]`);
const choose = (page: Page, id: string, v: string) => card(page, id).locator(`[data-action="invWdgChoose"][data-v="${v}"]`).click();
/** Top parts at Large on Stats' board, where its Choose is (the ranking). */
async function openTop(page: Page) { await onBoard(page, [['topitems', 'l']]); }

test('P21: the trend switches between revenue, tonnage and material arriving', async ({ page }) => {
  const s = statsState();
  s.invoices = [
    invoice(1, { date: todayIso(), taxableValue: 5000, items: [line('P1', 500, 10)] }),
    invoice(2, { date: '2026-01-15', taxableValue: 3000, items: [line('P1', 300, 10)] }),
  ];
  s.incomingMaterial = [{
    id: 'IM-1', challanNo: '1', challanDate: todayIso(), clientId: 1, clientName: 'TEST CLIENT KG',
    items: [{ id: 'a', partNumber: 'P1', desc: 'P1', hsn: '998873', unit: 'KG', qty: 777, rate: 10, amount: 7770, nosQty: null, invoiced: false, invoiceId: null }],
    createdAt: recentTs(),
  }, {
    // A challan of January as well: the widget reads the last whole month against the one before it.
    id: 'IM-0', challanNo: '0', challanDate: '2026-01-15', clientId: 1, clientName: 'TEST CLIENT KG',
    items: [{ id: 'b', partNumber: 'P1', desc: 'P1', hsn: '998873', unit: 'KG', qty: 300, rate: 10, amount: 3000, nosQty: null, invoiced: true, invoiceId: 'INV-2' }],
    createdAt: recentTs(),
  }];
  await loadAppWithState(page, s);
  await openStats(page);

  await onBoard(page, [['trend', 'l']]);
  const trend = card(page, 'trend');
  await expect(trend.locator('.inv-widget-say')).toContainText('Billed in');

  await choose(page, 'trend', 'tonnage');
  await expect(card(page, 'trend').locator('.inv-widget-say')).toContainText('Plated and billed in');

  await choose(page, 'trend', 'im');
  const im = card(page, 'trend');
  await expect(im.locator('.inv-widget-say')).toContainText('Arrived on challans in');
  // IM is the other spine and is dated by its challan, not by an invoice; what arrives bills later.
  await expect(im.locator('.inv-widget-src')).toContainText('Challans by challan date');
  expect(await page.evaluate(() => (0, eval)('_wdgDrawn["stats|trend"].d.detail'))).toContain('bills later');
});

test('P21: the incoming trend measures challans, not invoices', async ({ page }) => {
  const s = statsState();
  s.invoices = [invoice(1, { taxableValue: 5000, items: [line('P1', 500, 10)] })];
  s.incomingMaterial = [{
    id: 'IM-1', challanNo: '1', challanDate: todayIso(), clientId: 1, clientName: 'TEST CLIENT KG',
    items: [{ id: 'a', partNumber: 'P1', desc: 'P1', hsn: '998873', unit: 'KG', qty: 1200, rate: 10, amount: 1, nosQty: null, invoiced: false, invoiceId: null }],
    createdAt: recentTs(),
  }];
  await loadAppWithState(page, s);
  await openStats(page);

  const kg = await page.evaluate(() =>
    (window as any).buildTrendSeries('month', 'im').reduce((t: number, d: { value: number }) => t + d.value, 0));
  expect(kg).toBe(1200);

  // The invoice's 500 kg belongs to the tonnage series, not this one.
  const tonnes = await page.evaluate(() =>
    (window as any).buildTrendSeries('month', 'tonnage').reduce((t: number, d: { value: number }) => t + d.value, 0));
  expect(tonnes).toBe(500);
});

test('P21: line and bar draw the same series, and neither distorts its aspect', async ({ page }) => {
  const s = statsState();
  s.invoices = [
    invoice(1, { date: todayIso(), taxableValue: 5000 }),
    invoice(2, { date: '2026-01-15', taxableValue: 3000 }),
  ];
  await loadAppWithState(page, s);
  await openStats(page);

  await onBoard(page, [['trend', 'l']]);
  // The trend draws the months as bars, the month to date hatched as to date (the tab map, TM6b; the card family's bars).
  await expect(card(page, 'trend').locator('.inv-chart-svg rect[data-todate]')).toHaveCount(1);
  const bars = await card(page, 'trend').locator('.inv-chart-svg rect[data-read]').count();
  // The line builder draws the same series: the months closed one line, the month to date its own dashed segment after it.
  const drawn = await page.evaluate(() => (0, eval)(`(function(){ var d = buildTrendSeries('month', 'revenue'), td = chartToDateAt(d.map(function(x) { return x.key; }), localDateStr().slice(0, 7));
    var el = document.createElement('div'); el.innerHTML = chartLine(d, { unit: 'money', toDate: td }); document.body.appendChild(el);
    var out = { n: d.length, dots: el.querySelectorAll('circle.inv-chart-dot').length, closed: el.querySelectorAll('polyline.inv-chart-line:not(.inv-chart-todate)').length,
      todate: el.querySelectorAll('polyline.inv-chart-todate').length, par: el.querySelector('.inv-chart-svg').getAttribute('preserveAspectRatio') }; el.remove(); return out; })()`)) as any;
  expect(bars).toBe(drawn.n);
  expect(drawn.dots).toBe(drawn.n);
  expect(drawn.closed).toBeGreaterThan(0);
  expect(drawn.todate).toBe(1);
  // The old chart stretched with preserveAspectRatio="none", which is why a marker could never be a circle: neither draws so.
  expect(drawn.par).toBeNull();
  expect(await card(page, 'trend').locator('.inv-chart-svg').first().getAttribute('preserveAspectRatio')).toBeNull();
});

test('P21: every point carries its own value, not just the endpoints', async ({ page }) => {
  const s = statsState();
  s.invoices = [
    invoice(1, { date: todayIso(), taxableValue: 5000 }),
    invoice(2, { date: '2026-01-15', taxableValue: 3000 }),
    invoice(3, { date: '2026-02-15', taxableValue: 4000 }),
  ];
  await loadAppWithState(page, s);
  await openStats(page);

  // Every marker carries a title, not just the two endpoints the old chart
  // labelled. The count follows the series — which now includes the quiet
  // months between January and today, each as an explicit zero.
  const series = await page.evaluate(() => (window as any).buildTrendSeries('month', 'revenue'));
  await onBoard(page, [['trend', 'l']]);
  const titles = await card(page, 'trend').locator('.inv-chart-svg rect[data-read] title').allTextContents();
  expect(titles).toHaveLength(series.length);
  expect(titles.length).toBeGreaterThan(3);
  expect(titles.join(' ')).toContain('₹3,000.00');
  expect(titles.join(' ')).toContain('₹4,000.00');
});

test('P21: revenue by client can be read as a share, with a legend', async ({ page }) => {
  const s = statsState();
  s.clients = [client(1, 'ALPHA', 10), client(2, 'BETA', 10)] as never;
  s.invoices = [
    invoice(1, { clientId: 1, clientName: 'ALPHA', taxableValue: 7500 }),
    invoice(2, { clientId: 2, clientName: 'BETA', taxableValue: 2500 }),
  ];
  await loadAppWithState(page, s);
  await openStats(page, 'clients');

  // The Tables' By client carries each client's share of the revenue, and each row opens the client's drill-down.
  const t = page.locator('#statsTable table[data-stats-tbl="client"]');
  const shareOf = (name: string) => t.locator('tbody tr[data-client-row]', { hasText: name }).locator('td[data-col="revShare"]');
  await expect(shareOf('ALPHA')).toHaveText('75%');
  await expect(shareOf('BETA')).toHaveText('25%');
  await expect(t.locator('tbody tr[data-action="invStatsClientDrill"]').first()).toBeVisible();
  // On the Dashboard the share is a picture with its key: the share of the revenue against the share of the tonnes.
  await openStats(page, 'board');
  await onBoard(page, [['share', 'l']]);
  await expect(card(page, 'share').locator('.inv-widget-say')).toContainText('75% of the revenue');
  await expect(card(page, 'share')).toContainText('Of revenue');
});

test('P21: the share chart folds a long tail into one named wedge', async ({ page }) => {
  const s = statsState();
  s.clients = Array.from({ length: 11 }, (_, i) => client(i + 1, `CLIENT ${i + 1}`, 10)) as never;
  s.invoices = Array.from({ length: 11 }, (_, i) =>
    invoice(i + 1, { clientId: i + 1, clientName: `CLIENT ${i + 1}`, taxableValue: 1000 * (11 - i) }));
  await loadAppWithState(page, s);
  await openStats(page, 'clients');

  // Every client keeps its row and its share in the Tables (the first thirty shown), the shares adding up to the whole.
  const shares = await page.locator('#statsTable tbody tr[data-client-row] td[data-col="revShare"]').allInnerTexts();
  expect(shares).toHaveLength(11);
  expect(shares.reduce((t, x) => t + Number(x.replace('%', '')), 0)).toBeGreaterThanOrEqual(99);
  // Drawn as a share, the long tail folds into one named wedge (charts.js chartPie, Money's share charts and any other): six wedges,
  // the clients holding the six series colours (UI pass 3 §3d: seriesSlot, the most kilos over the book), plus the fold, named and
  // drawn in Other so the tail is visibly a tail.
  await page.evaluate(() => (0, eval)(`(function(){ var rows = (S.clients || []).map(function(c, i) { return { label: c.name, value: 1000 * (11 - i), clientId: c.id }; });
    var el = document.createElement('div'); el.id = 'p21pie'; el.innerHTML = chartPie(rows, { unit: 'money', ariaLabel: 'Revenue share by client' }); document.body.appendChild(el); })()`));
  const pie = page.locator('#p21pie');
  await expect(pie.locator('.inv-chart-legend')).toContainText('5 others');
  await expect(pie.locator('.inv-chart-legend-row')).toHaveCount(7);
  await expect(pie.locator('.inv-chart-wedge.inv-chart-other')).toHaveCount(1);
  for (const n of [1, 2, 3, 4, 5, 6]) await expect(pie.locator(`.inv-chart-wedge.inv-chart-s${n}`)).toHaveCount(1);
});

test('P21: top items rank by value, tonnage and price — three different orders', async ({ page }) => {
  const s = statsState();
  // HEAVY fills the plant cheaply; RICH earns most; both are weighed.
  s.invoices = [
    invoice(1, { taxableValue: 27000, items: [line('HEAVY', 5000, 5.4)] }),
    invoice(2, { taxableValue: 30000, items: [line('RICH', 2000, 15)] }),
  ];
  await loadAppWithState(page, s);
  await openStats(page);
  await openTop(page);

  const first = () => card(page, 'topitems').locator('.inv-chart-ranked-row').first();
  await expect(card(page, 'topitems').locator('.inv-widget-say')).toContainText('Billed most: RICH');
  await expect(first()).toContainText('RICH');

  await choose(page, 'topitems', 'tonnage');
  await expect(card(page, 'topitems').locator('.inv-widget-say')).toContainText('The most tonnes: HEAVY');
  await expect(first()).toContainText('HEAVY');

  await choose(page, 'topitems', 'rate');
  await expect(card(page, 'topitems').locator('.inv-widget-say')).toContainText('Priced worst: HEAVY');
  await expect(first()).toContainText('HEAVY');
  // The Tables' By part sorts the same three ways by a tapped head.
  await openStats(page, 'part');
  const part = () => page.locator('#statsTable tbody tr').first();
  await expect(part()).toContainText('RICH');
  await page.locator('#statsTable [data-action="invStatsSort"][data-col="kg"]').click();
  await expect(part()).toContainText('HEAVY');
  await page.locator('#statsTable [data-action="invStatsSort"][data-col="perKg"]').click();
  await page.locator('#statsTable [data-action="invStatsSort"][data-col="perKg"]').click();
  await expect(page.locator('#statsTable th[aria-sort="ascending"] button')).toContainText('₹/kg');
  await expect(part()).toContainText('HEAVY');
});

test('P21: a weight ranking says how many parts it could not rank', async ({ page }) => {
  const s = statsState();
  // A piece-billed part with no weight anywhere cannot enter a weight ranking.
  s.clients = [client(1, 'TEST CLIENT KG', 10)] as never;
  s.invoices = [
    invoice(1, { taxableValue: 1000, items: [line('WEIGHED', 100, 10)] }),
    invoice(2, { taxableValue: 500, items: [line('UNWEIGHED', 50, 10, 'NOS')] }),
  ];
  await loadAppWithState(page, s);
  await openStats(page);
  await openTop(page);

  await choose(page, 'topitems', 'tonnage');
  // Stated, not silently dropped: the excluded parts are the piece-billed end,
  // so a ranking that hides them reads better than the truth.
  // On the card, where it is read (Cipher L-1): never a part the fit lets go of.
  await expect(page.locator('#statsBoard .inv-widget[data-w="topitems"] .inv-widget-sub')).toContainText('1 of 2 parts left out');
  // The Tables' By part keeps the part, its kilos a dash, and says how many have no weight.
  await openStats(page, 'part');
  await expect(page.locator('#statsTable tbody tr', { hasText: 'UNWEIGHED' }).locator('td[data-col="kg"]')).toHaveText('—');
  await expect(page.locator('#statsTable .inv-note', { hasText: 'no known weight' })).toContainText('1 of 2');
});

test('P21: parts plated below cost are marked against the cost line', async ({ page }) => {
  const s = statsState();
  s.invoices = [
    invoice(1, { taxableValue: 27000, items: [line('BELOW', 5000, 5.4)] }),
    invoice(2, { taxableValue: 30000, items: [line('ABOVE', 2000, 15)] }),
  ];
  await loadAppWithState(page, s);
  await openStats(page);
  await openTop(page);
  await choose(page, 'topitems', 'rate');

  // Green covers cost, red does not — the app's accent is itself a terracotta,
  // so accent-vs-danger was a distinction nobody could see.
  await expect(card(page, 'topitems').locator('.inv-chart-ranked-fill-danger')).toHaveCount(1);
  await expect(card(page, 'topitems').locator('.inv-chart-ranked-fill-good')).toHaveCount(1);
  // The mark is the period's live cost: nothing recorded here, so every part is its model figure.
  const live = await page.evaluate(() => (0, eval)(`(function(){ var r = statsRangeIso(_statsPeriod); return formatCurrency(liveCost(r.from, r.to, weighLines(S.invoices.filter(function(i){ return i.status === 'active'; })).kg).perKg); })()`));
  await expect(page.locator('#statsBoard .inv-widget[data-w="topitems"] .inv-widget-sub')).toContainText('under the live cost of ' + live + '/kg');
  // The mark stands at the cost on the bars' own scale.
  await expect(card(page, 'topitems').locator('.inv-chart-ranked-mark, [class*="ranked-mark"]').first()).toBeAttached();
});

test('P21: a period with no work is a zero, not a gap the chart closes over', async ({ page }) => {
  const s = statsState();
  // January and May, nothing between. Rendering these as two adjacent bars
  // reads as continuous work and hides the three-month hole entirely.
  s.invoices = [
    invoice(1, { date: '2026-01-15', taxableValue: 5000 }),
    invoice(2, { date: '2026-05-15', taxableValue: 4000 }),
  ];
  await loadAppWithState(page, s);
  await openStats(page);

  const series = await page.evaluate(() => (window as any).buildTrendSeries('month', 'revenue'));
  expect(series).toHaveLength(5);
  expect(series.map((d: { value: number }) => d.value)).toEqual([5000, 0, 0, 0, 4000]);
  expect(series[0].label).toContain('Jan');
  expect(series[4].label).toContain('May');
});
