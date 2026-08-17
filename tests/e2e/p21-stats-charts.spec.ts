import { test, expect, Page } from '@playwright/test';
import { emptyState, loadAppWithState, switchTab, todayIso, recentTs, SepState } from './fixtures';

/*
 * Stats charts.
 *
 * The trend was one line drawn with preserveAspectRatio="none", so a wide
 * desktop got the same 400x160 drawing smeared across it, markers rendered as
 * ellipses, and only the two endpoints carried a label. Nothing said what any
 * point was worth. Top Items ranked by value alone — the one ranking this
 * business's own thesis calls insufficient, since the parts filling the plant
 * are not the parts paying for it.
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

/** Stats defaults to MTD; the item cards are period-filtered, so widen first. */
async function openStats(page: Page) {
  await switchTab(page, 'pageStats');
  await page.locator('[data-action="invStatsPeriod"][data-period="all"]').click();
}

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
  }];
  await loadAppWithState(page, s);
  await openStats(page);

  await expect(page.locator('.inv-stats-card', { hasText: 'Revenue Trend' })).toBeVisible();

  await page.locator('[data-action="invStatsTrendSeries"][data-series="tonnage"]').click();
  await expect(page.locator('.inv-stats-card', { hasText: 'Tonnage Trend' })).toBeVisible();

  await page.locator('[data-action="invStatsTrendSeries"][data-series="im"]').click();
  const imCard = page.locator('.inv-stats-card', { hasText: 'Incoming Material Trend' });
  await expect(imCard).toBeVisible();
  // IM is the other spine and is dated by its challan, not by an invoice.
  await expect(imCard).toContainText('by challan date');
  await expect(imCard).toContainText('bills later');
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

  await expect(page.locator('.inv-chart-svg polyline.inv-svg-line')).toBeVisible();
  await page.locator('[data-action="invStatsTrendType"][data-type="bar"]').click();
  await expect(page.locator('.inv-chart-svg rect.inv-chart-bar').first()).toBeVisible();
  await expect(page.locator('.inv-chart-svg polyline.inv-svg-line')).toHaveCount(0);

  // The old chart stretched with preserveAspectRatio="none", which is why a
  // marker could never be a circle.
  const par = await page.locator('.inv-chart-svg').first().getAttribute('preserveAspectRatio');
  expect(par).toBeNull();
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
  const titles = await page.locator('.inv-chart-svg circle.inv-svg-dot title').allTextContents();
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
  await openStats(page);

  await page.locator('[data-action="invStatsClientChart"][data-chart="pie"]').click();
  const legend = page.locator('.inv-chart-legend');
  await expect(legend).toContainText('ALPHA');
  await expect(legend).toContainText('75.0%');
  await expect(legend).toContainText('25.0%');
  // A wedge is tappable through to the same client drill-down the bars use.
  await expect(page.locator('.inv-chart-legend-row[data-action="invStatsClientDrill"]').first()).toBeVisible();
});

test('P21: the share chart folds a long tail into one named wedge', async ({ page }) => {
  const s = statsState();
  s.clients = Array.from({ length: 11 }, (_, i) => client(i + 1, `CLIENT ${i + 1}`, 10)) as never;
  s.invoices = Array.from({ length: 11 }, (_, i) =>
    invoice(i + 1, { clientId: i + 1, clientName: `CLIENT ${i + 1}`, taxableValue: 1000 * (11 - i) }));
  await loadAppWithState(page, s);
  await openStats(page);
  await page.locator('[data-action="invStatsClientChart"][data-chart="pie"]').click();

  // Eight wedges plus the fold — slivers nobody can aim at are not drawn, and
  // the fold is named so the tail is visibly a tail.
  await expect(page.locator('.inv-chart-legend')).toContainText('3 others');
  await expect(page.locator('.inv-chart-legend-row')).toHaveCount(9);
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

  const first = () => page.locator('.inv-chart-ranked-row').first();
  await expect(page.locator('.inv-stats-card', { hasText: 'Top Items by Value' })).toBeVisible();
  await expect(first()).toContainText('RICH');

  await page.locator('[data-action="invStatsTopBy"][data-by="tonnage"]').click();
  await expect(page.locator('.inv-stats-card', { hasText: 'Top Items by Tonnage' })).toBeVisible();
  await expect(first()).toContainText('HEAVY');

  await page.locator('[data-action="invStatsTopBy"][data-by="rate"]').click();
  await expect(page.locator('.inv-stats-card', { hasText: 'Worst Priced Items' })).toBeVisible();
  await expect(first()).toContainText('HEAVY');
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

  await page.locator('[data-action="invStatsTopBy"][data-by="tonnage"]').click();
  // Stated, not silently dropped: the excluded parts are the piece-billed end,
  // so a ranking that hides them reads better than the truth.
  await expect(page.locator('.inv-stats-note', { hasText: 'left out' })).toContainText('1 of 2');
});

test('P21: parts plated below cost are marked against the cost line', async ({ page }) => {
  const s = statsState();
  s.invoices = [
    invoice(1, { taxableValue: 27000, items: [line('BELOW', 5000, 5.4)] }),
    invoice(2, { taxableValue: 30000, items: [line('ABOVE', 2000, 15)] }),
  ];
  await loadAppWithState(page, s);
  await openStats(page);
  await page.locator('[data-action="invStatsTopBy"][data-by="rate"]').click();

  // Green covers cost, red does not — the app's accent is itself a terracotta,
  // so accent-vs-danger was a distinction nobody could see.
  await expect(page.locator('.inv-chart-ranked-fill-danger')).toHaveCount(1);
  await expect(page.locator('.inv-chart-ranked-fill-good')).toHaveCount(1);
  await expect(page.locator('.inv-stats-note', { hasText: 'Mark is full cost' })).toContainText('₹8.55');
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
